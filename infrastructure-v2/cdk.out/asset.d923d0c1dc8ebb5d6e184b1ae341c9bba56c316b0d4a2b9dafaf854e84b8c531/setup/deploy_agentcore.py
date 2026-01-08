#!/usr/bin/env python3
"""
Deploy MCP Servers to Amazon Bedrock AgentCore Runtime using the Toolkit
"""

import sys
import time
import json
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
    import subprocess
    result = subprocess.run(
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
    print(f"Configuring {server_name}...")
    response = runtime.configure(
        entrypoint=entrypoint_file,
        auto_create_execution_role=False,
        execution_role=agent_execution_role,
        auto_create_ecr=True,
        requirements_file="requirements.txt",
        region=region,
        agent_name=server_name
    )
    print(f"Configuration response: {response}")
    
    # Launch the runtime
    print(f"\nLaunching {server_name}...")
    launch_result = runtime.launch()
    print(f"Launch result: {launch_result}")
    
    # Wait for deployment to complete
    print(f"\nWaiting for {server_name} deployment...")
    status_response = runtime.status()
    status = status_response.endpoint['status']
    end_statuses = ['READY', 'CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED']
    
    while status not in end_statuses:
        time.sleep(10)
        status_response = runtime.status()
        status = status_response.endpoint['status']
        print(f"Status: {status}")
    
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

def deploy_mcp_servers():
    """Deploy both Unity and Glue MCP servers to AgentCore Runtime"""
    
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
    
    results = {}
    
    # Deploy Unity Catalog MCP Server
    try:
        unity_result = deploy_mcp_server(
            server_name=f'unityCatalogMcp_{unique_suffix}',
            entrypoint_file='mcp/unity_catalog_mcp_server.py',
            agent_execution_role=role_arn,
            region=aws_region
        )
        results['unity'] = unity_result
    except Exception as e:
        print(f"\n❌ Unity Catalog MCP deployment failed: {e}")
        sys.exit(1)
    
    # Deploy Glue Catalog MCP Server
    try:
        glue_result = deploy_mcp_server(
            server_name=f'glueCatalogMcp_{unique_suffix}',
            entrypoint_file='mcp/glue_catalog_mcp_server.py',
            agent_execution_role=role_arn,
            region=aws_region
        )
        results['glue'] = glue_result
    except Exception as e:
        print(f"\n❌ Glue Catalog MCP deployment failed: {e}")
        sys.exit(1)
    
    # Save runtime IDs to environment file
    env_content = f"""UNITY_MCP_RUNTIME_ID={results['unity']['runtime_id']}
GLUE_MCP_RUNTIME_ID={results['glue']['runtime_id']}
UNITY_MCP_ARN={results['unity']['runtime_arn']}
GLUE_MCP_ARN={results['glue']['runtime_arn']}
"""
    
    Path('.env').write_text(env_content)
    print(f"\n📝 Environment variables saved to .env file")
    
    # Save full configuration
    config = {
        'unity_mcp': {
            'runtime_id': results['unity']['runtime_id'],
            'runtime_arn': results['unity']['runtime_arn'],
            'region': aws_region
        },
        'glue_mcp': {
            'runtime_id': results['glue']['runtime_id'],
            'runtime_arn': results['glue']['runtime_arn'],
            'region': aws_region
        }
    }
    
    Path('agentcore-config.json').write_text(json.dumps(config, indent=2))
    print(f"📝 Full configuration saved to agentcore-config.json")
    
    # Update ECS task definition with runtime IDs
    print(f"\n🔄 Updating ECS task definition with AgentCore runtime IDs...")
    try:
        update_ecs_task_definition(results['unity']['runtime_id'], results['glue']['runtime_id'])
    except Exception as e:
        print(f"⚠️  Warning: Failed to update ECS task definition: {e}")
        print("   You may need to update it manually")
    
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
    try:
        results = deploy_mcp_servers()
        
        print(f"\n{'='*60}")
        print(f"🎉 DEPLOYMENT COMPLETE!")
        print(f"{'='*60}")
        print(f"\n📋 Summary:")
        print(f"  Unity MCP Runtime:")
        print(f"    ID:  {results['unity']['runtime_id']}")
        print(f"    ARN: {results['unity']['runtime_arn']}")
        print(f"\n  Glue MCP Runtime:")
        print(f"    ID:  {results['glue']['runtime_id']}")
        print(f"    ARN: {results['glue']['runtime_arn']}")
        print(f"\n✓ Configuration files saved:")
        print(f"  - .env (environment variables)")
        print(f"  - agentcore-config.json (full configuration)")
        print(f"  - .bedrock_agentcore.yaml (toolkit state)")
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
