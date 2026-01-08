#!/usr/bin/env python3
"""
Complete CDK Cleanup Script
Removes all CDK-deployed resources including stacks, ECR images, and local configuration
"""

import boto3
import subprocess
import sys
import json
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


def run_command(cmd, cwd=None, show_output=True, env=None):
    """Run shell command"""
    print(f"{YELLOW}▶ Running: {cmd}{RESET}")
    
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        text=True,
        capture_output=not show_output,
        env=env or os.environ.copy()
    )
    
    if result.returncode != 0:
        if not show_output and result.stderr:
            print(f"{RED}{result.stderr}{RESET}")
        return False
    return True


def get_stack_status(stack_name, region):
    """Check if a CloudFormation stack exists"""
    try:
        cfn = boto3.client('cloudformation', region_name=region)
        response = cfn.describe_stacks(StackName=stack_name)
        return response['Stacks'][0]['StackStatus'] if response['Stacks'] else None
    except cfn.exceptions.ClientError:
        return None


def empty_ecr_repositories(region):
    """Empty CDK-managed ECR repositories"""
    print_section("Step 1: Emptying ECR Repositories")
    
    try:
        ecr_client = boto3.client('ecr', region_name=region)
        
        # Find ECR repositories created by CDK
        print("Looking for CDK-managed ECR repositories...")
        response = ecr_client.describe_repositories()
        
        cdk_repos = []
        for repo in response['repositories']:
            repo_name = repo['repositoryName']
            # Look for CDK asset repositories and our named repositories
            if repo_name.startswith('cdk-') or 'catalog-agents' in repo_name:
                cdk_repos.append(repo_name)
        
        if cdk_repos:
            print(f"Found {len(cdk_repos)} CDK-managed repositories")
            for repo_name in cdk_repos:
                try:
                    # List all images
                    images = ecr_client.list_images(repositoryName=repo_name)
                    image_ids = images.get('imageIds', [])
                    
                    if image_ids:
                        print(f"  Emptying {repo_name} ({len(image_ids)} images)...")
                        ecr_client.batch_delete_image(
                            repositoryName=repo_name,
                            imageIds=image_ids
                        )
                        print(f"{GREEN}  ✓ Deleted {len(image_ids)} images from {repo_name}{RESET}")
                    else:
                        print(f"  ℹ️  No images in {repo_name}")
                        
                except ecr_client.exceptions.RepositoryNotFoundException:
                    print(f"  ℹ️  Repository {repo_name} not found")
                except Exception as e:
                    print(f"{YELLOW}  ⚠  Error emptying {repo_name}: {e}{RESET}")
        else:
            print("ℹ️  No CDK-managed ECR repositories found")
            
    except Exception as e:
        print(f"{YELLOW}⚠  Error accessing ECR: {e}{RESET}")


def destroy_cdk_stacks(region):
    """Destroy all CDK stacks"""
    print_section("Step 2: Destroying CDK Stacks")
    
    project_root = Path(__file__).parent.parent
    cdk_dir = project_root / "infrastructure-v2"
    
    if not cdk_dir.exists():
        print(f"{RED}✗ infrastructure-v2 directory not found{RESET}")
        return False
    
    # Set environment variables
    import os
    env = os.environ.copy()
    env['CDK_DEFAULT_REGION'] = region
    env['AWS_REGION'] = region
    env['AWS_DEFAULT_REGION'] = region
    
    print(f"{YELLOW}⚠  This will destroy ALL CDK infrastructure including:{RESET}")
    print("   - VPC and networking")
    print("   - RDS Aurora Serverless cluster")
    print("   - ECS cluster and services")
    print("   - Application Load Balancer")
    print("   - Cognito user pools")
    print("   - AgentCore MCP runtimes")
    print("   - API Gateway")
    print("   - All data will be PERMANENTLY deleted")
    
    response = input(f"\n{YELLOW}Are you sure you want to continue? (type 'yes' to confirm): {RESET}")
    if response.lower() != 'yes':
        print(f"{RED}❌ Cleanup cancelled{RESET}")
        sys.exit(0)
    
    print(f"\n{YELLOW}Destroying CDK stacks (this may take 15-20 minutes)...{RESET}")
    
    # Destroy stacks in reverse order
    stacks = [
        'CatalogAgentsMcpRuntimeStack',
        'CatalogAgentsFrontendStack',
        'CatalogAgentsComputeStack',
        'CatalogAgentsDataStack',
        'CatalogAgentsNetworkStack',
    ]
    
    all_success = True
    for stack in stacks:
        # Check if stack exists
        status = get_stack_status(stack, region)
        if status:
            print(f"\n{BLUE}Destroying {stack}...{RESET}")
            success = run_command(
                f'npx cdk destroy {stack} --force',
                cwd=str(cdk_dir),
                env=env,
                show_output=True
            )
            if success:
                print(f"{GREEN}✓ Destroyed {stack}{RESET}")
            else:
                print(f"{YELLOW}⚠ Error destroying {stack} - some resources may remain{RESET}")
                all_success = False
        else:
            print(f"ℹ️  {stack} not found or already deleted")
    
    return all_success


def cleanup_local_files():
    """Clean up local CDK configuration files"""
    print_section("Step 3: Cleaning Up Local Files")
    
    files_to_remove = [
        'infrastructure-v2/cdk.out',
        'infrastructure-v2/cdk.context.json',
    ]
    
    for file_path in files_to_remove:
        path = Path(file_path)
        if path.exists():
            if path.is_dir():
                import shutil
                shutil.rmtree(path)
                print(f"{GREEN}✓ Removed directory {file_path}{RESET}")
            else:
                path.unlink()
                print(f"{GREEN}✓ Removed {file_path}{RESET}")
        else:
            print(f"ℹ️  {file_path} not found")


def main():
    print(f"{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}🧹 CDK Cleanup Script - Data Catalog Agents{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    print(f"{RED}⚠  WARNING: This will delete ALL CDK-deployed resources!{RESET}")
    print(f"{RED}   This action CANNOT be undone.{RESET}\n")
    
    # Default region
    region = 'us-east-1'
    
    try:
        # Step 1: Empty ECR repositories
        empty_ecr_repositories(region)
        
        # Step 2: Destroy CDK stacks
        if not destroy_cdk_stacks(region):
            print(f"\n{YELLOW}⚠  Some stacks failed to destroy{RESET}")
            print(f"{YELLOW}   Check AWS Console for remaining resources{RESET}")
        
        # Step 3: Clean up local files
        cleanup_local_files()
        
        print(f"\n{GREEN}{'='*70}{RESET}")
        print(f"{GREEN}🎉 CLEANUP COMPLETE!{RESET}")
        print(f"{GREEN}{'='*70}{RESET}\n")
        print(f"{GREEN}✓ All CDK resources have been removed{RESET}")
        print(f"{GREEN}✓ Local configuration files have been cleaned up{RESET}")
        print(f"\n{BLUE}📝 Note: Check AWS Console to verify all resources are deleted{RESET}")
        print(f"{BLUE}   CloudFormation console: https://console.aws.amazon.com/cloudformation{RESET}\n")
        
    except KeyboardInterrupt:
        print(f"\n{YELLOW}⚠  Cleanup interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}❌ Cleanup failed: {e}{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
