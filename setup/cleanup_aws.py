#!/usr/bin/env python3
"""
Complete AWS Cleanup Script
Removes all deployed resources including AgentCore runtimes, Terraform infrastructure, and ECR images
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

def delete_agentcore_runtimes():
    """Delete AgentCore runtimes"""
    print("\n" + "=" * 60)
    print("STEP 1: Deleting AgentCore Runtimes")
    print("=" * 60)
    
    try:
        import boto3
        
        # Load runtime IDs from config file or .env
        runtime_ids = []
        
        # Try agentcore-config.json first
        config_file = Path('agentcore-config.json')
        if config_file.exists():
            print("Loading runtime IDs from agentcore-config.json...")
            with open(config_file, 'r') as f:
                config = json.load(f)
                unity_id = config.get('unity_mcp', {}).get('runtime_id')
                glue_id = config.get('glue_mcp', {}).get('runtime_id')
                if unity_id:
                    runtime_ids.append(('Unity', unity_id))
                if glue_id:
                    runtime_ids.append(('Glue', glue_id))
        
        # Try .env file as fallback
        if not runtime_ids:
            env_file = Path('.env')
            if env_file.exists():
                print("Loading runtime IDs from .env...")
                with open(env_file, 'r') as f:
                    for line in f:
                        if 'UNITY_MCP_RUNTIME_ID=' in line:
                            unity_id = line.split('=')[1].strip()
                            runtime_ids.append(('Unity', unity_id))
                        elif 'GLUE_MCP_RUNTIME_ID=' in line:
                            glue_id = line.split('=')[1].strip()
                            runtime_ids.append(('Glue', glue_id))
        
        if not runtime_ids:
            print("ℹ️  No runtime IDs found in config files")
            print("   Checking for any AgentCore runtimes in your account...")
            
            # List all runtimes and find catalog-related ones
            region = get_terraform_output('aws_region', default='us-east-1')
            client = boto3.client('bedrock-agentcore-control', region_name=region)
            
            try:
                response = client.list_agent_runtimes(maxResults=50)
                for runtime in response.get('agentRuntimeSummaries', []):
                    name = runtime.get('agentRuntimeName', '')
                    runtime_id = runtime.get('agentRuntimeId', '')
                    if 'catalogmcp' in name.lower() or 'unitymcp' in name.lower() or 'gluemcp' in name.lower():
                        runtime_ids.append((name, runtime_id))
                        print(f"   Found: {name} ({runtime_id})")
            except Exception as e:
                print(f"⚠️  Could not list runtimes: {e}")
        
        # Delete found runtimes
        if runtime_ids:
            region = get_terraform_output('aws_region', default='us-east-1')
            client = boto3.client('bedrock-agentcore-control', region_name=region)
            
            for name, runtime_id in runtime_ids:
                try:
                    print(f"Deleting {name} runtime: {runtime_id}")
                    client.delete_agent_runtime(agentRuntimeId=runtime_id)
                    print(f"  Waiting for deletion to complete...")
                    
                    # Wait for deletion to complete
                    import time
                    max_wait = 180  # 3 minutes
                    waited = 0
                    while waited < max_wait:
                        try:
                            response = client.get_agent_runtime(agentRuntimeId=runtime_id)
                            status = response.get('status', '')
                            if status == 'DELETING':
                                print(f"  Status: {status} (waiting...)")
                                time.sleep(10)
                                waited += 10
                            else:
                                break
                        except client.exceptions.ResourceNotFoundException:
                            # Runtime no longer exists - deletion complete
                            print(f"✅ Deleted {name} MCP runtime")
                            break
                        except Exception:
                            # If we can't check status, assume it's deleted
                            break
                    
                    if waited >= max_wait:
                        print(f"⚠️  Timeout waiting for {name} deletion (may still be in progress)")
                        
                except client.exceptions.ResourceNotFoundException:
                    print(f"ℹ️  {name} runtime already deleted")
                except Exception as e:
                    print(f"⚠️  Could not delete {name} runtime: {e}")
        else:
            print("ℹ️  No AgentCore runtimes found to delete")
            
    except Exception as e:
        print(f"⚠️  Error deleting AgentCore runtimes: {e}")

def delete_codebuild_projects():
    """Delete CodeBuild projects created by AgentCore toolkit"""
    print("\n" + "=" * 60)
    print("STEP 2: Deleting CodeBuild Projects")
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
    print("STEP 3: Cleaning Up AgentCore Network Interfaces")
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
    """Empty ECR repositories before Terraform destroy"""
    print("\n" + "=" * 60)
    print("STEP 4: Emptying ECR Repositories")
    print("=" * 60)
    
    try:
        aws_region = get_terraform_output('aws_region', default='us-east-1')
        ecr_client = boto3.client('ecr', region_name=aws_region)
        
        # Get ECR repository names from Terraform
        repos = []
        unity_ecr = get_terraform_output('unity_mcp_ecr_uri')
        glue_ecr = get_terraform_output('glue_mcp_ecr_uri')
        streamlit_ecr = get_terraform_output('ecr_repository_url')
        
        if unity_ecr:
            repos.append(unity_ecr.split('/')[-1])
        if glue_ecr:
            repos.append(glue_ecr.split('/')[-1])
        if streamlit_ecr:
            repos.append(streamlit_ecr.split('/')[-1])
        
        # Also check for toolkit-created repos
        try:
            response = ecr_client.describe_repositories()
            for repo in response['repositories']:
                if 'bedrock-agentcore' in repo['repositoryName'].lower():
                    repos.append(repo['repositoryName'])
        except Exception as e:
            print(f"⚠️  Could not list ECR repositories: {e}")
        
        # Delete all images in each repository
        for repo_name in set(repos):  # Use set to avoid duplicates
            try:
                print(f"Emptying {repo_name}...")
                
                # List all images
                images = ecr_client.list_images(repositoryName=repo_name)
                image_ids = images.get('imageIds', [])
                
                if image_ids:
                    # Delete all images
                    ecr_client.batch_delete_image(
                        repositoryName=repo_name,
                        imageIds=image_ids
                    )
                    print(f"  ✅ Deleted {len(image_ids)} images from {repo_name}")
                else:
                    print(f"  ℹ️  No images in {repo_name}")
                    
            except ecr_client.exceptions.RepositoryNotFoundException:
                print(f"  ℹ️  Repository {repo_name} not found")
            except Exception as e:
                print(f"  ⚠️  Error emptying {repo_name}: {e}")
                
    except Exception as e:
        print(f"⚠️  Error accessing ECR: {e}")

def destroy_terraform():
    """Destroy Terraform infrastructure"""
    print("\n" + "=" * 60)
    print("STEP 5: Destroying Terraform Infrastructure")
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
    print("   - ECR repositories")
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
    print("STEP 6: Cleaning Up Local Files")
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
    
    try:
        # Step 1: Delete AgentCore runtimes
        delete_agentcore_runtimes()
        
        # Step 2: Delete CodeBuild projects
        delete_codebuild_projects()
        
        # Step 3: Clean up AgentCore ENIs
        cleanup_agentcore_enis()
        
        # Step 4: Empty ECR repositories
        empty_ecr_repositories()
        
        # Step 5: Destroy Terraform infrastructure
        destroy_terraform()
        
        # Step 6: Clean up local files
        cleanup_local_files()
        
        print("\n" + "=" * 60)
        print("🎉 CLEANUP COMPLETE!")
        print("=" * 60)
        print("\n✅ All AWS resources have been removed")
        print("✅ Local configuration files have been cleaned up")
        print("\n📝 Note: Check AWS Console to verify all resources are deleted")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Cleanup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
