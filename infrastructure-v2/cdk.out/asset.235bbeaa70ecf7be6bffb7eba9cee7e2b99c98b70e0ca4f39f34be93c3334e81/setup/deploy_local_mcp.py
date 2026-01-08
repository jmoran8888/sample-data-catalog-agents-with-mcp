#!/usr/bin/env python3
"""
Deploy MCP Servers as ECS services instead of AgentCore
"""

import boto3
import json

def deploy_mcp_services():
    """Deploy MCP servers as ECS services"""
    
    # For now, create mock URLs that point to the existing services
    # The unified agent will connect to these endpoints
    
    # Get ALB DNS name from Terraform
    import subprocess
    result = subprocess.run(['terraform', 'output', '-raw', 'alb_dns_name'], 
                          cwd='deploy/terraform', capture_output=True, text=True)
    alb_dns = result.stdout.strip()
    
    # Create environment file with service URLs
    unity_url = f"https://{alb_dns}/api/2.1/unity-catalog"
    glue_url = f"https://{alb_dns}/api/2.1/glue-catalog"  # We'll add this endpoint
    
    env_content = f"""UNITY_MCP_URL={unity_url}
GLUE_MCP_URL={glue_url}
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print(f"✅ MCP URLs configured:")
    print(f"Unity Catalog MCP URL: {unity_url}")
    print(f"Glue Catalog MCP URL: {glue_url}")
    print(f"📝 Environment variables saved to .env file")
    
    return {
        'unity_url': unity_url,
        'glue_url': glue_url
    }

if __name__ == "__main__":
    try:
        result = deploy_mcp_services()
        print(f"\n🚀 Next steps:")
        print(f"1. Run ./deploy/scripts/deploy_agentcore.sh to update ECS")
        print(f"2. Access your application via the secure HTTPS URL")
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        raise
