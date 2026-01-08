#!/bin/bash
set -e

echo "🚀 Deploying MCP Servers to Amazon Bedrock AgentCore Runtime"

# Install AgentCore SDK if not already installed
pip install --quiet bedrock-agentcore-starter-toolkit

# Deploy MCP servers
python deploy_agentcore.py

# Source the environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
    echo "✅ Environment variables loaded"
fi

# Update ECS task definition with new environment variables
echo "📝 Updating ECS task definition..."

# Get current task definition
TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster $(cd deploy/terraform && terraform output -raw ecs_cluster_name) \
    --services streamlit-app-service \
    --query 'services[0].taskDefinition' \
    --output text)

# Get task definition JSON
aws ecs describe-task-definition \
    --task-definition $TASK_DEF_ARN \
    --query 'taskDefinition' > current_task_def.json

# Update environment variables in task definition
python -c "
import json
import os

with open('current_task_def.json', 'r') as f:
    task_def = json.load(f)

# Remove fields that can't be used in register-task-definition
for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def.pop(field, None)

# Update environment variables
for container in task_def['containerDefinitions']:
    if container['name'] == 'streamlit-app':
        env_vars = container.get('environment', [])
        
        # Remove existing MCP URLs
        env_vars = [e for e in env_vars if e['name'] not in ['UNITY_MCP_URL', 'GLUE_MCP_URL']]
        
        # Add new MCP URLs
        if os.getenv('UNITY_MCP_URL'):
            env_vars.append({'name': 'UNITY_MCP_URL', 'value': os.getenv('UNITY_MCP_URL')})
        if os.getenv('GLUE_MCP_URL'):
            env_vars.append({'name': 'GLUE_MCP_URL', 'value': os.getenv('GLUE_MCP_URL')})
        
        container['environment'] = env_vars

with open('updated_task_def.json', 'w') as f:
    json.dump(task_def, f, indent=2)
"

# Register new task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://updated_task_def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

# Update ECS service
aws ecs update-service \
    --cluster $(cd deploy/terraform && terraform output -raw ecs_cluster_name) \
    --service streamlit-app-service \
    --task-definition $NEW_TASK_DEF_ARN \
    --force-new-deployment

echo "🎉 Deployment complete!"
echo "🔗 Unity MCP URL: $UNITY_MCP_URL"
echo "🔗 Glue MCP URL: $GLUE_MCP_URL"

# Cleanup
rm -f current_task_def.json updated_task_def.json

echo "✅ AgentCore Runtime deployment finished successfully!"
