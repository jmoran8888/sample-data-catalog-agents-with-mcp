# CDK Infrastructure Implementation Status

## Overview
Converting Terraform infrastructure to AWS CDK v2 with semantic-layer pattern for MCP servers.

## Implementation Progress: 60% Complete

### ✅ Completed Components

#### 1. Project Setup
- [x] Created v2 branch
- [x] Initialized CDK TypeScript project
- [x] Installed required dependencies:
  - aws-cdk-lib@^2.233.0
  - @aws-cdk/aws-bedrock-agentcore-alpha
  - @aws-cdk/aws-neptune-alpha
- [x] Created directory structure

#### 2. NetworkStack (`lib/network-stack.ts`) ✅
**Status:** Complete and compiling

**Resources Created:**
- VPC (10.0.0.0/16) with DNS enabled
- 2 Public subnets (10.0.0.0/24, 10.0.1.0/24)
- 2 Private subnets (10.0.10.0/24, 10.0.11.0/24)
- NAT Gateway (1 for cost optimization)
- Internet Gateway
- S3 Gateway Endpoint
- Security Groups:
  - RDS Security Group
  - ECS Security Group
  - ALB Security Group
  - MCP Security Group (for AgentCore Runtimes)
- AgentCore-compatible subnet selection (awaits AZ configuration)

**Configuration Required:**
- AgentCore-compatible AZ names for us-east-1 (use1-az1, use1-az2, use1-az4)
- Set via CDK context or props

#### 3. DataStack (`lib/data-stack.ts`) ✅
**Status:** Complete and compiling

**Resources Created:**
- RDS Aurora Serverless v2 PostgreSQL 15.8
  - Database: unitycatalog
  - Credentials in Secrets Manager
  - Min capacity: 0.5 ACU, Max: 2 ACU
  - 7-day backup retention
  - Encryption enabled
- AWS Glue Catalog:
  - customer_database
  - sales_database
  - analytics_database
- Glue Tables:
  - customer_profile (in customer_database)
  - customer_orders (in sales_database)
  - daily_sales_summary (in analytics_database)
- S3 Bucket for Glue data (versioned, encrypted)

**Outputs:**
- RDS cluster endpoint and ARN
- RDS secret ARN
- Glue database names
- S3 bucket name

#### 4. ComputeStack (`lib/compute-stack.ts`) ✅
**Status:** Complete and compiling

**Resources Created:**
- ECS Cluster (catalog-agents-cluster)
  - Container Insights enabled
- IAM Roles:
  - Task Execution Role (with ECS execution policy)
  - Task Role (with Glue + Bedrock permissions)
- ECR Repository:
  - catalog-agents/streamlit-app
- CloudWatch Log Groups:
  - /ecs/unity-catalog (7-day retention)
  - /ecs/streamlit-app (7-day retention)
- Unity Catalog Task Definition:
  - Image: unitycatalog/unitycatalog:latest
  - 1024 CPU, 2048 MB memory
  - Port 8080
  - Environment: RDS connection details from Secrets Manager
- Streamlit Task Definition:
  - Image: from ECR
  - 512 CPU, 1024 MB memory
  - Port 8501
- Target Groups for ALB:
  - Unity Catalog TG (port 8080)
  - Streamlit TG (port 8501)
- ECS Services:
  - Unity Catalog Service (Fargate)
  - Streamlit Service (Fargate)

**Outputs:**
- ECS cluster name
- ECR repository URI
- Service names

#### 5. Shared Types (`lib/types.ts`) ✅
Type definitions for stack outputs and inter-stack communication.

### 🚧 Remaining Components (40%)

#### 6. FrontendStack (`lib/frontend-stack.ts`) - NOT STARTED
**Needs Implementation:**

```typescript
- Application Load Balancer
  - Internet-facing
  - Public subnets
  - HTTP (80) and HTTPS (443) listeners
- ALB Routing Rules:
  - /api/2.1/unity-catalog/* → Unity Catalog Target Group
  - /* (default) → Streamlit Target Group
- Cognito User Pool:
  - Email as username
  - Password policy (min 8, lowercase/uppercase/numbers/symbols)
- Cognito User Pool Client
- Cognito User Pool Domain (hosted UI)
- ALB Listener with Cognito authentication
- Self-signed certificate for HTTPS (or ACM certificate)
```

**Reference:** See `deploy/terraform/alb.tf` and `cognito.tf`

#### 7. McpRuntimeStack (`lib/mcp-runtime-stack.ts`) - NOT STARTED
**Needs Implementation (Semantic-Layer Pattern):**

