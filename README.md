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
- **Application Load Balancer**: Traffic routing with Cognito authentication
- **AWS Bedrock AgentCore Runtime**: Executes MCP servers
- **Amazon Cognito**: User authentication
- **VPC**: Isolated network with public/private subnets

**See "AWS Deployment" section below for complete instructions.**
**Review [SECURITY.md](SECURITY.md) before deploying.**

## Setup (Local Development)

1. Create a virtual environment:
   ```
   uv venv .venv
   ```

2. Activate the virtual environment:
   ```
   source .venv/bin/activate  # On Linux/macOS
   .venv\Scripts\activate     # On Windows
   ```

3. Install requirements:
   ```
   uv pip install -r requirements.txt
   ```

4. Make sure your AWS profile is set up correctly with permissions to access the AWS Glue catalog

5. Make sure you have a few tables created in your Glue catalog for testing

6. Install Unity Catalog [locally](https://github.com/unitycatalog/unitycatalog) and run it on port 8080
   - The Unity catalog API should be accessible at http://localhost:8080/api/2.1/unity-catalog
   - The API follows the [Unity Catalog REST API specification](https://docs.unitycatalog.io/swagger-docs/)

7. Add some tables to the Unity catalog.

## Sample Data

### AWS Deployments

**Sample data is automatically populated during deployment** via `python setup/deploy_aws.py`:

**AWS Glue Catalog (via Terraform):**
- 3 databases: customer_database, sales_database, analytics_database
- 3 tables with column schemas (no actual data rows)

**Unity Catalog (via deployment script):**
- 2 schemas: retail, analytics
- 3 tables: customers, orders, sales_summary
- Automatically created after infrastructure is ready

### Local Development

For local development, manually populate catalogs using helper scripts:

**For AWS Glue Catalog:**
```bash
python setup/setup_glue_sample_data.py
```

**For Unity Catalog:**
```bash
python setup/setup_unity_simple.py
```

**Note:** For local Unity setup, scripts default to `http://localhost:8080`. For AWS, the deployment script handles the endpoint configuration automatically.

## Building MCP Servers

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

## Usage

### Command Line Demo
Run the demo script with the desired agent:
```
python demo.py --agent unity    # For Unity catalog agent (default)
python demo.py --agent glue     # For AWS Glue catalog agent
python demo.py --agent unified  # For Unified catalog agent
```

### Streamlit Demo
Run the Streamlit demo for the unified agent:
```
streamlit run streamlit_demo.py
```
This will launch a web interface where you can interact with the unified catalog agent.

### Example Queries

For AWS Glue Catalog:
- "List all databases in the Glue catalog"
- "Show me all tables in database X"
- "Find tables with 'customer' in the name"
- "Get details for table Y in database X"
- "Find tables with columns containing 'timestamp'"

For Unity Catalog:
- "List all databases in the Unity catalog"
- "Show me all tables in catalog_name.schema_name"
- "Find tables with 'customer' in the name"
- "Get details for table_name in catalog_name.schema_name"
- "Find tables with columns containing 'timestamp'"

For Unified Catalog Agent:
- "List all databases in both catalogs"
- "Find tables with 'customer' in the name in both catalogs"
- "Show me all tables in the Unity catalog"
- "Show me all tables in the AWS Glue catalog"
- "Find tables with columns containing 'timestamp' across both catalogs"

## AWS Deployment

### Prerequisites

1. **Python 3.9+** with pip
2. **AWS CLI** configured with appropriate permissions
3. **Terraform** >= 1.0
4. **Docker** for building container images

Required AWS permissions: ECS, ECR, RDS, VPC, IAM, CloudWatch, Bedrock AgentCore, CodeBuild

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

**Note:** All toolkit-created resources are automatically cleaned up by `cleanup_aws.py`.

### One-Command Deployment

```bash
# Complete automated deployment
python setup/deploy_aws.py
```

This single script automatically:
1. Deploys Terraform infrastructure (VPC, ECS, RDS, ALB, Cognito)
2. Builds and pushes Streamlit Docker image to ECR
3. Deploys MCP servers to AgentCore Runtime (toolkit builds MCP images)
4. Updates ECS services with configuration
5. Populates both AWS Glue and Unity catalogs with sample data
6. Provides access URLs and credentials

### Manual Step-by-Step (Advanced)

If you prefer manual control, see individual commands in [setup/deploy_aws.py](setup/deploy_aws.py) or use the component scripts:
- Terraform: `cd deploy/terraform && terraform apply`
- AgentCore only: `python setup/deploy_agentcore.py`

### Local Testing with Docker Compose

Test the full stack locally:
```bash
cd deploy/docker
docker-compose up
```

Access:
- Streamlit: http://localhost:8501
- Unity Catalog: http://localhost:8080

### Cleanup

⚠️ **Warning**: Destroys ALL resources and data. This action CANNOT be undone.

**Automated Cleanup (Recommended):**
```bash
python setup/cleanup_aws.py
```

This script will:
1. Delete AgentCore runtimes (Unity & Glue MCP servers)
2. Delete CodeBuild projects (created by toolkit)
3. Empty all ECR repositories (including toolkit-created ones)
4. Destroy all Terraform infrastructure (VPC, ECS, RDS, ALB, Cognito, etc.)
5. Remove local configuration files (.env, agentcore-config.json, etc.)

**Manual Cleanup (Alternative):**
```bash
cd deploy/terraform
terraform destroy
```

**Note:** Manual cleanup requires you to separately delete AgentCore runtimes and empty ECR repositories first.

### SSL/TLS Configuration

By default, the ALB uses a self-signed certificate. Browsers will show security warnings.

**Demo/Testing (Accept Browser Warning):**
- Chrome/Edge: Click "Advanced" → "Proceed to site (unsafe)"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"

⚠️ **Note:** Traffic is encrypted but certificate is untrusted. This is acceptable for demos.

**Production (Bring Your Own Domain):**
1. Register a domain name
2. Create ACM certificate for your domain
3. Update Terraform variables:
   ```hcl
   custom_domain = "myapp.example.com"
   acm_certificate_arn = "arn:aws:acm:region:account:certificate/id"
   ```
4. Update Cognito callback URLs to use your domain

### Troubleshooting

**AgentCore CREATE_FAILED:**
- Most common: Missing ECR permissions on execution role
- Check IAM role has: ecr:GetAuthorizationToken, ecr:BatchGetImage, ecr:GetDownloadUrlForLayer
- Verify bedrock-agentcore-starter-toolkit is installed
- Check CloudWatch logs for detailed error messages

**ECS Service Issues:**
- Check logs: `aws logs tail /ecs/streamlit-app --follow`
- Verify security groups allow required ports

**Database Connection:**
- Ensure RDS security group allows ECS task connections

**SSL Certificate Warnings:**
- Expected with default self-signed certificate
- For production, use custom domain with ACM certificate

## Project Structure

### Core Agent Files:
- `agents/`: Agent implementations (Glue, Unity, Unified)
- `tools/`: Custom tools for catalog interactions
- `mcp/`: MCP server implementations

### Demo and Test Files:
- `demo.py`: Command-line demo for all agents
- `streamlit_demo.py`: Web UI demo
- `test_*.py`: Test scripts for agents

### Setup and Deployment:
- `setup/`: Helper scripts for data setup and AWS deployment
  - `deploy_agentcore.py`: Deploy to AWS Bedrock AgentCore Runtime
  - `setup_glue_sample_data.py` / `setup_glue_cli.sh`: Glue sample data
  - `setup_unity_sample_data.py` / `setup_unity_simple.py`: Unity sample data

### Infrastructure:
- `deploy/`: AWS deployment using Terraform
  - `terraform/`: Infrastructure as code
  - `scripts/`: Deployment automation scripts
  - `docker/`: Container configurations

### Documentation:
- `architecture_diagrams.md`: System architecture overview
- `technical_data_flow.md`: Detailed data flow diagrams
- `implementation_details.md`: Code structure details
- `SECURITY.md`: Security best practices

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
