# CDK Deployment for Catalog Agents Demo

This directory contains AWS CDK (Cloud Development Kit) code that deploys the same infrastructure as the Terraform deployment.

## Prerequisites

- Python 3.9+
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS CLI configured

## Install Dependencies

```bash
cd deploy/cdk
pip install -r requirements.txt
```

## Architecture

The infrastructure is organized into separate stacks:

- **NetworkStack**: VPC, subnets, Internet Gateway, NAT Gateway
- **SecurityStack**: Security groups with IP whitelisting
- **DatabaseStack**: RDS PostgreSQL for Unity Catalog
- **StorageStack**: S3 bucket for Glue, ECR repositories
- **ComputeStack**: ECS cluster, task definitions
- **LoadBalancerStack**: ALB with HTTPS, target groups
- **EcsServicesStack**: ECS services for Unity Catalog and Streamlit
- **AgentCoreStack**: IAM roles and ECR for AgentCore MCP servers
- **GlueStack**: Glue catalog databases and tables

## Deployment

Use the automated deployment script:

```bash
python setup/deploy_aws_cdk.py
```

This script will:
1. Auto-detect your IPv4 address
2. Deploy all CDK stacks with IP whitelisting
3. Build and push Streamlit Docker image
4. Deploy MCP servers to AgentCore
5. Populate sample data

## Cleanup

```bash
# Step 1: Manually delete AgentCore runtimes (see main README)
aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id <id> --region us-east-1

# Step 2: Run automated cleanup
python setup/cleanup_aws_cdk.py
```

## Comparison with Terraform

This CDK deployment creates the exact same AWS resources as the Terraform deployment. Choose based on your preference:

- **Terraform**: Declarative, widely used, mature
- **CDK**: Programmatic, type-safe, AWS-native

Both deployments support:
- IP-based security group whitelisting
- Automatic IPv4 detection
- AgentCore MCP server deployment
- Complete cleanup scripts
