#!/usr/bin/env python3
"""
Deploy MCP Servers to Amazon Bedrock AgentCore Runtime using the Toolkit
"""

import sys
import time
import json
import argparse
from pathlib import Path

try:
    from bedrock_agentcore_starter_toolkit import Runtime
except ImportError:
    print("❌ bedrock-agentcore-starter-toolkit is not installed")
    print("\nPlease install it with:")
    print("  pip install bedrock-agentcore-starter-toolkit")
    sys.exit(1)

def get_terraform_output(output_name):
    """Get output from Terraform"""
    import subprocess as sp
    result = sp.run(
        ['terraform', 'output', '-raw', output_name],
        cwd='deploy/terraform',
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise Exception(f"Failed to get terraform output {output_name}. Have you run 'terraform apply' yet?\nError: {result.stderr}")
    
    output = result.stdout.strip()
    if not output:
        raise Exception(f"Terraform output '{output_name}' is empty. Ensure terraform apply has completed successfully.")
    
    return output

def deploy_mcp_server(server_name, entrypoint_file, agent_execution_role, region='us-east-1'):
    """Deploy a single MCP server using the AgentCore toolkit"""
    
    print(f"\n{'='*60}")
    print(f"Deploying {server_name}")
    print(f"{'='*60}")
    
    runtime = Runtime()
    
    # Configure the runtime
    print(f"[DEBUG] Configuring {server_name}...")
    print(f"[DEBUG]   Entrypoint: {entrypoint_file}")
    print(f"[DEBUG]   Execution Role: {agent_execution_role}")
    print(f"[DEBUG]   Region: {region}")
    print(f"[DEBUG]   Agent Name: {server_name}")
    
    response = runtime.configure(
        entrypoint=entrypoint_file,
        auto_create_execution_role=False,
        execution_role=agent_execution_role,
        auto_create_ecr=True,
        requirements_file="requirements.txt",
        region=region,
        agent_name=server_name
    )
    print(f"[DEBUG] Configuration response: {response}")
    
    # Launch the runtime
    print(f"\n[DEBUG] About to call runtime.launch() for {server_name}...")
    launch_start = time.time()
    launch_result = runtime.launch()
    launch_duration = time.time() - launch_start
    print(f"[DEBUG] Launch completed in {launch_duration:.1f}s")
    print(f"Launch result: {launch_result}")
    
    # Wait for deployment to complete
    print(f"\n[DEBUG] Starting status monitoring for {server_name}...")
    status_check_start = time.time()
    print(f"[DEBUG] Calling runtime.status()...")
    status_response = runtime.status()
    print(f"[DEBUG] Initial status response received")
    status = status_response.endpoint['status']
    print(f"[DEBUG] Initial status: {status}")
    end_statuses = ['READY', 'CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED']
    
    poll_count = 0
    while status not in end_statuses:
        poll_count += 1
        elapsed = time.time() - status_check_start
        print(f"[DEBUG] Poll #{poll_count} - Waiting 10s (elapsed: {elapsed:.0f}s)...")
        time.sleep(10)
        print(f"[DEBUG] Calling runtime.status() again...")
        status_response = runtime.status()
        status = status_response.endpoint['status']
        print(f"[DEBUG] Status after {elapsed:.0f}s: {status}")
    
    if status != 'READY':
        raise Exception(f"{server_name} deployment failed with status: {status}")
    
    # Get runtime details
    agent_info = runtime.status()
    runtime_id = agent_info.endpoint.get('agentRuntimeId', '')
    runtime_arn = agent_info.endpoint.get('agentRuntimeArn', '')
    
    print(f"\n✅ {server_name} deployed successfully!")
    print(f"   Runtime ID: {runtime_id}")
    print(f"   Runtime ARN: {runtime_arn}")
    
    return {
        'runtime_id': runtime_id,
        'runtime_arn': runtime_arn,
        'runtime': runtime
    }

def deploy_mcp_servers(agent_type=None):
    """Deploy MCP servers to AgentCore Runtime
    
    Args:
        agent_type: 'unity', 'glue', or None (both)
    """
    
    print(f"\n🚀 Starting AgentCore MCP Server Deployment")
    print(f"   Using bedrock-agentcore-starter-toolkit\n")
    
    # Get infrastructure details from Terraform
    try:
        role_arn = get_terraform_output('agentcore_role_arn')
        aws_region = get_terraform_output('aws_region')
    except Exception as e:
        print(f"❌ Failed to get Terraform outputs: {e}")
        print("\nMake sure Terraform has been applied successfully:")
        print("  cd deploy/terraform && terraform apply")
        sys.exit(1)
    
    # Generate unique suffix for agent names to avoid conflicts
    import uuid
    unique_suffix = str(uuid.uuid4())[:8]
    
    print(f"Using:")
    print(f"  Execution Role: {role_arn}")
    print(f"  Region: {aws_region}")
    print(f"  Unique Suffix: {unique_suffix}")
    if agent_type:
        print(f"  Deploying: {agent_type} MCP only")
    
    results = {}
    
    # Deploy Unity Catalog MCP Server
    if not agent_type or agent_type == 'unity':
        try:
            unity_result = deploy_mcp_server(
                server_name=f'unity_catalog_mcp_{unique_suffix}',
                entrypoint_file='mcp/unity_catalog_mcp_server.py',
                agent_execution_role=role_arn,
                region=aws_region
            )
            results['unity'] = unity_result
        except Exception as e:
            print(f"\n❌ Unity Catalog MCP deployment failed: {e}")
            sys.exit(1)
    
    # Deploy Glue Catalog MCP Server
    if not agent_type or agent_type == 'glue':
        try:
            glue_result = deploy_mcp_server(
                server_name=f'glue_catalog_mcp_{unique_suffix}',
                entrypoint_file='mcp/glue_catalog_mcp_server.py',
                agent_execution_role=role_arn,
                region=aws_region
            )
            results['glue'] = glue_result
        except Exception as e:
            print(f"\n❌ Glue Catalog MCP deployment failed: {e}")
            sys.exit(1)
    
    # Load existing config if it exists (for incremental deployments)
    existing_config = {}
    if Path('agentcore-config.json').exists():
        with open('agentcore-config.json', 'r') as f:
            existing_config = json.load(f)
    
    # Build env content and config based on what was deployed
    env_lines = []
    config = existing_config.copy()
    
    if 'unity' in results:
        env_lines.extend([
            f"UNITY_MCP_RUNTIME_ID={results['unity']['runtime_id']}",
            f"UNITY_MCP_ARN={results['unity']['runtime_arn']}"
        ])
        config['unity_mcp'] = {
            'runtime_id': results['unity']['runtime_id'],
            'runtime_arn': results['unity']['runtime_arn'],
            'region': aws_region
        }
    
    if 'glue' in results:
        env_lines.extend([
            f"GLUE_MCP_RUNTIME_ID={results['glue']['runtime_id']}",
            f"GLUE_MCP_ARN={results['glue']['runtime_arn']}"
        ])
        config['glue_mcp'] = {
            'runtime_id': results['glue']['runtime_id'],
            'runtime_arn': results['glue']['runtime_arn'],
            'region': aws_region
        }
    
    env_content = '\n'.join(env_lines) + '\n'
    
    Path('.env').write_text(env_content)
    print(f"\n📝 Environment variables saved to .env file")
    
    Path('agentcore-config.json').write_text(json.dumps(config, indent=2))
    print(f"📝 Full configuration saved to agentcore-config.json")
    
    # Update ECS task definition with runtime IDs (only if both deployed)
    if 'unity' in results and 'glue' in results:
        print(f"\n🔄 Updating ECS task definition with AgentCore runtime IDs...")
        try:
            update_ecs_task_definition(results['unity']['runtime_id'], results['glue']['runtime_id'])
        except Exception as e:
            print(f"⚠️  Warning: Failed to update ECS task definition: {e}")
            print("   You may need to update it manually")
    elif agent_type:
        print(f"\nℹ️  Skipping ECS update - deploy both agents to update ECS task definition")
    
    return results

def update_ecs_task_definition(unity_runtime_id, glue_runtime_id):
    """Update the Streamlit ECS task definition with AgentCore runtime IDs"""
    import boto3
    
    ecs_client = boto3.client('ecs')
    
    # Get current task definition
    cluster_name = get_terraform_output('ecs_cluster_name')
    
    try:
        response = ecs_client.describe_task_definition(taskDefinition='streamlit-app')
        task_def = response['taskDefinition']
    except Exception as e:
        print(f"   Task definition 'streamlit-app' not found, skipping update")
        return
    
    # Get container definition
    container_defs = task_def['containerDefinitions']
    
    # Update environment variables
    for container in container_defs:
        if container['name'] == 'streamlit-app':
            # Add runtime IDs to environment
            env_vars = container.get('environment', [])
            
            # Remove any existing runtime ID entries
            env_vars = [e for e in env_vars if e['name'] not in ['UNITY_MCP_RUNTIME_ID', 'GLUE_MCP_RUNTIME_ID']]
            
            # Add new runtime IDs
            env_vars.extend([
                {'name': 'UNITY_MCP_RUNTIME_ID', 'value': unity_runtime_id},
                {'name': 'GLUE_MCP_RUNTIME_ID', 'value': glue_runtime_id}
            ])
            
            container['environment'] = env_vars
    
    # Register new task definition revision
    new_task_def = ecs_client.register_task_definition(
        family=task_def['family'],
        taskRoleArn=task_def['taskRoleArn'],
        executionRoleArn=task_def['executionRoleArn'],
        networkMode=task_def['networkMode'],
        containerDefinitions=container_defs,
        requiresCompatibilities=task_def['requiresCompatibilities'],
        cpu=task_def['cpu'],
        memory=task_def['memory']
    )
    
    print(f"   ✅ Created new task definition revision: {new_task_def['taskDefinition']['revision']}")
    
    # Update ECS service to use new task definition
    ecs_client.update_service(
        cluster=cluster_name,
        service='streamlit-app-service',
        taskDefinition=f"{task_def['family']}:{new_task_def['taskDefinition']['revision']}",
        forceNewDeployment=True
    )
    
    print(f"   ✅ Updated streamlit-app-service with new task definition")

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Deploy MCP servers to AgentCore')
    parser.add_argument('--agent', choices=['unity', 'glue'], 
                        help='Deploy specific agent (unity or glue). If not specified, deploys both.')
    args = parser.parse_args()
    
    try:
        results = deploy_mcp_servers(agent_type=args.agent)
        
        print(f"\n{'='*60}")
        print(f"🎉 DEPLOYMENT COMPLETE!")
        print(f"{'='*60}")
        print(f"\n📋 Summary:")
        
        if 'unity' in results:
            print(f"  Unity MCP Runtime:")
            print(f"    ID:  {results['unity']['runtime_id']}")
            print(f"    ARN: {results['unity']['runtime_arn']}")
        
        if 'glue' in results:
            print(f"\n  Glue MCP Runtime:")
            print(f"    ID:  {results['glue']['runtime_id']}")
            print(f"    ARN: {results['glue']['runtime_arn']}")
        
        print(f"\n✓ Configuration files saved:")
        print(f"  - .env (environment variables)")
        print(f"  - agentcore-config.json (full configuration)")
        if Path('.bedrock_agentcore.yaml').exists():
            print(f"  - .bedrock_agentcore.yaml (toolkit state)")
        
        if 'unity' in results and 'glue' in results:
            print(f"\n🚀 Your application is now configured to use AgentCore MCP servers")
            alb_dns = get_terraform_output('alb_dns_name')
            print(f"   Access via: https://{alb_dns}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ DEPLOYMENT FAILED")
        print(f"{'='*60}")
        print(f"Error: {e}")
        print(f"\nPlease check the error and try again.")
        print(f"{'='*60}\n")
        sys.exit(1)
