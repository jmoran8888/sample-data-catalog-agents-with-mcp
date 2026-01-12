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
- **AWS Systems Manager (SSM)**: Secure access via port forwarding through CloudShell
- **AWS Bedrock AgentCore Runtime**: Executes MCP servers
- **VPC**: Isolated network with public/private subnets

**Access Method**: No public internet access - uses AWS SSM port forwarding through CloudShell (zero local setup required!)

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

### 4. Populate Sample Data

**For AWS Glue Catalog:**
```bash
python setup/setup_glue_sample_data.py
```

**For Unity Catalog:**
```bash
python setup/setup_unity_simple.py
```

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

### Prerequisites

1. **Python 3.9+** with pip **and virtual environment (REQUIRED)**
   ```bash
   # Create and activate virtual environment
   python3 -m venv .venv-aws
   source .venv-aws/bin/activate  # On Linux/macOS
   # .venv-aws\Scripts\activate    # On Windows
   
   # Install deployment dependencies
   pip install boto3 requests bedrock-agentcore-starter-toolkit
   ```

2. **AWS CLI** configured with appropriate permissions
3. **Terraform** >= 1.0
4. **Docker** for building container images

Required AWS permissions: ECS, ECR, RDS, VPC, IAM, CloudWatch, Bedrock AgentCore, CodeBuild

**⚠️ Important**: Always use a virtual environment for AWS deployments to ensure consistent package versions and avoid threading issues with the AgentCore toolkit.

### How AgentCore Deployment Works

This project uses the **bedrock-agentcore-starter-toolkit** to deploy MCP servers to AWS Bedrock AgentCore:

1. **Toolkit packages your Python code** - MCP server files and dependencies
2. **Creates CodeBuild projects** - Automatically builds container images from source
3. **Manages ECR repositories** - Creates and pushes to toolkit-managed repos (bedrock-agentcore-*)
4. **Deploys to AgentCore** - Handles all API complexities correctly
5. **Monitors deployment** - Waits for READY status

**Benefits:**
- ✅ Reliable deployment (matches AWS Console behavior)
- ✅ Automatic container building
- ✅ No manual Docker commands needed for MCP servers
- ✅ Built-in error handling

**Resources Created:**
- CodeBuild projects (one per MCP server)
- ECR repositories (bedrock-agentcore-unityCatalogMcp_*, bedrock-agentcore-glueCatalogMcp_*)
- AgentCore runtime instances
- Sample data automatically populated in both catalogs

**Note:** All toolkit-created resources are automatically cleaned up by `cleanup_aws_terraform.py`.

### Configuration

**No manual configuration required!** The deployment script handles all infrastructure setup automatically.

**⚠️ Security Notes**: 
- ALB is **internal only** (not internet-facing)
- Access via **AWS Systems Manager (SSM)** port forwarding
- No public IP whitelisting needed
- Works from any location with AWS credentials
- Encrypted tunnels through AWS infrastructure
- All access logged in CloudWatch for auditing

### Deployment

```bash
# Complete automated deployment
python setup/deploy_aws_terraform.py
```

This single script automatically:
1. Deploys Terraform infrastructure (VPC, ECS, RDS, internal ALB, SSM VPC endpoints)
2. Builds and pushes Streamlit Docker image to ECR
3. Deploys MCP servers to AgentCore Runtime (toolkit builds MCP images)
4. Updates ECS services with configuration
5. Populates both AWS Glue and Unity catalogs with sample data
6. Provides SSM access instructions

### Accessing the Application via SSM Port Forwarding

The application uses an **internal ALB** (not publicly accessible) for enhanced security. Access is provided through AWS Systems Manager port forwarding.

**Zero Local Setup Required** - Everything runs in AWS CloudShell!

#### Step-by-Step Access Instructions:

**Step 1: Get ALB DNS Name**
```bash
cd deploy/terraform
terraform output alb_dns_name
# Example: internal-catalog-agents-alb-123456.us-east-1.elb.amazonaws.com
```

**Step 2: Open AWS CloudShell**
- Go to AWS Console (https://console.aws.amazon.com)
- Click the CloudShell icon in the top navigation bar
- Wait for CloudShell terminal to initialize (takes a few seconds)

**Step 3: Start SSM Port Forwarding**

In CloudShell, run this command (replace `<alb-dns>` with your actual ALB DNS):

```bash
aws ssm start-session \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{
    "host":["<alb-dns>"],
    "portNumber":["443"],
    "localPortNumber":["8443"]
  }' \
  --region us-east-1
```

**Example:**
```bash
aws ssm start-session \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{
    "host":["internal-catalog-agents-alb-123456.us-east-1.elb.amazonaws.com"],
    "portNumber":["443"],
    "localPortNumber":["8443"]
  }' \
  --region us-east-1
```

**Step 4: Access in Your Browser**

While the tunnel is running in CloudShell, open your **local browser**:
```
https://localhost:8443
```

**Step 5: Accept SSL Warning**
- Browser will show a security warning (self-signed certificate)
- Click "Advanced" → "Proceed to localhost (unsafe)" or similar
- **This is safe** - it's your own deployment with self-signed cert

**Step 6: Use the Application**
- Streamlit UI will load at `https://localhost:8443`
- Query both Unity and Glue catalogs
- View sample data and test agents

#### Access Flow Diagram:
```
[Your Browser] → localhost:8443
       ↓
[SSM Tunnel in CloudShell] (encrypted)
       ↓
[Internal ALB] → port 443 (private VPC)
       ↓
[ECS Streamlit Service] → port 8501
```

#### Troubleshooting:

**"command not found: aws"**
- CloudShell has AWS CLI pre-installed, refresh the session

**"Timeout" or connection fails:**
- Ensure VPC endpoints deployed correctly
- Check CloudWatch logs for errors
- Verify ECS services are running: `aws ecs list-services --cluster catalog-agents-cluster --region us-east-1`

**SSL certificate error persists:**
- Normal for self-signed certificates
- Safe to proceed - it's your own infrastructure

**Keep tunnel running:**
- Keep CloudShell window open
- If you close it, re-run the SSM command
- No data loss - just reconnects to existing infrastructure

#### Security Benefits:

✅ **No public internet exposure** - ALB is completely private
✅ **No static IP required** - Works from anywhere with AWS credentials
✅ **MFA compatible** - Uses your AWS IAM authentication (with MFA if enabled)
✅ **Audit trail** - All SSM sessions logged in CloudWatch
✅ **Zero local setup** - CloudShell has everything pre-installed
✅ **Encrypted tunnels** - Traffic encrypted through AWS infrastructure

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

## Usage & Example Queries

### Command Line (Local Development Only)

```bash
python demo.py --agent unity    # Unity catalog agent
python demo.py --agent glue     # AWS Glue catalog agent  
python demo.py --agent unified  # Unified catalog agent
```

### Streamlit Web UI

**Local:** http://localhost:8501 (after running `streamlit run streamlit_demo.py`)  
**AWS:** Get URL from terraform: `cd deploy/terraform && terraform output streamlit_url`

### Example Queries

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
