# Catalog Agents Demo

This project demonstrates how to build agents using the AWS Strands SDK that help users find data products in both the AWS Glue catalog and the Unity catalog. It also showcases how to use MCP to wrap agents as tools for a supervisor agent.

## Architecture Documentation

Comprehensive architecture diagrams are available in the following files:

- [Architecture Diagrams Overview](architecture_diagrams_README.md) - Index and guide to all architecture documentation
- [High-Level Architecture](architecture_diagrams.md) - System architecture overview and data flow sequence
- [Technical Data Flow](technical_data_flow.md) - Detailed component interaction and data transformation
- [Implementation Details](implementation_details.md) - Code structure, classes, and interfaces

These diagrams provide a detailed view of how the agents work together and how they interact with the data catalogs.

## Features

### AWS Glue Catalog Agent
- Search for databases in the AWS Glue catalog
- Search for tables by database name
- Search for tables by table name pattern
- Search for tables by column names
- Get detailed information about specific tables

### Unity Catalog Agent
- Search for databases (schemas) in the Unity catalog
- Search for tables by database name (in format 'catalog_name.schema_name')
- Search for tables by table name pattern
- Search for tables by column names
- Get detailed information about specific tables
- Interacts with the Unity catalog API running on port 8080

### Unified Catalog Agent
- Uses MCP to interact with both the Unity and AWS Glue catalog agents
- Provides a single interface for querying both catalogs
- Intelligently routes queries to the appropriate catalog(s)
- Combines results from both catalogs when needed
- Handles the differences between Unity's three-level namespace and Glue's two-level namespace

### Common Features
- JSON-formatted responses for easy parsing
- Consistent interface across all catalog agents
- MCP servers for wrapping agents as tools

## Deployment Options

This project supports two deployment modes:

### 1. Local Development (Quick Start)
Follow the setup instructions below for local development and testing.

### 2. AWS Account Deployment

Deploy to AWS with complete managed infrastructure:
- **ECS Fargate**: Runs Unity Catalog and Streamlit applications
- **RDS PostgreSQL**: Metadata storage
- **Internal Application Load Balancer**: Private load balancer (not internet-facing)
- **AWS Systems Manager (SSM)**: Secure access via port forwarding
- **AWS Bedrock AgentCore Runtime**: Executes MCP servers
- **VPC**: Isolated network with public/private subnets

**Access Method**: No public internet access - uses AWS SSM port forwarding from your local machine (requires Session Manager plugin installation).

**See "AWS Deployment" section below for complete instructions.**
**Review [SECURITY.md](SECURITY.md) before deploying.**

## Local Development Setup

### 1. Environment Setup

Create and activate a virtual environment:
```bash
uv venv .venv
source .venv/bin/activate  # On Linux/macOS
# .venv\Scripts\activate     # On Windows
```

Install requirements:
```bash
uv pip install -r requirements.txt
```

### 2. Configure AWS Profile

Make sure your AWS profile is set up correctly with permissions to access the AWS Glue catalog.

### 3. Install Unity Catalog

