# Deployment Guide - Data Catalog Agents CDK

## Force Deployment to us-east-1

Your AWS credentials are defaulting to us-east-2. Here are three ways to deploy to us-east-1:

### Option 1: Set Environment Variable (Recommended)
```bash
cd infrastructure-v2
export CDK_DEFAULT_REGION=us-east-1
npx cdk deploy --all
```

### Option 2: Use AWS Profile with us-east-1
```bash
cd infrastructure-v2
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
npx cdk deploy --all
```

### Option 3: Specify Region in Command
```bash
cd infrastructure-v2
npx cdk deploy --all --region us-east-1
```

## Quick Deployment Steps

```bash
cd infrastructure-v2

# 1. Install dependencies (one time)
npm install

# 2. Set region to us-east-1
export CDK_DEFAULT_REGION=us-east-1

# 3. Verify configuration
npm run build

# 4. Deploy all stacks
npx cdk deploy --all

# You'll be prompted to approve security changes and IAM role creations
# Type 'y' to proceed
```

## What Gets Deployed

1. **NetworkStack** (~5 min)
   - VPC, subnets, security groups
   - Automatically uses us-east-1a, us-east-1b, us-east-1d for AgentCore

2. **DataStack** (~10 min)
   - RDS Aurora Serverless v2 cluster
   - AWS Glue databases and tables
   - S3 bucket

3. **ComputeStack** (~15-20 min)
   - **Builds Streamlit Docker image locally** (this takes time)
   - Pushes to ECR
   - Creates ECS cluster and services
   - Creates Application Load Balancer

4. **FrontendStack** (~5 min)
   - Cognito User Pool
   - Configures ALB authentication

5. **McpRuntimeStack** (~10 min)
   - Unity Catalog MCP Runtime
   - Glue Catalog MCP Runtime
   - Lambda proxies
   - API Gateway

**Total Deployment Time: ~40-50 minutes**

## Post-Deployment

```bash
# Initialize sample data
python ../setup/setup_unity_sample_data.py
python ../setup/setup_glue_sample_data.py

# Get application URL
aws cloudformation describe-stacks \
  --stack-name CatalogAgentsFrontendStack \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='StreamlitUrl'].OutputValue" \
  --output text
```

## Troubleshooting

### Issue: "Region us-east-2 is not configured"
**Solution**: Set environment variable before deploying:
```bash
export CDK_DEFAULT_REGION=us-east-1
```

### Issue: Docker build fails
**Solution**: Ensure Docker is running:
```bash
docker ps  # Should not error
```

### Issue: Permission denied
**Solution**: Ensure AWS credentials have necessary permissions for:
- EC2, VPC, ECS, RDS, Glue, S3, IAM, CloudFormation

## Cleanup

```bash
cd infrastructure-v2
export CDK_DEFAULT_REGION=us-east-1
npx cdk destroy --all
```

## Region-Specific Notes

### us-east-1 (Configured)
- AgentCore AZs: us-east-1a, us-east-1b, us-east-1d
- Ready to deploy

### us-west-2 (Configured)
```bash
export CDK_DEFAULT_REGION=us-west-2
npx cdk deploy --all
```

### eu-west-1 (Configured)
```bash
export CDK_DEFAULT_REGION=eu-west-1
npx cdk deploy --all
```

### Other Regions
Add configuration to `lib/agentcore-azs.ts` first (see README.md)
