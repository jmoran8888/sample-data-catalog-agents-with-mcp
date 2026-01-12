#!/usr/bin/env python3
"""
Complete AWS Cleanup Script
Removes all deployed resources including CodeBuild, ECR, and Terraform infrastructure

NOTE: AgentCore runtimes must be deleted manually before running this script.
See README.md for instructions.
"""

import boto3
import subprocess
import sys
import json
from pathlib import Path

def run_command(cmd, cwd=None, check=False, show_output=False):
    """Run shell command and return output"""
    print(f"▶ Running: {cmd}")
    
    if show_output:
        result = subprocess.run(cmd, shell=True, cwd=cwd, text=True)
        return result.returncode == 0
    else:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        if check and result.returncode != 0:
            print(f"⚠️  Command failed: {result.stderr}")
        return result.stdout.strip()

def get_terraform_output(output_name, default=None):
    """Get output from Terraform with fallback to default"""
    result = subprocess.run(
        ['terraform', 'output', '-raw', output_name],
        cwd='deploy/terraform',
        capture_output=True,
        text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        output = result.stdout.strip()
        # Check if output looks like an error message
        if '│' in output or 'Warning' in output or 'Error' in output:
            return default
        return output
    return default

def delete_codebuild_projects():
    """Delete CodeBuild projects created by AgentCore toolkit"""
    print("\n" + "=" * 60)
    print("STEP 1: Deleting CodeBuild Projects")
    print("=" * 60)
    
    try:
        region = get_terraform_output('aws_region', default='us-east-1')
        codebuild = boto3.client('codebuild', region_name=region)
        
        print("Searching for AgentCore CodeBuild projects...")
        
        # List all CodeBuild projects
        response = codebuild.list_projects()
        project_names = response.get('projects', [])
        
        # Find projects created by AgentCore toolkit (pattern: bedrock-agentcore-*-builder)
        toolkit_projects = []
        for project_name in project_names:
            if 'bedrock-agentcore' in project_name.lower() and '-builder' in project_name.lower():
                toolkit_projects.append(project_name)
        
        if toolkit_projects:
            print(f"Found {len(toolkit_projects)} AgentCore CodeBuild projects:")
            for project in toolkit_projects:
                try:
                    print(f"  Deleting: {project}")
                    codebuild.delete_project(name=project)
                    print(f"  ✅ Deleted CodeBuild project: {project}")
                except Exception as e:
                    print(f"  ⚠️  Error deleting {project}: {e}")
        else:
            print("ℹ️  No AgentCore CodeBuild projects found")
            
    except Exception as e:
        print(f"⚠️  Error accessing CodeBuild: {e}")

def cleanup_agentcore_enis():
    """Clean up ENIs created by AgentCore that may be blocking VPC deletion"""
    print("\n" + "=" * 60)
    print("STEP 2: Cleaning Up AgentCore Network Interfaces")
    print("=" * 60)
    
    try:
        region = get_terraform_output('aws_region', default='us-east-1')
        ec2_client = boto3.client('ec2', region_name=region)
        
        print("Checking for AgentCore ENIs...")
        
        # Find ENIs with agentic_ai type
        response = ec2_client.describe_network_interfaces(
            Filters=[
                {
                    'Name': 'interface-type',
                    'Values': ['agentic_ai']
                }
            ]
        )
        
        enis = response.get('NetworkInterfaces', [])
        
        if enis:
            print(f"Found {len(enis)} AgentCore ENIs")
            for eni in enis:
                eni_id = eni['NetworkInterfaceId']
                status = eni['Status']
                print(f"  ENI {eni_id} - Status: {status}")
                
                if status == 'in-use':
                    print(f"  ⚠️  ENI {eni_id} still in use - waiting for AgentCore cleanup...")
                    # ENIs will be auto-deleted when runtimes are fully deleted
                    # Wait a bit for AWS to clean them up
                    import time
                    time.sleep(30)
                    
                    # Check again
                    try:
                        check = ec2_client.describe_network_interfaces(NetworkInterfaceIds=[eni_id])
                        if check['NetworkInterfaces']:
                            print(f"  ℹ️  ENI {eni_id} still exists - will be cleaned up with VPC")
                    except ec2_client.exceptions.ClientError:
                        print(f"  ✅ ENI {eni_id} has been cleaned up")
                elif status == 'available':
                    try:
                        print(f"  Deleting available ENI {eni_id}...")
                        ec2_client.delete_network_interface(NetworkInterfaceId=eni_id)
                        print(f"  ✅ Deleted ENI {eni_id}")
                    except Exception as e:
                        print(f"  ⚠️  Could not delete ENI {eni_id}: {e}")
        else:
            print("ℹ️  No AgentCore ENIs found")
            
    except Exception as e:
        print(f"⚠️  Error checking ENIs: {e}")

def empty_ecr_repositories():
    """Empty and delete ECR repositories"""
    print("\n" + "=" * 60)
    print("STEP 3: Cleaning Up ECR Repositories")
    print("=" * 60)
    
    try:
        aws_region = get_terraform_output('aws_region', default='us-east-1')
        ecr_client = boto3.client('ecr', region_name=aws_region)
        
        # Find ALL repos in account and categorize them
        all_repos = []
        toolkit_repos = []
        project_repos = []
        
        try:
            print("Listing all ECR repositories in account...")
            response = ecr_client.describe_repositories()
            all_repos = [repo['repositoryName'] for repo in response['repositories']]
            
            for repo_name in all_repos:
                if 'bedrock-agentcore' in repo_name.lower():
                    toolkit_repos.append(repo_name)
                elif 'catalog-agents' in repo_name.lower():
                    project_repos.append(repo_name)
        except Exception as e:
            print(f"⚠️  Could not list ECR repositories: {e}")
        
        # Empty project repos (catalog-agents/streamlit-app only) - Terraform will delete them
        # Note: AgentCore MCP repos are created by toolkit with randomized names (bedrock-agentcore-*)
        streamlit_repo = 'catalog-agents/streamlit-app'
        if streamlit_repo in project_repos:
            try:
                print(f"  Emptying: {streamlit_repo}...")
                images = ecr_client.list_images(repositoryName=streamlit_repo)
                image_ids = images.get('imageIds', [])
                if image_ids:
                    ecr_client.batch_delete_image(repositoryName=streamlit_repo, imageIds=image_ids)
                    print(f"  ✅ Deleted {len(image_ids)} images (Terraform will delete repo)")
                else:
                    print(f"  ℹ️  No images to delete")
            except ecr_client.exceptions.RepositoryNotFoundException:
                print(f"  ℹ️  Repository not found")
            except Exception as e:
                print(f"  ⚠️  Error: {e}")
        else:
            print("ℹ️  Streamlit ECR repository not found")
        
        # Delete toolkit-created repos (bedrock-agentcore-*)
        if toolkit_repos:
            print(f"Found {len(toolkit_repos)} toolkit ECR repositories")
            for repo_name in toolkit_repos:
                try:
                    print(f"  Deleting: {repo_name}...")
                    ecr_client.delete_repository(repositoryName=repo_name, force=True)
                    print(f"  ✅ Deleted repository and all images")
                except ecr_client.exceptions.RepositoryNotFoundException:
                    print(f"  ℹ️  Repository not found")
                except Exception as e:
                    print(f"  ⚠️  Error: {e}")
        
        if not project_repos and not toolkit_repos:
            print("ℹ️  No ECR repositories found")
                
    except Exception as e:
        print(f"⚠️  Error accessing ECR: {e}")

def destroy_terraform():
    """Destroy Terraform infrastructure"""
    print("\n" + "=" * 60)
    print("STEP 4: Destroying Terraform Infrastructure")
    print("=" * 60)
    
    terraform_dir = Path("deploy/terraform")
    if not terraform_dir.exists():
        print("⚠️  deploy/terraform directory not found")
        return
    
    print("⚠️  This will destroy ALL infrastructure including:")
    print("   - VPC and networking")
    print("   - RDS database")
    print("   - ECS cluster and services")
    print("   - ALB and security groups")
    print("   - All data will be PERMANENTLY deleted")
    
    response = input("\nAre you sure you want to continue? (type 'yes' to confirm): ")
    if response.lower() != 'yes':
        print("❌ Cleanup cancelled")
        sys.exit(0)
    
    print("\nDestroying Terraform resources (this may take 5-10 minutes)...")
    success = run_command("terraform destroy -auto-approve", cwd=str(terraform_dir), show_output=True)
    
    if success:
        print("✅ Terraform infrastructure destroyed")
    else:
        print("⚠️  Terraform destroy encountered errors - some resources may remain")

def cleanup_local_files():
    """Clean up local configuration files"""
    print("\n" + "=" * 60)
    print("STEP 5: Cleaning Up Local Files")
    print("=" * 60)
    
    files_to_remove = [
        '.env',
        'agentcore-config.json',
        '.bedrock_agentcore.yaml'
    ]
    
    for file_path in files_to_remove:
        path = Path(file_path)
        if path.exists():
            path.unlink()
            print(f"✅ Removed {file_path}")
        else:
            print(f"ℹ️  {file_path} not found")

def main():
    print("🧹 Starting Complete AWS Cleanup\n")
    print("⚠️  WARNING: This will delete ALL deployed resources!")
    print("   This action CANNOT be undone.\n")
    
    print("⚠️  NOTE: AgentCore runtimes must be deleted manually BEFORE running this script.")
    print("   See README.md 'Manual Cleanup Steps' section for instructions.\n")
    
    try:
        # Step 1: Delete CodeBuild projects
        delete_codebuild_projects()
        
        # Step 2: Clean up AgentCore ENIs
        cleanup_agentcore_enis()
        
        # Step 3: Delete ECR repositories
        empty_ecr_repositories()
        
        # Step 4: Destroy Terraform infrastructure
        destroy_terraform()
        
        # Step 5: Clean up local files
        cleanup_local_files()
        
        print("\n" + "=" * 60)
        print("🎉 CLEANUP COMPLETE!")
        print("=" * 60)
        print("\n✅ All AWS resources have been removed")
        print("\n✅ Local configuration files have been cleaned up")
        print("\n📝 Note: Check AWS Console to verify all resources are deleted")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Cleanup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