Install Unity Catalog [locally](https://github.com/unitycatalog/unitycatalog) and run it on port 8080:
- The Unity catalog API should be accessible at http://localhost:8080/api/2.1/unity-catalog
- The API follows the [Unity Catalog REST API specification](https://docs.unitycatalog.io/swagger-docs/)

### 4. Create Sample Catalog Schemas

**For AWS Glue Catalog:**
```bash
python setup/setup_glue_simple.py
```

**For Unity Catalog:**
```bash
python setup/setup_unity_simple.py
```

Note: These scripts create database schemas and table definitions (metadata).

### 5. Build MCP Servers

Before running the unified catalog agent, you need to build the TypeScript MCP servers:

1. Build the Unity catalog MCP server:
   ```
   cd mcp/unity-catalog-server
   npm install
   npm run build
   cd ../..
   ```

2. Build the AWS Glue catalog MCP server:
   ```
   cd mcp/glue-catalog-server
   npm install
   npm run build
   cd ../..
   ```

These steps compile the TypeScript code to JavaScript, creating the necessary files in the `build` directories that the unified agent needs to run. If you encounter an error like `Cannot find module '/path/to/mcp/unity-catalog-server/build/index.js'`, it means you need to build the MCP servers first.

### 6. Run the Application

#### Command Line Demo
Run the demo script with the desired agent:
```bash
python demo.py --agent unity    # For Unity catalog agent (default)
python demo.py --agent glue     # For AWS Glue catalog agent
python demo.py --agent unified  # For Unified catalog agent
```

#### Streamlit UI
Run the Streamlit demo:
```bash
streamlit run streamlit_demo.py
```
Access at: http://localhost:8501

## AWS Deployment

### 1. Environment Setup

Create and activate a virtual environment:
```bash
python3 -m venv .venv-aws
source .venv-aws/bin/activate  # On Linux/macOS
# .venv-aws\Scripts\activate    # On Windows
```

Install requirements:
```bash
pip install boto3 requests bedrock-agentcore-starter-toolkit
```

**Additional Requirements:**
- **AWS CLI** configured with appropriate permissions
- **AWS Session Manager Plugin** (for accessing application)
- **Terraform** >= 1.0
- **Docker** for building container images

**AWS Session Manager Plugin Installation:**

**macOS:**
```bash
brew install --cask session-manager-plugin
```

**Linux:**
```bash
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
sudo dpkg -i session-manager-plugin.deb
```

**Windows:**
Download from: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

Verify installation:
```bash
session-manager-plugin
```

Required AWS permissions: ECS, ECR, RDS, VPC, IAM, CloudWatch, Bedrock AgentCore, CodeBuild

### 2. Configure AWS Profile

Make sure your AWS profile is set up correctly with permissions to deploy infrastructure and access AWS services.

### 3. Deploy Infrastructure

Run the automated deployment script:

```bash
python setup/deploy_aws_terraform.py
```

This script automatically:
- Deploys Terraform infrastructure (VPC, ECS, RDS, internal ALB, bastion instance, SSM VPC endpoints)
- Builds and pushes Streamlit Docker image to ECR
- Deploys MCP servers to AgentCore Runtime using bedrock-agentcore-starter-toolkit
- Updates ECS services
- Provides SSM access command with bastion ID and ALB DNS

The deployment takes approximately 10-15 minutes.

### 4. Connect via SSM Port Forwarding

**Note:** The deployment script (step 3) provides a ready-to-use connection command with all values filled in. You can copy and paste it directly from the deployment output.

If you closed the deployment terminal, get the connection information from Terraform:
```bash
# Get bastion instance ID
BASTION_ID=$(cd deploy/terraform && terraform output -raw bastion_instance_id)

# Get ALB DNS name
ALB_DNS=$(cd deploy/terraform && terraform output -raw alb_dns_name)

# Get AWS region
AWS_REGION=$(cd deploy/terraform && terraform output -raw aws_region)

# Display the values
echo "Bastion ID: $BASTION_ID"
echo "ALB DNS: $ALB_DNS"
echo "Region: $AWS_REGION"
```

Connect via SSM port forwarding:
```bash
aws ssm start-session \
  --target $BASTION_ID \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$ALB_DNS\"],\"portNumber\":[\"443\"],\"localPortNumber\":[\"8443\"]}" \
  --region $AWS_REGION
```

**Keep this terminal window open** - closing it will disconnect the tunnel. You can reconnect anytime by running these commands again.

### 5. Create Sample Catalog Schemas

**AWS Glue Catalog:**

Glue databases and table schemas are automatically created by Terraform during deployment. No manual setup needed!

**Unity Catalog:**

In a new terminal (keep SSM tunnel running in the other terminal):
```bash
python setup/setup_unity_sample_data.py
```

### 6. Access the Application

With the SSM tunnel active (from step 4), access the Streamlit UI at:
```
https://localhost:8443
```

**Note:** Browser will show SSL warning (self-signed certificate) - click "Advanced" → "Proceed" - this is safe.

If you closed the SSM tunnel, return to step 4 to reconnect.

#### Security Benefits:

✅ **No public internet exposure** - ALB is completely private<br/>
✅ **No static IP required** - Works from anywhere with AWS credentials<br/>
✅ **MFA compatible** - Uses your AWS IAM authentication (with MFA if enabled)<br/>
✅ **Audit trail** - All SSM sessions logged in CloudWatch<br/>
✅ **Minimal local setup** - Only AWS CLI and Session Manager plugin needed<br/>
✅ **Encrypted tunnels** - Traffic encrypted through AWS infrastructure<br/>

### Cleanup

⚠️ **Warning**: Destroys ALL resources and data. This action CANNOT be undone.

#### Step 1: Manually Delete AgentCore Runtimes (Required First)

AgentCore runtimes must be deleted manually before running the cleanup script:

```bash
# List all AgentCore runtimes
aws bedrock-agentcore-control list-agent-runtimes --region us-east-1

# Delete each runtime (use the ID from the ARN: arn:.../runtime/ID)
aws bedrock-agentcore-control delete-agent-runtime \
  --agent-runtime-id unity_catalog_mcp_<suffix>-<id> \
  --region us-east-1

aws bedrock-agentcore-control delete-agent-runtime \
  --agent-runtime-id glue_catalog_mcp_<suffix>-<id> \
  --region us-east-1
```

#### Step 2: Run Automated Cleanup Script

```bash
python setup/cleanup_aws_terraform.py
```

This script will:
1. Delete CodeBuild projects (created by toolkit)
2. Clean up AgentCore Network Interfaces (ENIs)
3. Empty Terraform-managed ECR repos (Terraform will delete them)
4. Delete toolkit-created ECR repositories (bedrock-agentcore-*)
5. Destroy all Terraform infrastructure (VPC, ECS, RDS, ALB, security groups, ECR, etc.)
6. Remove local configuration files (.env, agentcore-config.json, etc.)


## Example Queries

**For AWS Glue Catalog:**
- "List all databases in the Glue catalog"
- "Show me all tables in database X"
- "Find tables with 'customer' in the name"
- "Get details for table Y in database X"
- "Find tables with columns containing 'timestamp'"

**For Unity Catalog:**
- "List all databases in the Unity catalog"
- "Show me all tables in catalog_name.schema_name"
- "Find tables with 'customer' in the name"
- "Get details for table_name in catalog_name.schema_name"
- "Find tables with columns containing 'timestamp'"

**For Unified Catalog Agent:**
- "List all databases in both catalogs"
- "Find tables with 'customer' in the name in both catalogs"
- "Show me all tables in the Unity catalog"
- "Show me all tables in the AWS Glue catalog"
- "Find tables with columns containing 'timestamp' across both catalogs"

## Troubleshooting

**"command not found: aws"**
- Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- Configure your AWS credentials

**"Timeout" or connection fails:**
- Ensure VPC endpoints deployed correctly
- Check CloudWatch logs for errors
- Verify ECS services are running: `aws ecs list-services --cluster catalog-agents-cluster --region us-east-1`

**SSL certificate error persists:**
- Normal for self-signed certificates
- Safe to proceed - it's your own infrastructure

**Keep tunnel running:**
- Keep your local terminal window open (where SSM is running)
- If you close it, re-run the SSM command
- No data loss - just reconnects to existing infrastructure

## Limitations

This project is a proof-of-concept. Do not use this code for production purposes without performing additional analysis. Since we are using an open-source version of the Unity catalog, experiment with open-source data rather than production data.

## Security

**IMPORTANT:** Before deploying this project to AWS:
1. Review and follow all security guidelines in [SECURITY.md](SECURITY.md)
2. Replace all placeholder passwords with secure values
3. Never commit `terraform.tfvars`, `*.tfstate`, or `tfplan` files
4. Consider using AWS Secrets Manager for credential management

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information on reporting security issues.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
