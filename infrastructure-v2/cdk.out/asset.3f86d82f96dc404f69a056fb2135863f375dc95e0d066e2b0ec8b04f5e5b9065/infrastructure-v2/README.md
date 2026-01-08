# Data Catalog Agents - CDK Infrastructure (v2)

Complete AWS CDK infrastructure for Data Catalog Agents with MCP (Model Context Protocol) servers running on AgentCore Runtimes.

## Architecture Overview

This infrastructure converts the original Terraform deployment to AWS CDK v2, implementing the semantic-layer pattern for MCP server deployment via AgentCore Runtimes.

### Stack Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. NetworkStack: VPC, Subnets, Security Groups                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. DataStack: RDS Aurora Serverless v2, Glue Catalog, S3       │
├─────────────────────────────────────────────────────────────────┤
│ 3. ComputeStack: ECS (Unity Catalog + Streamlit)               │
├─────────────────────────────────────────────────────────────────┤
│ 4. FrontendStack: ALB + Cognito Authentication                 │
├─────────────────────────────────────────────────────────────────┤
│ 5. McpRuntimeStack: AgentCore Runtimes + API Gateway           │
│    - Unity Catalog MCP Runtime                                  │
│    - Glue Catalog MCP Runtime                                   │
│    - Lambda Proxies                                             │
│    - API Gateway (IAM Auth)                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools
- Node.js 18+ and npm
- AWS CDK CLI 2.233.0+
- AWS CLI configured with credentials
- Docker (for building Streamlit image)
- Python 3.12+ (for MCP servers)

### AWS Account Setup

1. **Bootstrap CDK (if not already done):**
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```

2. **AgentCore Availability Zones (Automatic):**
   
   The infrastructure **automatically detects** AgentCore-compatible AZs for supported regions:
   - ✅ **us-east-1** (use1-az1, use1-az2, use1-az4)
   - ✅ **us-west-2** (usw2-az1, usw2-az2, usw2-az3)
   - ✅ **eu-west-1** (euw1-az1, euw1-az2, euw1-az3)
   
   **For other regions:** Add the region configuration to `lib/agentcore-azs.ts`:
   ```bash
   # Find Zone IDs for your region
   aws ec2 describe-availability-zones --region YOUR-REGION \
     --query "AvailabilityZones[*].[ZoneName, ZoneId, State]" \
     --output table
   
   # Then add to lib/agentcore-azs.ts AGENTCORE_ZONE_IDS mapping
   ```
   
   **Manual Override:** If needed, override AZs via CDK context:
   ```bash
   npx cdk deploy -c agentCoreAz1=us-east-1a -c agentCoreAz2=us-east-1b -c agentCoreAz3=us-east-1d
   ```

## Configuration

### 1. Create CDK Context File (Optional)

Create `infrastructure-v2/cdk.context.json` for optional configuration:

```json
{
  "databaseName": "unitycatalog",
  "databaseUsername": "unitycatalog",
  "adminEmail": "your-email@example.com"
}
```

**Note:** AgentCore AZs are now **automatically detected** based on your deployment region!

If you need to override the automatic AZ detection, add:
```json
{
  "agentCoreAz1": "us-east-1a",
  "agentCoreAz2": "us-east-1b",
  "agentCoreAz3": "us-east-1d"
}
```

### 2. Streamlit Docker Image (Fully Automated)

The Streamlit Docker image is **automatically built and pushed** during CDK deployment!

CDK's built-in Docker asset support:
- ✅ Automatically builds Docker image from local source (Dockerfile.streamlit)
- ✅ Automatically pushes to ECR during deployment
- ✅ Creates temporary ECR repository
- ✅ Manages image lifecycle

**No manual Docker commands required!** CDK handles everything when you run `cdk deploy CatalogAgentsComputeStack`.

**Requirements:**
- Docker must be installed and running on your local machine
- CDK will execute `docker build` locally during deployment

## Deployment

### Quick Start - Deploy All Stacks

```bash
cd infrastructure-v2

# Install dependencies
npm install

# Verify configuration
npm run build

# Synthesize CloudFormation templates
npx cdk synth

# Deploy all stacks
npx cdk deploy --all --require-approval never
```

### Step-by-Step Deployment

If you prefer to deploy stacks one at a time:

```bash
# 1. Network infrastructure
npx cdk deploy CatalogAgentsNetworkStack

# 2. Data layer
npx cdk deploy CatalogAgentsDataStack

