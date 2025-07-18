# Architecture Diagrams for Multi-Agent Catalog System

This document provides architecture diagrams showing how the agents work together and interact with the data catalogs in the multi-agent catalog system.

## System Architecture Overview

The system follows a hierarchical multi-agent architecture with three main agents:
1. **Unity Catalog Agent** - Specialized for querying the Unity catalog
2. **AWS Glue Catalog Agent** - Specialized for querying the AWS Glue catalog
3. **Unified Catalog Agent** - Supervisor agent that coordinates between the specialized agents

These agents are integrated using the Model Context Protocol (MCP), which allows the supervisor agent to use the specialized agents as tools.

```mermaid
graph TD
    %% User Interfaces
    subgraph "User Interfaces"
        UI_CLI[CLI Demo]
        UI_Web[Streamlit Web App]
    end
    
    %% Unified Agent
    subgraph "Supervisor Agent"
        UA[Unified Catalog Agent]
        UA_Tools[MCP Client]
    end
    
    %% MCP Servers
    subgraph "MCP Servers"
        Unity_MCP[Unity Catalog MCP Server]
        Glue_MCP[AWS Glue Catalog MCP Server]
    end
    
    %% Specialized Agents
    subgraph "Specialized Agents"
        Unity_Agent[Unity Catalog Agent]
        Glue_Agent[AWS Glue Catalog Agent]
    end
    
    %% Tools
    subgraph "Specialized Tools"
        Unity_Tools[Unity Catalog Tools]
        Glue_Tools[AWS Glue Catalog Tools]
    end
    
    %% Data Sources
    subgraph "Data Catalogs"
        Unity_Catalog[Local Unity Catalog]
        Glue_Catalog[AWS Glue Catalog]
    end
    
    %% Connections
    UI_CLI --> UA
    UI_Web --> UA
    
    UA --> UA_Tools
    UA_Tools --> Unity_MCP
    UA_Tools --> Glue_MCP
    
    Unity_MCP --> Unity_Agent
    Glue_MCP --> Glue_Agent
    
    Unity_Agent --> Unity_Tools
    Glue_Agent --> Glue_Tools
    
    Unity_Tools --> Unity_Catalog
    Glue_Tools --> Glue_Catalog
    
    %% Styling
    classDef interface fill:#f9f,stroke:#333,stroke-width:2px;
    classDef agent fill:#bbf,stroke:#333,stroke-width:2px;
    classDef mcp fill:#bfb,stroke:#333,stroke-width:2px;
    classDef tools fill:#fbb,stroke:#333,stroke-width:2px;
    classDef catalog fill:#bff,stroke:#333,stroke-width:2px;
    
    class UI_CLI,UI_Web interface;
    class UA,Unity_Agent,Glue_Agent agent;
    class Unity_MCP,Glue_MCP,UA_Tools mcp;
    class Unity_Tools,Glue_Tools tools;
    class Unity_Catalog,Glue_Catalog catalog;
```

## Data Flow Sequence

The following diagram illustrates the data flow when a user makes a query:

```mermaid
sequenceDiagram
    participant User
    participant UA as Unified Agent
    participant UMCP as Unity MCP Server
    participant GMCP as Glue MCP Server
    participant UAgent as Unity Catalog Agent
    participant GAgent as Glue Catalog Agent
    participant UTools as Unity Tools
    participant GTools as Glue Tools
    participant UCat as Unity Catalog
    participant GCat as Glue Catalog
    
    User->>UA: Query (e.g., "Find tables with 'customer'")
    
    Note over UA: Analyze query to determine<br>which catalog(s) to search
    
    alt Query requires Unity Catalog
        UA->>UMCP: Call Unity tool (e.g., search_unity_tables_by_name)
        UMCP->>UAgent: Forward query
        UAgent->>UTools: Use appropriate tool
        UTools->>UCat: Query catalog
        UCat->>UTools: Return results
        UTools->>UAgent: Format results
        UAgent->>UMCP: Return JSON response
        UMCP->>UA: Return results
    end
    
    alt Query requires Glue Catalog
        UA->>GMCP: Call Glue tool (e.g., search_glue_tables_by_name)
        GMCP->>GAgent: Forward query
        GAgent->>GTools: Use appropriate tool
        GTools->>GCat: Query catalog via boto3
        GCat->>GTools: Return results
        GTools->>GAgent: Format results
        GAgent->>GMCP: Return JSON response
        GMCP->>UA: Return results
    end
    
    Note over UA: Combine results from both catalogs
    
    UA->>User: Return unified JSON response
```

## Key Components

### 1. User Interfaces
- **CLI Demo (demo.py)**: Command-line interface for testing agents
- **Streamlit Web App (streamlit_demo.py)**: Web interface for the unified agent

### 2. Unified Catalog Agent
- Acts as a supervisor agent
- Uses MCP clients to communicate with specialized agents
- Determines which catalog(s) to query based on user input
- Combines results from both catalogs into a unified response

### 3. MCP Servers
- **Unity Catalog MCP Server**: Wraps the Unity catalog agent as an MCP tool
- **AWS Glue Catalog MCP Server**: Wraps the AWS Glue catalog agent as an MCP tool
- Both servers expose their respective agents' functionality through a standardized interface

### 4. Specialized Agents
- **Unity Catalog Agent**: Specialized for querying the Unity catalog
- **AWS Glue Catalog Agent**: Specialized for querying the AWS Glue catalog
- Both use Claude 3.7 Sonnet model and have specialized tools

### 5. Specialized Tools
- **Unity Catalog Tools**: Tools for interacting with the Unity catalog
- **AWS Glue Catalog Tools**: Tools for interacting with the AWS Glue catalog
- Both sets of tools provide similar functionality but are adapted to their respective catalogs

### 6. Data Catalogs
- **Local Unity Catalog**: A mock implementation of the Databricks Unity catalog
- **AWS Glue Catalog**: The actual AWS Glue catalog accessed via boto3

## Technology Stack

- **AWS Strands SDK**: Framework for building AI agents
- **Amazon Bedrock**: Managed service providing access to foundation models (Claude 3.7 Sonnet)
- **Model Context Protocol (MCP)**: Protocol for wrapping agents as tools
- **Python**: Primary programming language for implementation
- **boto3**: AWS SDK for Python, used for interacting with AWS services
- **Streamlit**: Web application framework for the demo interface

## Key Differences Between Catalogs

- **Unity Catalog**: Uses a three-level namespace (catalog_name.schema_name.table_name)
- **AWS Glue Catalog**: Uses a two-level namespace (database_name.table_name)

This architecture demonstrates how multiple specialized agents can be combined using MCP to create a unified interface for data discovery across different platforms.
