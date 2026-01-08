# Technical Context

## Technologies Used

### Core Technologies
- **AWS Strands SDK**: Framework for building AI agents
- **Amazon Bedrock**: Managed service providing access to foundation models
- **Model Context Protocol (MCP)**: Protocol for wrapping agents as tools
- **Python**: Primary programming language for implementation

### Data Catalog Technologies
- **AWS Glue Catalog**: Metadata repository for AWS data sources
- **Databricks Unity Catalog**: Metadata repository for Databricks data sources (local mock implementation)

### Supporting Technologies
- **boto3**: AWS SDK for Python, used for interacting with AWS services
- **Jupyter Notebook**: Optional environment for running and demonstrating the demo

## Development Setup

### Prerequisites
- Python 3.9+ installed
- AWS CLI configured with appropriate credentials
- AWS Strands SDK installed
- MCP libraries installed
- Access to Amazon Bedrock models

### Environment Configuration
- AWS credentials configured locally (via AWS CLI or environment variables)
- Bedrock model access permissions configured
- Local mock of Unity Catalog data

### Project Structure
```
dbx-demo-strands/
├── agents/
│   ├── supervisor_agent.py
│   ├── unity_catalog_agent.py
│   └── glue_catalog_agent.py
├── catalogs/
│   ├── mock_unity_catalog.py
│   └── glue_catalog_client.py
├── mcp/
│   └── tool_wrappers.py
├── demo.py (or demo.ipynb)
├── requirements.txt
└── README.md
```

## Technical Constraints

### AWS Constraints
- Requires valid AWS credentials with Glue and Bedrock access
- Bedrock model quotas and rate limits apply
- Region-specific availability of Bedrock models

### Local Execution Constraints
- Memory limitations based on local machine
- Performance dependent on local hardware
- No actual Databricks connectivity

### Agent Constraints
- Model context window limitations
- Quality of responses dependent on underlying LLM capabilities
- Potential latency due to API calls to Bedrock

## Dependencies

### Direct Dependencies
- `aws-strands`: AWS Strands SDK for agent creation
- `boto3`: AWS SDK for Python
- `mcp`: Model Context Protocol libraries
- `jupyter`: (Optional) For notebook execution

### Indirect Dependencies
- Amazon Bedrock service
- AWS Glue service
- AWS IAM for authentication

## Tool Usage Patterns

### Strands SDK Usage
- Agent initialization with model selection
- Prompt engineering for specialized catalog queries
- Memory configuration for maintaining context

### MCP Tool Integration
- Tool schema definition for worker agents
- Input/output format standardization
- Error handling and retry logic

### Boto3 Client Usage
- Session management for AWS services
- Pagination handling for large result sets
- Error handling for AWS API calls

### Local Development Workflow
- Local testing with mock data
- Iterative agent prompt refinement
- Performance optimization techniques