# 3. Compute layer (CDK automatically builds Streamlit Docker image locally)
npx cdk deploy CatalogAgentsComputeStack
# Note: CDK will build the Docker image locally and push to ECR automatically

# 4. Frontend layer
npx cdk deploy CatalogAgentsFrontendStack

# 5. MCP Runtime layer
npx cdk deploy CatalogAgentsMcpRuntimeStack
```

### Deployment with Custom Parameters

You can override context values via command line:

```bash
npx cdk deploy --all \
  -c agentCoreAz1=us-east-1a \
  -c agentCoreAz2=us-east-1b \
  -c agentCoreAz3=us-east-1d \
  -c adminEmail=admin@example.com
```

## Post-Deployment Setup

### 1. Initialize Sample Data

After successful deployment, populate the databases with sample data:

```bash
# Unity Catalog sample data
python ../setup/setup_unity_sample_data.py

# Glue Catalog sample data  
python ../setup/setup_glue_sample_data.py
```

### 2. Access the Application

Get the Streamlit URL from stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name CatalogAgentsFrontendStack \
  --query "Stacks[0].Outputs[?OutputKey=='StreamlitUrl'].OutputValue" \
  --output text
```

### 3. Cognito User Setup

If you provided `adminEmail` in context:
1. Check your email for temporary password
2. Navigate to the Streamlit URL
3. Sign in with your email and temporary password
4. Set a new permanent password

## Stack Outputs

### NetworkStack
- VPC ID
- Subnet IDs (Public and Private)

### DataStack
- RDS Cluster Endpoint
- RDS Secret ARN
- Glue Database Names
- S3 Bucket Name

### ComputeStack
- ECS Cluster Name
- ECR Repository URI (for Streamlit)
- Service Names

### FrontendStack
- ALB DNS Name
- Streamlit URL (HTTPS)
- Unity Catalog API URL
- Cognito User Pool ID

### McpRuntimeStack
- Unity MCP Runtime ARN
- Glue MCP Runtime ARN
- MCP API Gateway URL
- MCP Endpoints

## Testing

### Test Streamlit UI
```bash
# Get ALB URL
STREAMLIT_URL=$(aws cloudformation describe-stacks \
  --stack-name CatalogAgentsFrontendStack \
  --query "Stacks[0].Outputs[?OutputKey=='StreamlitUrl'].OutputValue" \
  --output text)

echo "Access: $STREAMLIT_URL"
```

### Test Unity Catalog API
```bash
# Get Unity Catalog URL
UNITY_URL=$(aws cloudformation describe-stacks \
  --stack-name CatalogAgentsFrontendStack \
  --query "Stacks[0].Outputs[?OutputKey=='UnityCatalogUrl'].OutputValue" \
  --output text)

# Test (requires Cognito authentication)
curl -X GET "$UNITY_URL/catalogs"
```

### Test MCP API
```bash
# Get MCP API URL
MCP_URL=$(aws cloudformation describe-stacks \
  --stack-name CatalogAgentsMcpRuntimeStack \
  --query "Stacks[0].Outputs[?OutputKey=='McpApiUrl'].OutputValue" \
  --output text)

# Test Unity MCP (requires IAM authentication)
aws apigatewayv2 invoke \
  --api-id <api-id> \
  --stage prod \
  --request-uri /unity/databases \
  response.json
```

## Cleanup

To destroy all resources:

```bash
# Delete all stacks in reverse order
npx cdk destroy CatalogAgentsMcpRuntimeStack
npx cdk destroy CatalogAgentsFrontendStack
npx cdk destroy CatalogAgentsComputeStack
npx cdk destroy CatalogAgentsDataStack
npx cdk destroy CatalogAgentsNetworkStack

# Or destroy all at once
npx cdk destroy --all
```

## Project Structure

```
infrastructure-v2/
├── bin/
│   └── infrastructure-v2.ts      # CDK app entry point
├── lib/
│   ├── types.ts                  # Shared type definitions
│   ├── network-stack.ts          # VPC, subnets, security groups
│   ├── data-stack.ts             # RDS, Glue, S3
│   ├── compute-stack.ts          # ECS, Unity Catalog, Streamlit
│   ├── frontend-stack.ts         # ALB, Cognito
│   └── mcp-runtime-stack.ts      # AgentCore Runtimes, API Gateway
├── lambda/
│   └── mcp-proxy/                # Lambda proxy for MCP runtimes
│       ├── index.py
│       └── requirements.txt
├── cdk.json                      # CDK configuration
├── cdk.context.json              # Context values (create this)
├── package.json
└── README.md                     # This file
```