```typescript
// Unity Catalog MCP Runtime
const unityMcpRuntime = new agentcore.Runtime(this, 'UnityMcpRuntime', {
  runtimeName: 'unity_catalog_mcp',
  agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
    path.join(__dirname, '../../mcp/unity-catalog-server')
  ),
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
    vpcSubnets: { subnets: agentCoreCompatibleSubnets },
    securityGroups: [mcpSecurityGroup],
  }),
  executionRole: unityMcpRuntimeRole,
  environmentVariables: {
    UNITY_CATALOG_URL: albUnityEndpoint,
    AWS_REGION: 'us-east-1',
  },
});

// Glue Catalog MCP Runtime
const glueMcpRuntime = new agentcore.Runtime(this, 'GlueMcpRuntime', {
  runtimeName: 'glue_catalog_mcp',
  agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
    path.join(__dirname, '../../mcp/glue-catalog-server')
  ),
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
    vpc: vpc,
    vpcSubnets: { subnets: agentCoreCompatibleSubnets },
    securityGroups: [mcpSecurityGroup],
  }),
  executionRole: glueMcpRuntimeRole,
  environmentVariables: {
    AWS_REGION: 'us-east-1',
  },
});

// Lambda Proxy Functions (for API Gateway)
// API Gateway with IAM auth
```

**Reference:** See `~/SourceCode/semantic-layer/infrastructure/lib/semantic-layer-stack.ts`

#### 8. Lambda Proxy Function (`lambda/mcp-proxy/`) - NOT STARTED
**Needs Implementation:**

```python
# lambda/mcp-proxy/index.py
import json
import boto3
import os

def lambda_handler(event, context):
    """
    Proxy Lambda to invoke AgentCore Runtime
    """
    runtime_arn = os.environ['RUNTIME_ARN']
    
    # Invoke AgentCore Runtime
    client = boto3.client('bedrock-agentcore')
    
    response = client.invoke_agent_runtime(
        agentRuntimeArn=runtime_arn,
        inputText=event.get('body', '{}'),
        # Additional parameters as needed
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': {
            'Content-Type': 'application/json'
        }
    }
```

**Reference:** See semantic-layer Lambda proxy implementations

#### 9. Main CDK App (`bin/catalog-agents.ts`) - NEEDS UPDATE
Current file is default template. Needs to instantiate all stacks:

```typescript
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { McpRuntimeStack } from '../lib/mcp-runtime-stack';

const app = new cdk.App();

// Network Stack
const networkStack = new NetworkStack(app, 'CatalogAgentsNetworkStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  // Set AgentCore AZs via context or props
  agentCoreAz1: app.node.tryGetContext('agentCoreAz1'),
  agentCoreAz2: app.node.tryGetContext('agentCoreAz2'),
  agentCoreAz3: app.node.tryGetContext('agentCoreAz3'),
});

// Data Stack
const dataStack = new DataStack(app, 'CatalogAgentsDataStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  networkOutputs: networkStack.outputs,
});

// Compute Stack
const computeStack = new ComputeStack(app, 'CatalogAgentsComputeStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  networkOutputs: networkStack.outputs,
  dataOutputs: dataStack.outputs,
});

// Frontend Stack
const frontendStack = new FrontendStack(app, 'CatalogAgentsFrontendStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  networkOutputs: networkStack.outputs,
  computeOutputs: computeStack.outputs,
  unityCatalogTargetGroup: computeStack.unityCatalogTargetGroup,
  streamlitTargetGroup: computeStack.streamlitTargetGroup,
});

// MCP Runtime Stack
const mcpRuntimeStack = new McpRuntimeStack(app, 'CatalogAgentsMcpRuntimeStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  networkOutputs: networkStack.outputs,
  frontendOutputs: frontendStack.outputs,
});
```

#### 10. MCP Server Preparation - PARTIAL
**Already Compatible:**
- `mcp/unity_catalog_mcp_server.py` uses FastMCP ✅
- `mcp/glue_catalog_mcp_server.py` uses FastMCP ✅
- Both use `stateless_http=True` ✅
- Both run on port 8080 ✅

**Still Needed:**
- [ ] Add `requirements.txt` to `mcp/unity-catalog-server/`
- [ ] Add `requirements.txt` to `mcp/glue-catalog-server/`
- [ ] Ensure all dependencies are listed

#### 11. Context Configuration (`cdk.context.json`) - NOT STARTED
```json
{
  "agentCoreAz1": "us-east-1a",
  "agentCoreAz2": "us-east-1b", 
  "agentCoreAz3": "us-east-1d",
  "databaseName": "unitycatalog",
  "databaseUsername": "unitycatalog"
}
```

**Note:** AZ names must be determined by running:
```bash
aws ec2 describe-availability-zones --region us-east-1 \
  --query "AvailabilityZones[*].[ZoneName, ZoneId, State]" --output table
```
Map use1-az1, use1-az2, use1-az4 to your account's AZ names.

