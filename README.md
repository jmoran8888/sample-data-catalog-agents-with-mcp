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

### 2. AWS Production Deployment

Deploy to AWS with complete managed infrastructure:
- **ECS Fargate**: Runs Unity Catalog and Streamlit applications
- **RDS PostgreSQL**: Metadata storage
- **Application Load Balancer**: Traffic routing with IP-based access control
- **AWS Bedrock AgentCore Runtime**: Executes MCP servers
- **Security Group Whitelisting**: IP-based authentication for secure access
- **VPC**: Isolated network with public/private subnets

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

**Note:** All toolkit-created resources are automatically cleaned up by `cleanup_aws.py`.

### Configuration

**No manual configuration required!** The deployment script automatically:
- Detects your public IP address
- Creates/updates `deploy/terraform/terraform.tfvars` with your IP
- Configures the ALB to accept connections only from your IP

**⚠️ Security Notes**: 
- Your IP address is automatically detected and whitelisted
- The ALB will only be accessible from your detected IP address
- This is the primary security mechanism
- If your IP changes later, re-run `python setup/deploy_aws.py` or manually update `allowed_ip_address` in `deploy/terraform/terraform.tfvars` and run `terraform apply`
- The `terraform.tfvars` file is in `.gitignore` - never commit it

### Deployment

```bash
# Complete automated deployment
python setup/deploy_aws.py
```

This single script automatically:
1. Deploys Terraform infrastructure (VPC, ECS, RDS, ALB with IP whitelisting)
2. Builds and pushes Streamlit Docker image to ECR
3. Deploys MCP servers to AgentCore Runtime (toolkit builds MCP images)
4. Updates ECS services with configuration
5. Populates both AWS Glue and Unity catalogs with sample data
6. Provides access URLs

### Accessing the Application

After deployment completes, the script will output:
- **Application URL**: `https://<alb-dns-name>`

**To access:**
1. Open the Application URL in your browser (already configured for your IP)
2. Access is automatically restricted to the IP address detected during deployment
3. If your IP changes, re-run `python setup/deploy_aws.py` (it will auto-update your IP)
4. Use the web interface to query both catalogs

**To get URL later:**
```bash
cd deploy/terraform
terraform output alb_dns_name
```

**Security Note:** The ALB only accepts HTTPS connections from your automatically whitelisted IP address. Access from other IPs will be blocked by the security group.

### Cleanup

⚠️ **Warning**: Destroys ALL resources and data. This action CANNOT be undone.

```bash
python setup/cleanup_aws.py
```

This script will:
1. Delete AgentCore runtimes (Unity & Glue MCP servers)
2. Delete CodeBuild projects (created by toolkit)
3. Empty all ECR repositories (including toolkit-created ones)
4. Destroy all Terraform infrastructure (VPC, ECS, RDS, ALB, security groups, etc.)
5. Remove local configuration files (.env, agentcore-config.json, etc.)

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
