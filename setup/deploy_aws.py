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

def get_public_ip():
    """Get the user's public IP address - REQUIRED for deployment"""
    import requests
    try:
        response = requests.get('https://ifconfig.me', timeout=5)
        return response.text.strip()
    except:
        try:
            response = requests.get('https://api.ipify.org', timeout=5)
            return response.text.strip()
        except Exception as e:
            print("❌ CRITICAL ERROR: Could not detect your public IP address")
            print("   Both ifconfig.me and api.ipify.org are unreachable")
            print("\n   To fix:")
            print("   1. Check your internet connection")
            print("   2. Or manually create deploy/terraform/terraform.tfvars with:")
            print('      allowed_ip_address = "YOUR.IP.HERE"')
            print("   3. Get your IP with: curl ifconfig.me")
            sys.exit(1)

def create_or_update_tfvars(ip_address):
    """Create or update terraform.tfvars with IP address"""
    tfvars_path = Path("deploy/terraform/terraform.tfvars")
    
    # Default configuration
    tfvars_content = f"""aws_region = "us-east-1"
environment = "dev"

# IP Whitelist - Restrict access to your IP only
allowed_ip_address = "{ip_address}"
"""
    
    if tfvars_path.exists():
        # Read existing file
        with open(tfvars_path, 'r') as f:
            existing_content = f.read()
        
        # Check if IP is already set
        if 'allowed_ip_address' in existing_content and ip_address in existing_content:
            print(f"✓ terraform.tfvars already has your IP: {ip_address}")
            return
        
        # Update IP address in existing file
        import re
        if 'allowed_ip_address' in existing_content:
            # Replace existing IP
            updated_content = re.sub(
                r'allowed_ip_address\s*=\s*"[^"]*"',
                f'allowed_ip_address = "{ip_address}"',
                existing_content
            )
            with open(tfvars_path, 'w') as f:
                f.write(updated_content)
            print(f"✓ Updated IP address in terraform.tfvars: {ip_address}")
        else:
            # Add IP address to existing file
            with open(tfvars_path, 'a') as f:
                f.write(f'\n# IP Whitelist - Restrict access to your IP only\n')
                f.write(f'allowed_ip_address = "{ip_address}"\n')
            print(f"✓ Added IP address to terraform.tfvars: {ip_address}")
    else:
        # Create new file
        with open(tfvars_path, 'w') as f:
            f.write(tfvars_content)
        print(f"✓ Created terraform.tfvars with your IP: {ip_address}")

def main():
    print("🚀 Starting Complete AWS Deployment\n")
    
    # Step 0: Auto-detect and configure IP address
    print("=" * 60)
    print("STEP 0: Configuring IP Whitelist")
    print("=" * 60)
    
    print("Detecting your public IP address...")
    ip_address = get_public_ip()  # Exits if detection fails
    
    print(f"✓ Detected IP: {ip_address}")
    create_or_update_tfvars(ip_address)
    print("\n⚠️  Security Note: ALB will only accept connections from this IP address")
    print()
    
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
    
    # Check if terraform.tfvars exists
    tfvars_path = terraform_dir / "terraform.tfvars"
    if tfvars_path.exists():
        print("✓ Using terraform.tfvars for configuration")
    else:
        print("⚠️  No terraform.tfvars found - you'll be prompted for variables")
        print("   Create deploy/terraform/terraform.tfvars to avoid prompts (see README)")
    
    print("\nApplying Terraform configuration (this may take 5-10 minutes)...")
    print("⏳ Creating VPC, subnets, RDS, ECS cluster, ALB with IP whitelisting...")
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
    run_command(f"docker build --platform linux/amd64 -f deploy/docker/Dockerfile.streamlit -t {streamlit_ecr_uri}:latest .", show_output=True)
    
    print("📤 Pushing Streamlit App to ECR...")
    run_command(f"docker push {streamlit_ecr_uri}:latest", show_output=True)
    
    print("✅ Streamlit image built and pushed\n")
    
    # Step 3: Deploy to AgentCore
    print("=" * 60)
    print("STEP 3: Deploying MCP Servers to AgentCore")
    print("=" * 60)
    print("\n⚠️  Note: AgentCore deployment uses bedrock-agentcore-starter-toolkit")
    print("   The toolkit will build containers from your Python code and deploy them.\n")
    
    # Run AgentCore deployments separately to avoid threading issues
    print("Deploying Unity Catalog MCP Server...")
    result = subprocess.run(
        [sys.executable, 'setup/deploy_agentcore.py', '--agent', 'unity'],
        check=False,
        capture_output=True,
        text=True
    )
    
    # Show output
    if result.stdout:
        print(result.stdout)
    
    if result.returncode != 0:
        print(f"\n❌ Unity MCP deployment failed")
        if result.stderr:
            print("STDERR:", result.stderr)
        sys.exit(1)
    
    print("\n🧹 Cleaning up before next deployment...")
    import os
    for file in ['Dockerfile', '.dockerignore', '.bedrock_agentcore.yaml']:
        if os.path.exists(file):
            os.remove(file)
            print(f"  ✓ Removed {file}")
    
    print("\nDeploying Glue Catalog MCP Server...")
    result = subprocess.run(
        [sys.executable, 'setup/deploy_agentcore.py', '--agent', 'glue'],
        check=False,
        capture_output=True,
        text=True
    )
    
    # Show output
    if result.stdout:
        print(result.stdout)
    
    if result.returncode != 0:
        print(f"\n❌ Glue MCP deployment failed")
        if result.stderr:
            print("STDERR:", result.stderr)
        sys.exit(1)
    
    # Load results from config file
    with open('agentcore-config.json', 'r') as f:
        mcp_config = json.load(f)
    
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
    # Run as subprocess with environment variable (cleaner approach)
    os.environ['UNITY_CATALOG_URL'] = unity_api_url
    os.environ['DISABLE_SSL_VERIFY'] = '1'
    
    result = subprocess.run(
        [sys.executable, 'setup/setup_unity_simple.py'],
        capture_output=True,
        text=True,
        env=os.environ
    )
    
    if result.returncode == 0:
        print("✅ Unity Catalog sample data created")
    else:
        print(f"⚠️  Warning: Could not populate Unity Catalog")
        if result.stderr:
            print(f"   Error: {result.stderr}")
        print(f"   You can manually run: python setup/setup_unity_simple.py")
        print(f"   (Set UNITY_CATALOG_URL environment variable)")
    
    print()
    
    # Final summary
    print("=" * 60)
    print("🎉 DEPLOYMENT COMPLETE!")
    print("=" * 60)
    print(f"\n📱 Access your application:")
    print(f"   Application URL: https://{alb_dns}")
    print(f"\n� Security: Access restricted to IP address in terraform.tfvars")
    print(f"\n🔐 Runtime IDs saved to .env file")
    unity_id = mcp_config.get('unity_mcp', {}).get('runtime_id', 'N/A')
    glue_id = mcp_config.get('glue_mcp', {}).get('runtime_id', 'N/A')
    print(f"   Unity MCP: {unity_id}")
    print(f"   Glue MCP: {glue_id}")
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