## Key Features

### Infrastructure
- ✅ VPC with public/private subnets across 2 AZs
- ✅ RDS Aurora Serverless v2 PostgreSQL (auto-scaling 0.5-2 ACU)
- ✅ AWS Glue Data Catalog (3 databases, 3 tables)
- ✅ ECS Fargate for Unity Catalog and Streamlit
- ✅ Application Load Balancer with Cognito authentication
- ✅ Self-signed HTTPS certificate

### MCP Servers (Semantic-Layer Pattern)
- ✅ Unity Catalog MCP Runtime on AgentCore
- ✅ Glue Catalog MCP Runtime on AgentCore
- ✅ Lambda proxy functions for API Gateway integration
- ✅ API Gateway with IAM authentication
- ✅ VPC networking with AgentCore-compatible subnets

### Automated Build & Deployment
- ✅ **CDK Docker Assets**: Streamlit image automatically built from local source
- ✅ **Zero Manual Steps**: CDK handles Docker build and ECR push
- ✅ **Local Build**: Faster builds using your local Docker daemon
- ✅ **Multi-Region Ready**: Works in any configured region

### Security
- ✅ All resources in private subnets (except ALB)
- ✅ Security group rules follow least privilege
- ✅ RDS credentials in Secrets Manager
- ✅ Cognito authentication for web access
- ✅ IAM authentication for MCP API
- ✅ Encryption at rest (RDS, S3)
- ✅ HTTPS/TLS for all external communication

## Multi-Region Support

### Automatic Region Detection

The infrastructure includes **automatic AgentCore AZ detection** for supported regions:

**Currently Supported:**
- 🌎 **us-east-1** (N. Virginia)
- 🌎 **us-west-2** (Oregon)
- 🌍 **eu-west-1** (Ireland)

When deploying to a supported region, the infrastructure automatically selects the correct AgentCore-compatible AZs.

### Adding Support for New Regions

To deploy to a region not yet configured:

1. **Find AgentCore Zone IDs:**
   ```bash
   aws ec2 describe-availability-zones --region YOUR-REGION \
     --query "AvailabilityZones[*].[ZoneName, ZoneId, State]" \
     --output table
   ```

2. **Update `lib/agentcore-azs.ts`:**
   ```typescript
   'YOUR-REGION': [
     { zoneId: 'zone-id-1', fallbackAzName: 'your-region-1a' },
     { zoneId: 'zone-id-2', fallbackAzName: 'your-region-1b' },
     { zoneId: 'zone-id-3', fallbackAzName: 'your-region-1c' },
   ],
   ```

3. **Deploy:**
   ```bash
   npx cdk deploy --all
   ```

### Region-Specific Deployment

Deploy to a specific region:

```bash
# Set region via environment variable
export CDK_DEFAULT_REGION=us-west-2
npx cdk deploy --all

# Or specify in deployment command
npx cdk deploy --all --region us-west-2
```

## Differences from Terraform

1. **RDS**: Using Aurora Serverless v2 instead of db.t3.micro (better auto-scaling)
2. **MCP Deployment**: Using AgentCore Runtimes instead of CodeBuild/CloudFormation
3. **Certificate**: Using ACM-managed certificate (Terraform used self-signed)
4. **Tags**: Consistent tagging across all resources
5. **Multi-Region**: Dynamic AZ detection for AgentCore compatibility

## Troubleshooting

### Issue: CDK Deploy Fails with AZ Error
**Solution:** Verify your AgentCore-compatible AZs are correctly set in `cdk.context.json`

### Issue: Streamlit Container Fails to Start
**Solution:** Ensure the Streamlit Docker image is built and pushed to ECR before deploying ComputeStack

### Issue: Cognito Authentication Fails
**Solution:** Check that the ALB DNS name is correctly set in Cognito callback URLs

### Issue: MCP Runtime Fails to Start
**Solution:** Verify that `mcp/unity-catalog-server/` and `mcp/glue-catalog-server/` contain valid `requirements.txt` files

## Support

For issues or questions:
1. Check `IMPLEMENTATION_STATUS.md` for detailed implementation notes
2. Review CloudWatch logs for specific stack components
3. Consult the original Terraform files in `deploy/terraform/` for reference

## License

See LICENSE file in repository root.
