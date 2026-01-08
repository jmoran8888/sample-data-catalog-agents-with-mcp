# System Patterns

## System Architecture
The system follows a hierarchical multi-agent architecture:

```
                  +-------------------+
                  | Supervisor Agent  |
                  +-------------------+
                  /                   \
                 /                     \
                /                       \
+-------------------+         +-------------------+
| Unity Catalog     |         | AWS Glue Catalog  |
| Agent             |         | Agent             |
+-------------------+         +-------------------+
        |                              |
        v                              v
+-------------------+         +-------------------+
| Local Unity       |         | AWS Glue Catalog  |
| Catalog           |         | (via boto3)       |
+-------------------+         +-------------------+
```

## Key Technical Decisions
1. **Agent Specialization**: Each agent specializes in a specific data catalog, allowing for focused functionality and expertise.
2. **Tool-based Integration**: Worker agents are wrapped as MCP tools that the supervisor agent can invoke.
3. **Local Execution**: The demo runs locally as a Python script or Jupyter notebook for ease of demonstration.
4. **Local Unity Catalog**: Using a local mock of the Unity catalog instead of requiring actual Databricks access.
5. **AWS Credentials**: Leveraging local AWS credentials for Glue catalog access.

## Design Patterns
1. **Hierarchical Multi-Agent Pattern**: A supervisor agent coordinates specialized worker agents.
2. **Tool-Using Agent Pattern**: The supervisor agent uses other agents as tools via MCP.
3. **Adapter Pattern**: Each specialized agent adapts its respective catalog's API to a common interface.
4. **Facade Pattern**: The supervisor agent provides a simplified interface to the complex multi-catalog system.

## Component Relationships
- **Supervisor Agent**: 
  - Receives user queries
  - Determines which catalog(s) to query
  - Invokes appropriate worker agents via MCP
  - Synthesizes responses from worker agents
  - Presents unified results to the user

- **Unity Catalog Agent**:
  - Specializes in querying the Unity catalog
  - Translates natural language queries to Unity catalog operations
  - Returns structured data from Unity catalog

- **AWS Glue Catalog Agent**:
  - Specializes in querying the AWS Glue catalog
  - Translates natural language queries to Glue catalog operations
  - Returns structured data from Glue catalog

## Critical Implementation Paths
1. **Agent Creation and Configuration**:
   - Initialize Strands agents with appropriate LLM models
   - Configure agent behaviors and capabilities

2. **MCP Tool Wrapping**:
   - Wrap worker agents as MCP tools
   - Define tool schemas and interfaces

3. **Query Processing Flow**:
   - User query → Supervisor agent
   - Query analysis and routing
   - Worker agent invocation
   - Response synthesis
   - Result presentation

4. **Local Unity Catalog Implementation**:
   - Create mock data structures
   - Implement query interface

5. **AWS Glue Integration**:
   - Configure boto3 client
   - Implement Glue catalog query methods