## Next Steps

### Immediate (High Priority)
1. **Get AgentCore-compatible AZs:**
   ```bash
   aws ec2 describe-availability-zones --region us-east-1
   ```
   Map use1-az1, use1-az2, use1-az4 to AZ names

2. **Implement FrontendStack:**
   - Reference: `deploy/terraform/alb.tf` and `cognito.tf`
   - Create ALB with Cognito authentication
   - Configure routing rules

3. **Implement McpRuntimeStack:**
   - Reference: `~/SourceCode/semantic-layer/infrastructure/lib/semantic-layer-stack.ts`
   - Create Unity MCP Runtime
   - Create Glue MCP Runtime
   - Create Lambda proxies
   - Create API Gateway

4. **Update Main App:**
   - Edit `bin/infrastructure-v2.ts`
   - Instantiate all stacks
   - Configure dependencies

### Before Deployment
1. **Add MCP requirements.txt:**
   ```bash
   # In mcp/unity-catalog-server/
   mcp>=1.0.0
   fastmcp
   boto3
   
   # In mcp/glue-catalog-server/
   mcp>=1.0.0
   fastmcp
   boto3
   ```

2. **Create cdk.context.json**

3. **Build Streamlit Docker image:**
   ```bash
   cd /path/to/streamlit
   docker build -t streamlit-app .
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
   docker tag streamlit-app:latest <account>.dkr.ecr.us-east-1.amazonaws.com/catalog-agents/streamlit-app:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/catalog-agents/streamlit-app:latest
   ```

### Deployment Order
```bash
cd infrastructure-v2

# 1. Synthesize to verify
npx cdk synth

# 2. Deploy stacks in order
npx cdk deploy CatalogAgentsNetworkStack
npx cdk deploy CatalogAgentsDataStack
npx cdk deploy CatalogAgentsComputeStack
npx cdk deploy CatalogAgentsFrontendStack
npx cdk deploy CatalogAgentsMcpRuntimeStack

# Or deploy all at once
npx cdk deploy --all
```

### Post-Deployment
1. **Run data initialization scripts:**
   ```bash
   python setup/setup_unity_sample_data.py
   python setup/setup_glue_sample_data.py
   ```

2. **Test Streamlit UI:**
   - Access via ALB DNS
   - Test Cognito authentication
   - Verify Unity Catalog connectivity

3. **Test MCP API:**
   - Get API Gateway URL from outputs
   - Test Unity MCP endpoints
   - Test Glue MCP endpoints

## Files Created
```
infrastructure-v2/
├── lib/
│   ├── types.ts                 ✅ Complete
│   ├── network-stack.ts         ✅ Complete
│   ├── data-stack.ts            ✅ Complete
│   ├── compute-stack.ts         ✅ Complete
│   ├── frontend-stack.ts        ⏳ TODO
│   └── mcp-runtime-stack.ts     ⏳ TODO
├── lambda/
│   └── mcp-proxy/
│       ├── index.py             ⏳ TODO
│       └── requirements.txt     ⏳ TODO
├── bin/
│   └── infrastructure-v2.ts     ⏳ Needs Update
├── cdk.context.json             ⏳ TODO
└── package.json                 ✅ Complete
```

## Key Architectural Decisions

### Matches Terraform Exactly
- VPC CIDR: 10.0.0.0/16
- Subnet layout matches Terraform
- Security group rules identical
- RDS configuration matches (using Aurora Serverless v2 instead of t3.micro)
- Glue databases and tables match
- ECS task definitions match

### New: Semantic-Layer MCP Pattern
- AgentCore Runtimes instead of CodeBuild/CloudFormation approach
- Lambda proxy pattern for API Gateway integration
- VPC configuration with AgentCore-compatible AZs
- IAM auth for API Gateway

## Estimated Remaining Effort
- FrontendStack: 2-3 hours
- McpRuntimeStack: 3-4 hours
- Lambda proxy: 1 hour
- Main app updates: 30 minutes
- Testing & debugging: 2-3 hours
- **Total: 8-11 hours**

## Questions / Issues
1. ❓ AgentCore-compatible AZs need to be determined for your AWS account
2. ❓ Cognito user pool - do you want to auto-create admin user?
3. ❓ SSL certificate - self-signed or use ACM?
4. ❓ Should we keep FIS stack (fault injection)?

## Resources
- Terraform files: `deploy/terraform/`
- Semantic-layer reference: `~/SourceCode/semantic-layer/infrastructure/`
- MCP servers: `mcp/unity-catalog-server/`, `mcp/glue-catalog-server/`
