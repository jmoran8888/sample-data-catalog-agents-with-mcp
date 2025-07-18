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

## Setup

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

## Project Structure

- `agents/glue_catalog_agent.py`: Defines the AWS Glue catalog agent
- `agents/unity_catalog_agent.py`: Defines the Unity catalog agent
- `agents/unified_catalog_agent.py`: Defines the unified catalog agent that uses both catalogs
- `tools/glue_tools.py`: Custom tools for interacting with the AWS Glue catalog
- `tools/unity_tools.py`: Custom tools for interacting with the Unity catalog
- `mcp/unity-catalog-server/`: MCP server for the Unity catalog agent
- `mcp/glue-catalog-server/`: MCP server for the AWS Glue catalog agent
- `demo.py`: Demo script to showcase all agents' capabilities
- `streamlit_demo.py`: Streamlit web application for the unified agent
- `test_agent.py`: Test script for the AWS Glue catalog agent
- `test_unity_agent.py`: Test script for the Unity catalog agent
- `test_unified_agent.py`: Test script for the unified catalog agent
- `architecture_diagrams.md`: High-level architecture diagrams
- `technical_data_flow.md`: Detailed technical data flow diagrams
- `implementation_details.md`: Implementation details and code structure diagrams
- `architecture_diagrams_README.md`: Guide to the architecture documentation

## Limitations

This project is a proof-of-concept. Do not use this code for production purposes without performing additional analysis. Since we are using an open-source version of the Unity catalog, experiment with open-source data rather than production data.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

