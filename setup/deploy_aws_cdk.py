#!/usr/bin/env python3
"""
Complete AWS CDK Deployment Script
Deploys infrastructure, builds images, and configures AgentCore using CDK
"""

import boto3
import json
import subprocess
import time
import sys
import os
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

def get_cdk_output(stack_name, output_name):
    """Get output from CDK stack"""
    result = subprocess.run(
        ['aws', 'cloudformation', 'describe-stacks', 
         '--stack-name', stack_name,
         '--query', f'Stacks[0].Outputs[?OutputKey==`{output_name}`].OutputValue',
         '--output', 'text'],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Failed to get CDK output {output_name} from {stack_name}")
        print(f"   Make sure CDK has been deployed successfully")
        sys.exit(1)
    return result.stdout.strip()

def get_public_ip():
    """Get the user's public IPv4 address - REQUIRED for deployment"""
    import requests
    
    # Try IPv4-specific web endpoints first
    try:
        response = requests.get('https://api.ipify.org?format=text', timeout=5)
        ip = response.text.strip()
        if ':' not in ip:  # Verify it's IPv4
            return ip
    except:
        pass
    
    try:
        response = requests.get('https://ipv4.icanhazip.com', timeout=5)
        ip = response.text.strip()
        if ':' not in ip:  # Verify it's IPv4
            return ip
    except:
        pass
    
    # Final fallback: Use curl -4 to force IPv4
    try:
        print("Trying curl -4 ifconfig.me for IPv4 address...")
        result = subprocess.run(
            ['curl', '-4', '-s', 'ifconfig.me'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            ip = result.stdout.strip()
            if ':' not in ip and ip:  # Verify it's IPv4 and not empty
                return ip
    except:
        pass
    
    # All methods failed
    print("❌ CRITICAL ERROR: Could not detect your public IPv4 address")
    print("   All detection methods failed (api.ipify.org, ipv4.icanhazip.com, curl -4)")
    print("\n   To fix:")
    print("   1. Check your internet connection")
    print("   2. Manually deploy with: cdk deploy --all --parameters AllowedIPAddress=YOUR.IPv4.HERE/32")
    print("   3. Get your IPv4 with: curl -4 ifconfig.me")
    sys.exit(1)

def get_aws_region():
    """Get AWS region from config or default"""
    try:
        session = boto3.Session()
        return session.region_name or 'us-east-1'
    except:
        return 'us-east-1'

def get_aws_account():
    """Get AWS account ID"""
    try:
        sts = boto3.client('sts')
        return sts.get_caller_identity()['Account']
    except Exception as e:
        print(f"❌ Failed to get AWS account ID: {e}")
        sys.exit(1)

def main():
    print("🚀 Starting Complete AWS CDK Deployment\n")
    
    # Step 0: Auto-detect and configure IP address
    print("=" * 60)
    print("STEP 0: Detecting Configuration")
    print("=" * 60)
    
    print("Detecting your public IP address...")
    ip_address = get_public_ip()  # Exits if detection fails
    print(f"✓ Detected IP: {ip_address}")
    
    aws_region = get_aws_region()
    aws_account = get_aws_account()
    print(f"✓ AWS Region: {aws_region}")
    print(f"✓ AWS Account: {aws_account}")
    
    print("\n⚠️  Security Note: ALB will only accept connections from this IP address")
    print()
    
    # Step 1: Deploy CDK Infrastructure
    print("=" * 60)
    print("STEP 1: Deploying CDK Infrastructure")
    print("=" * 60)
    
    cdk_dir = Path("deploy/cdk")
    if not cdk_dir.exists():
        print("❌ deploy/cdk directory not found")
        sys.exit(1)
    
    print("Bootstrapping CDK (if needed)...")
    run_command(
        f"cdk bootstrap aws://{aws_account}/{aws_region}",
        cwd=str(cdk_dir),
        check=False  # May already be bootstrapped
    )
    
    print("\nSynthesizing CDK stacks...")
    run_command("cdk synth", cwd=str(cdk_dir), show_output=True)
    
    print("\nDeploying all CDK stacks (this may take 10-15 minutes)...")
    print("⏳ Creating VPC, subnets, RDS, ECS cluster, ALB with IP whitelisting...")
    
    # Deploy all stacks with parameters
    deploy_cmd = (
        f"cdk deploy --all --require-approval never "
        f"--parameters CatalogAgentsSecurityStack:AllowedIPAddress={ip_address}/32 "
        f"--parameters CatalogAgentsDatabaseStack:DBUsername=unitycatalog "
        f"--parameters CatalogAgentsDatabaseStack:DBPassword=ChangeThisSecurePassword123! "
        f"--parameters CatalogAgentsEcsServicesStack:AWSRegion={aws_region}"
    )
    
    run_command(deploy_cmd, cwd=str(cdk_dir), show_output=True)
    
    print("✅ Infrastructure deployed\n")
    
    # Step 2: Get stack outputs
    print("=" * 60)
    print("STEP 2: Retrieving Stack Outputs")
    print("=" * 60)
    
    # Get ECR repository URLs from Storage stack
    streamlit_ecr_uri = get_cdk_output('CatalogAgentsStorageStack', 'StreamlitRepositoryUri')
    unity_mcp_ecr_uri = get_cdk_output('CatalogAgentsStorageStack', 'UnityMCPRepositoryUri')
    glue_mcp_ecr_uri = get_cdk_output('CatalogAgentsStorageStack', 'GlueMCPRepositoryUri')
    
    # Get ALB DNS from LoadBalancer stack
    alb_dns = get_cdk_output('CatalogAgentsLoadBalancerStack', 'ALBDnsName')
    
    # Get ECS cluster name from Compute stack
    cluster_name = get_cdk_output('CatalogAgentsComputeStack', 'ClusterName')
    
    print(f"✓ Streamlit ECR: {streamlit_ecr_uri}")
    print(f"✓ Unity MCP ECR: {unity_mcp_ecr_uri}")
    print(f"✓ Glue MCP ECR: {glue_mcp_ecr_uri}")
    print(f"✓ ALB DNS: {alb_dns}")
    print(f"✓ ECS Cluster: {cluster_name}")
    print()
    
    # Step 3: Build and Push Streamlit Docker Image
    print("=" * 60)
    print("STEP 3: Building and Pushing Streamlit Docker Image")
    print("=" * 60)
    print("Note: MCP server images will be built by AgentCore toolkit in Step 4\n")
    
    # Login to ECR
    print("Logging into ECR...")
    ecr_password = run_command(f"aws ecr get-login-password --region {aws_region}")
    ecr_registry = streamlit_ecr_uri.split('/')[0]
    run_command(f"echo {ecr_password} | docker login --username AWS --password-stdin {ecr_registry}")
    
    # Build and push Streamlit app only
    print("\n🐳 Building Streamlit App (may take 1-2 minutes)...")
    run_command(f"docker build --platform linux/amd64 -f deploy/docker/Dockerfile.streamlit -t {streamlit_ecr_uri}:latest .", show_output=True)
    
    print("📤 Pushing Streamlit App to ECR...")
    run_command(f"docker push {streamlit_ecr_uri}:latest", show_output=True)
    
    print("✅ Streamlit image built and pushed\n")
    
    # Step 4: Deploy to AgentCore
    print("=" * 60)
    print("STEP 4: Deploying MCP Servers to AgentCore")
    print("=" * 60)
    print("\n⚠️  Note: AgentCore deployment uses bedrock-agentcore-starter-toolkit")
    print("   The toolkit will build containers from your Python code and deploy them.\n")
    
    # Run AgentCore deployments separately to avoid threading issues
    print("Deploying Unity Catalog MCP Server...")
    result = subprocess.run(
        [sys.executable, 'setup/deploy_aws_agentcore.py', '--agent', 'unity'],
        check=False
    )
    
    if result.returncode != 0:
        print(f"\n❌ Unity MCP deployment failed")
        sys.exit(1)
    
    print("\n🧹 Cleaning up before next deployment...")
    # Keep .dockerignore so Glue uses the same optimized version as Unity
    for file in ['Dockerfile', '.bedrock_agentcore.yaml']:
        if os.path.exists(file):
            os.remove(file)
            print(f"  ✓ Removed {file}")
    
    print("\nDeploying Glue Catalog MCP Server...")
    result = subprocess.run(
        [sys.executable, 'setup/deploy_aws_agentcore.py', '--agent', 'glue'],
        check=False
    )
    
    if result.returncode != 0:
        print(f"\n❌ Glue MCP deployment failed")
        sys.exit(1)
    
    # Load results from config file
    with open('agentcore-config.json', 'r') as f:
        mcp_config = json.load(f)
    
    print("✅ AgentCore deployment complete\n")
    
    # Step 5: Update ECS Service
    print("=" * 60)
    print("STEP 5: Updating ECS Services")
    print("=" * 60)
    
    print(f"Updating streamlit-app-service...")
    run_command(f"aws ecs update-service --cluster {cluster_name} --service streamlit-app-service --force-new-deployment --region {aws_region}")
    
    print("✅ ECS services updated\n")
    
    # Step 6: Populate Unity Catalog with Sample Data
    print("=" * 60)
    print("STEP 6: Populating Unity Catalog with Sample Data")
    print("=" * 60)
    
    unity_api_url = f"https://{alb_dns}/api/2.1/unity-catalog"
    
    print(f"Unity Catalog API: {unity_api_url}")
    print("Waiting for Unity Catalog service to be ready...")
    
    # Wait for Unity Catalog service to be healthy
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
    
    # Set environment variables for Unity setup script
    os.environ['UNITY_CATALOG_URL'] = unity_api_url
    os.environ['DISABLE_SSL_VERIFY'] = '1'
    
    print("\nCreating Unity Catalog sample tables...")
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
    print(f"\n🔒 Security: Access restricted to IP {ip_address}")
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
        import traceback
        traceback.print_exc()
        sys.exit(1)
