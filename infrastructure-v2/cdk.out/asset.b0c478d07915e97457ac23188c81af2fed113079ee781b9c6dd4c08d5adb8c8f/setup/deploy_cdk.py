#!/usr/bin/env python3
"""
Deploy Data Catalog Agents using AWS CDK v2
"""
import os
import sys
import subprocess
import time
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}{title:^70}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")


def run_command(cmd, cwd=None, check=True, env=None):
    """Run a shell command and handle errors"""
    print(f"{YELLOW}Running: {cmd}{RESET}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=check,
            env=env or os.environ.copy(),
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"{RED}Error: Command failed with exit code {e.returncode}{RESET}")
        return False


def main():
    """Main deployment function"""
    
    print_section("AWS CDK v2 Deployment - Data Catalog Agents")
    
    # Get project root
    project_root = Path(__file__).parent.parent
    cdk_dir = project_root / "infrastructure-v2"
    
    # Force region to us-east-1
    deploy_region = "us-east-1"
    env = os.environ.copy()
    env['CDK_DEFAULT_REGION'] = deploy_region
    env['AWS_REGION'] = deploy_region
    env['AWS_DEFAULT_REGION'] = deploy_region
    
    print(f"{GREEN}✓ Deployment Region: {deploy_region}{RESET}")
    print(f"{GREEN}✓ CDK Directory: {cdk_dir}{RESET}")
    
    # Step 1: Check prerequisites
    print_section("Step 1: Checking Prerequisites")
    
    prereqs = {
        'node': 'node --version',
        'npm': 'npm --version',
        'docker': 'docker --version',
        'aws': 'aws --version',
    }
    
    for tool, cmd in prereqs.items():
        if run_command(cmd, check=False):
            print(f"{GREEN}✓ {tool} is installed{RESET}")
        else:
            print(f"{RED}✗ {tool} is not installed or not in PATH{RESET}")
            print(f"{RED}Please install {tool} before proceeding{RESET}")
            sys.exit(1)
    
    # Step 2: Check Docker is running
    print_section("Step 2: Verifying Docker")
    if not run_command('docker ps', check=False):
        print(f"{RED}✗ Docker is not running{RESET}")
        print(f"{YELLOW}Please start Docker and try again{RESET}")
        sys.exit(1)
    print(f"{GREEN}✓ Docker is running{RESET}")
    
    # Step 3: Install CDK dependencies
    print_section("Step 3: Installing CDK Dependencies")
    if not run_command('npm install', cwd=cdk_dir, env=env):
        print(f"{RED}Failed to install npm dependencies{RESET}")
        sys.exit(1)
    print(f"{GREEN}✓ Dependencies installed{RESET}")
    
    # Step 4: Build TypeScript
    print_section("Step 4: Building TypeScript")
    if not run_command('npm run build', cwd=cdk_dir, env=env):
        print(f"{RED}Failed to build TypeScript{RESET}")
        sys.exit(1)
    print(f"{GREEN}✓ TypeScript compiled successfully{RESET}")
    
    # Step 5: Bootstrap CDK (if needed)
    print_section("Step 5: CDK Bootstrap Check")
    print(f"{YELLOW}Checking if CDK is bootstrapped in {deploy_region}...{RESET}")
    # Try to bootstrap - it's idempotent so safe to run
    run_command(f'npx cdk bootstrap --region {deploy_region}', cwd=cdk_dir, env=env, check=False)
    
    # Step 6: Deploy CDK Stacks
    print_section("Step 6: Deploying CDK Stacks")
    print(f"{YELLOW}This will take approximately 40-50 minutes{RESET}")
    print(f"{YELLOW}The deployment includes:{RESET}")
    print(f"  - Building Streamlit Docker image locally")
    print(f"  - Creating VPC and networking")
    print(f"  - Deploying RDS Aurora Serverless cluster")
    print(f"  - Setting up ECS services")
    print(f"  - Configuring ALB and Cognito")
    print(f"  - Deploying AgentCore MCP Runtimes\n")
    
    if not run_command('npx cdk deploy --all --require-approval never', cwd=cdk_dir, env=env):
        print(f"{RED}CDK deployment failed{RESET}")
        print(f"{YELLOW}Check CloudFormation console for details{RESET}")
        sys.exit(1)
    
    print(f"{GREEN}✓ CDK stacks deployed successfully{RESET}")
    
    # Step 7: Initialize Sample Data
    print_section("Step 7: Initializing Sample Data")
    
    # Get ALB DNS for Unity Catalog URL
    print(f"{BLUE}Getting Unity Catalog endpoint...{RESET}")
    alb_result = subprocess.run(
        f'aws cloudformation describe-stacks --stack-name CatalogAgentsComputeStack --region {deploy_region} --query "Stacks[0].Outputs[?OutputKey==\'AlbDnsName\'].OutputValue" --output text',
        shell=True,
        capture_output=True,
        text=True
    )
    
    if alb_result.returncode == 0 and alb_result.stdout.strip():
        alb_dns = alb_result.stdout.strip()
        unity_api_url = f"http://{alb_dns}/api/2.1/unity-catalog"
        
        print(f"{GREEN}✓ Unity Catalog URL: {unity_api_url}{RESET}")
        
        # Set environment variable for Unity setup script
        env_with_unity = env.copy()
        env_with_unity['UNITY_CATALOG_URL'] = unity_api_url
        
        print(f"{YELLOW}Waiting for Unity Catalog service to be ready...{RESET}")
        time.sleep(30)  # Give Unity Catalog time to fully start
        
        print(f"{YELLOW}Setting up Unity Catalog sample data...{RESET}")
        # Modify the script to use the AWS endpoint
        setup_script = project_root / 'setup' / 'setup_unity_sample_data.py'
        with open(setup_script, 'r') as f:
            script_content = f.read()
        
        # Check if script uses BASE_URL
        if 'BASE_URL' in script_content or 'localhost' in script_content:
            print(f"{BLUE}Note: Update setup/setup_unity_sample_data.py to use: {unity_api_url}{RESET}")
            print(f"{YELLOW}⚠ Unity Catalog sample data script expects localhost{RESET}")
            print(f"{YELLOW}  You can manually populate data through the Streamlit UI or Unity API{RESET}")
        else:
            if run_command('python setup/setup_unity_sample_data.py', cwd=project_root, env=env_with_unity, check=False):
                print(f"{GREEN}✓ Unity Catalog sample data initialized{RESET}")
            else:
                print(f"{YELLOW}⚠ Unity Catalog sample data initialization had issues{RESET}")
    else:
        print(f"{YELLOW}⚠ Could not get ALB DNS - skipping Unity sample data{RESET}")
    
    print(f"{YELLOW}Setting up Glue Catalog sample data...{RESET}")
    if run_command('python setup/setup_glue_sample_data.py', cwd=project_root, check=False):
        print(f"{GREEN}✓ Glue Catalog sample data initialized{RESET}")
    else:
        print(f"{YELLOW}⚠ Glue Catalog sample data initialization had issues (check logs){RESET}")
    
    # Step 8: Get Outputs
    print_section("Step 8: Deployment Complete!")
    
    print(f"{GREEN}✓ All stacks deployed successfully!{RESET}\n")
    
    print(f"{BLUE}Getting application URLs...{RESET}")
    result = subprocess.run(
        f'aws cloudformation describe-stacks --stack-name CatalogAgentsFrontendStack --region {deploy_region} --query "Stacks[0].Outputs[?OutputKey==\'StreamlitUrl\'].OutputValue" --output text',
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0 and result.stdout.strip():
        streamlit_url = result.stdout.strip()
        print(f"\n{GREEN}{'='*70}{RESET}")
        print(f"{GREEN}🎉 Deployment Successful!{RESET}")
        print(f"{GREEN}{'='*70}{RESET}")
        print(f"\n{BLUE}Streamlit Application:{RESET}")
        print(f"  {streamlit_url}")
        print(f"\n{BLUE}Next Steps:{RESET}")
        print(f"  1. Open the Streamlit URL in your browser")
        print(f"  2. Sign in with Cognito credentials")
        print(f"  3. Start querying your data catalogs!")
        print(f"\n{YELLOW}Note: You may need to check your email for Cognito credentials{RESET}")
        print(f"{GREEN}{'='*70}{RESET}\n")
    else:
        print(f"\n{YELLOW}Could not retrieve application URL automatically{RESET}")
        print(f"{YELLOW}Run this command to get the Streamlit URL:{RESET}")
        print(f"  aws cloudformation describe-stacks --stack-name CatalogAgentsFrontendStack --region {deploy_region} --query \"Stacks[0].Outputs[?OutputKey=='StreamlitUrl'].OutputValue\" --output text\n")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Deployment cancelled by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}Deployment failed: {str(e)}{RESET}")
        sys.exit(1)
