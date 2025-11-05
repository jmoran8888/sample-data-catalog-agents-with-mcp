#!/usr/bin/env python3
"""
Deploy MCP Servers to Amazon Bedrock AgentCore Runtime
"""

import boto3
import json
import subprocess
import time
import uuid
from pathlib import Path

def get_terraform_output(output_name):
    """Get output from Terraform"""
    result = subprocess.run(
        ['terraform', 'output', '-raw', output_name],
        cwd='deploy/terraform',
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise Exception(f"Failed to get terraform output {output_name}: {result.stderr}")
    return result.stdout.strip()

def deploy_mcp_servers():
    """Deploy both Unity and Glue MCP servers to AgentCore Runtime"""
    
    # Initialize AgentCore client
    client = boto3.client('bedrock-agentcore-control')
    
    # Generate unique names to avoid conflicts
    unique_suffix = str(uuid.uuid4())[:8]
    
    # Get infrastructure details from Terraform
    role_arn = get_terraform_output('agentcore_role_arn')
    security_group_id = get_terraform_output('agentcore_security_group_id')
    private_subnet_ids = get_terraform_output('private_subnet_ids')
    unity_ecr_uri = get_terraform_output('unity_mcp_ecr_uri')
    glue_ecr_uri = get_terraform_output('glue_mcp_ecr_uri')
    
    # Parse subnet IDs (they come as JSON array)
    subnet_ids = json.loads(private_subnet_ids)
    
    print("Deploying Unity Catalog MCP Server...")
    
    unity_response = client.create_agent_runtime(
        agentRuntimeName=f'unityCatalogMcp_{unique_suffix}',
        description='Unity Catalog MCP Server for data discovery',
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': f"{unity_ecr_uri}:latest"
            }
        },
        roleArn=role_arn,
        networkConfiguration={
            'networkMode': 'VPC',
            'networkModeConfig': {
                'securityGroups': [security_group_id],
                'subnets': subnet_ids
            }
        },
        protocolConfiguration={
            'serverProtocol': 'MCP'
        },
        environmentVariables={
            'UNITY_CATALOG_URL': 'http://localhost:8080'
        },
        tags={
            'Project': 'catalog-agents-demo',
            'Component': 'unity-catalog-mcp',
            'Environment': 'dev'
        }
    )
    
    unity_runtime_id = unity_response['agentRuntimeId']
    print(f"Unity MCP Server deployed: {unity_runtime_id}")
    
    print("Deploying Glue Catalog MCP Server...")
    
    glue_response = client.create_agent_runtime(
        agentRuntimeName=f'glueCatalogMcp_{unique_suffix}',
        description='AWS Glue Catalog MCP Server for data discovery',
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': f"{glue_ecr_uri}:latest"
            }
        },
        roleArn=role_arn,
        networkConfiguration={
            'networkMode': 'VPC',
            'networkModeConfig': {
                'securityGroups': [security_group_id],
                'subnets': subnet_ids
            }
        },
        protocolConfiguration={
            'serverProtocol': 'MCP'
        },
        tags={
            'Project': 'catalog-agents-demo',
            'Component': 'glue-catalog-mcp',
            'Environment': 'dev'
        }
    )
    
    glue_runtime_id = glue_response['agentRuntimeId']
    print(f"Glue MCP Server deployed: {glue_runtime_id}")
    
    print("Waiting for deployments to complete...")
    
    # Poll for runtime status instead of using waiter
    import time
    
    def wait_for_runtime(runtime_id, timeout=300):
        start_time = time.time()
        while time.time() - start_time < timeout:
            response = client.get_agent_runtime(agentRuntimeId=runtime_id)
            status = response['status']
            print(f"Runtime {runtime_id} status: {status}")
            
            if status == 'READY':
                return True
            elif status in ['CREATE_FAILED', 'UPDATE_FAILED']:
                raise Exception(f"Runtime {runtime_id} failed with status: {status}")
            
            time.sleep(10)
        
        raise Exception(f"Timeout waiting for runtime {runtime_id}")
    
    wait_for_runtime(unity_runtime_id)
    wait_for_runtime(glue_runtime_id)
    
    # Get runtime details to extract endpoints
    unity_details = client.get_agent_runtime(agentRuntimeId=unity_runtime_id)
    glue_details = client.get_agent_runtime(agentRuntimeId=glue_runtime_id)
    
    # AgentCore runtimes don't have direct HTTP endpoints, they use MCP protocol
    # We'll create endpoint URLs for the unified agent to connect to
    unity_url = f"mcp://agentcore/{unity_runtime_id}"
    glue_url = f"mcp://agentcore/{glue_runtime_id}"
    
    print(f"\n✅ Deployment Complete!")
    print(f"Unity Catalog MCP Runtime: {unity_runtime_id}")
    print(f"Glue Catalog MCP Runtime: {glue_runtime_id}")
    
    # Save runtime IDs to environment file
    env_content = f"""UNITY_MCP_RUNTIME_ID={unity_runtime_id}
GLUE_MCP_RUNTIME_ID={glue_runtime_id}
UNITY_MCP_URL={unity_url}
GLUE_MCP_URL={glue_url}
"""
    
    Path('.env').write_text(env_content)
    print(f"\n📝 Environment variables saved to .env file")
    
    return {
        'unity_url': unity_url,
        'glue_url': glue_url,
        'unity_runtime_id': unity_runtime_id,
        'glue_runtime_id': glue_runtime_id
    }

if __name__ == "__main__":
    try:
        result = deploy_mcp_servers()
        print(f"\n🚀 Next steps:")
        print(f"1. Build and push MCP server Docker images")
        print(f"2. Update your ECS task definition with the runtime IDs")
        print(f"3. Deploy your Streamlit application")
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        raise
