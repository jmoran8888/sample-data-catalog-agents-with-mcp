#!/usr/bin/env python3
"""
Complete AWS Deployment Script
Deploys infrastructure, builds images, and configures AgentCore
"""

import boto3
import json
import subprocess
import time
import sys
from pathlib import Path

def run_command(cmd, cwd=None, check=True, show_output=False):
    """Run shell command and return output"""
    print(f"▶ Running: {cmd}")
    
    if show_output:
        # Show live output for long-running commands
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            text=True
        )
        if check and result.returncode != 0:
            print(f"❌ Command failed with exit code {result.returncode}")
            sys.exit(1)
        return ""
    else:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        if check and result.returncode != 0:
            print(f"❌ Command failed: {result.stderr}")
            sys.exit(1)
        return result.stdout.strip()

def get_terraform_output(output_name):
    """Get output from Terraform"""
    result = subprocess.run(
        ['terraform', 'output', '-raw', output_name],
        cwd='deploy/terraform',
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Failed to get terraform output {output_name}")
        print(f"   Make sure terraform has been applied successfully")
        sys.exit(1)
    return result.stdout.strip()

def main():
    print("🚀 Starting Complete AWS Deployment\n")
    
    # Step 1: Deploy Terraform Infrastructure
    print("=" * 60)
    print("STEP 1: Deploying Terraform Infrastructure")
    print("=" * 60)
    
    terraform_dir = Path("deploy/terraform")
    if not terraform_dir.exists():
        print("❌ deploy/terraform directory not found")
        sys.exit(1)
    
    print("Initializing Terraform...")
    run_command("terraform init", cwd=str(terraform_dir), show_output=True)
    
    print("\nApplying Terraform configuration (this may take 5-10 minutes)...")
    print("⏳ Creating VPC, subnets, RDS, ECS cluster, ALB, Cognito...")
    run_command("terraform apply -auto-approve", cwd=str(terraform_dir), show_output=True)
    
    print("✅ Infrastructure deployed\n")
    
    # Step 2: Build and Push Streamlit Docker Image
    print("=" * 60)
    print("STEP 2: Building and Pushing Streamlit Docker Image")
    print("=" * 60)
    print("Note: MCP server images will be built by AgentCore toolkit in Step 3\n")
    
    streamlit_ecr_uri = get_terraform_output('ecr_repository_url')
    aws_region = get_terraform_output('aws_region')
    
    print(f"Streamlit ECR: {streamlit_ecr_uri}")
    
    # Login to ECR
    print("\nLogging into ECR...")
    ecr_password = run_command(f"aws ecr get-login-password --region {aws_region}")
    ecr_registry = streamlit_ecr_uri.split('/')[0]
    run_command(f"echo {ecr_password} | docker login --username AWS --password-stdin {ecr_registry}")
    
    # Build and push Streamlit app only
    print("\n🐳 Building Streamlit App (may take 1-2 minutes)...")
    run_command(f"docker build -f deploy/docker/Dockerfile.streamlit -t {streamlit_ecr_uri}:latest .", show_output=True)
    
    print("📤 Pushing Streamlit App to ECR...")
    run_command(f"docker push {streamlit_ecr_uri}:latest", show_output=True)
    
    print("✅ Streamlit image built and pushed\n")
    
    # Step 3: Deploy to AgentCore
    print("=" * 60)
    print("STEP 3: Deploying MCP Servers to AgentCore")
    print("=" * 60)
    print("\n⚠️  Note: AgentCore deployment uses bedrock-agentcore-starter-toolkit")
    print("   The toolkit will build containers from your Python code and deploy them.\n")
    
    # Import and run the AgentCore deployment
    import importlib.util
    spec = importlib.util.spec_from_file_location("deploy_agentcore", "setup/deploy_agentcore.py")
    agentcore_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(agentcore_module)
    
    result = agentcore_module.deploy_mcp_servers()
    
    print("✅ AgentCore deployment complete\n")
    
    # Step 4: Update ECS Service
    print("=" * 60)
    print("STEP 4: Updating ECS Services")
    print("=" * 60)
    
    cluster_name = get_terraform_output('ecs_cluster_name')
    
    print(f"Updating streamlit-app-service...")
    run_command(f"aws ecs update-service --cluster {cluster_name} --service streamlit-app-service --force-new-deployment --region {aws_region}")
    
    print("✅ ECS services updated\n")
    
    # Step 5: Populate Unity Catalog with Sample Data
    print("=" * 60)
    print("STEP 5: Populating Unity Catalog with Sample Data")
    print("=" * 60)
    
    alb_dns = get_terraform_output('alb_dns_name')
    unity_api_url = f"https://{alb_dns}/api/2.1/unity-catalog"
    
    print(f"Unity Catalog API: {unity_api_url}")
    print("Waiting for Unity Catalog service to be ready...")
    
    # Wait for Unity Catalog service to be healthy
    import time
    max_retries = 30
    for i in range(max_retries):
        try:
            import requests
            response = requests.get(f"https://{alb_dns}/health", timeout=5, verify=False)
            if response.status_code == 200:
                print("✅ Unity Catalog service is ready")
                break
        except:
            pass
        
        if i < max_retries - 1:
            print(f"   Waiting... ({i+1}/{max_retries})")
            time.sleep(10)
        else:
            print("⚠️  Timeout waiting for Unity Catalog - continuing anyway")
    
    # Set environment variable for Unity setup script
    import os
    os.environ['UNITY_CATALOG_URL'] = unity_api_url
    
    print("\nCreating Unity Catalog sample tables...")
    try:
        # Import and run the Unity setup script
        import importlib.util
        spec = importlib.util.spec_from_file_location("setup_unity", "setup/setup_unity_simple.py")
        unity_setup = importlib.util.module_from_spec(spec)
        
        # Patch the BASE_URL in the module before executing
        import sys
        original_argv = sys.argv
        sys.argv = ['setup_unity_simple.py']
        
        # Read and modify the script to use our URL
        with open('setup/setup_unity_simple.py', 'r') as f:
            script_content = f.read()
        
        # Replace BASE_URL with our deployed endpoint
        script_content = script_content.replace(
            'BASE_URL = "http://localhost:8080/api/2.1/unity-catalog"',
            f'BASE_URL = "{unity_api_url}"'
        )
        
        # Execute the modified script
        exec(script_content, {'__name__': '__main__'})
        
        sys.argv = original_argv
        
        print("✅ Unity Catalog sample data created")
    except Exception as e:
        print(f"⚠️  Warning: Could not populate Unity Catalog: {e}")
        print("   You can manually run: python setup/setup_unity_simple.py")
        print("   (Update BASE_URL in the script first)")
    
    print()
    
    # Final summary
    admin_login_url = get_terraform_output('admin_login_url')
    
    print("=" * 60)
    print("🎉 DEPLOYMENT COMPLETE!")
    print("=" * 60)
    print(f"\n📱 Access your application:")
    print(f"   Application URL: https://{alb_dns}")
    print(f"   Login URL: {admin_login_url}")
    print(f"\n🔐 Runtime IDs saved to .env file")
    print(f"   Unity MCP: {result['unity_runtime_id']}")
    print(f"   Glue MCP: {result['glue_runtime_id']}")
    print(f"\n⏳ Note: Allow a few minutes for ECS service to fully start")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Deployment interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")
        sys.exit(1)
