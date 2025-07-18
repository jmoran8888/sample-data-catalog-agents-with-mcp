# Technical Data Flow Diagrams

This document provides detailed technical diagrams showing the data flow between components in the multi-agent catalog system.

## Component Interaction Flow

The following diagram shows the detailed interaction between all components in the system:

```mermaid
flowchart TD
    %% User and Interfaces
    User([User]) --> |"1. Submits Query"| UI["User Interface\n(CLI or Streamlit)"]
    UI --> |"2. Forwards Query"| UA["Unified Catalog Agent\n(Supervisor)"]
    
    %% Unified Agent Analysis
    UA --> |"3. Analyzes Query"| Decision{"Determine\nCatalog(s)\nto Query"}
    
    %% Unity Catalog Path
    Decision --> |"4a. Unity Query"| UMCP["Unity MCP Client"]
    UMCP --> |"5a. Invokes Tool"| UServer["Unity MCP Server\n(Node.js)"]
    UServer --> |"6a. Executes Python Script"| UScript["invoke_unity_agent.py"]
    UScript --> |"7a. Calls Agent"| UAgent["Unity Catalog Agent\n(Claude 3.7)"]
    UAgent --> |"8a. Uses Tool"| UTool["Unity Catalog Tools\n(Python)"]
    UTool --> |"9a. HTTP Request"| UCat["Local Unity Catalog\n(Mock REST API)"]
    UCat --> |"10a. JSON Response"| UTool
    UTool --> |"11a. Formats Results"| UAgent
    UAgent --> |"12a. JSON Response"| UScript
    UScript --> |"13a. Returns Results"| UServer
    UServer --> |"14a. Returns Results"| UMCP
    
    %% Glue Catalog Path
    Decision --> |"4b. Glue Query"| GMCP["Glue MCP Client"]
    GMCP --> |"5b. Invokes Tool"| GServer["Glue MCP Server\n(Node.js)"]
    GServer --> |"6b. Executes Python Script"| GScript["invoke_glue_agent.py"]
    GScript --> |"7b. Calls Agent"| GAgent["Glue Catalog Agent\n(Claude 3.7)"]
    GAgent --> |"8b. Uses Tool"| GTool["Glue Catalog Tools\n(Python)"]
    GTool --> |"9b. boto3 API Call"| GCat["AWS Glue Catalog\n(AWS Service)"]
    GCat --> |"10b. API Response"| GTool
    GTool --> |"11b. Formats Results"| GAgent
    GAgent --> |"12b. JSON Response"| GScript
    GScript --> |"13b. Returns Results"| GServer
    GServer --> |"14b. Returns Results"| GMCP
    
    %% Results Combination
    UMCP --> |"15a. Unity Results"| Combine["Result Combination\nLogic"]
    GMCP --> |"15b. Glue Results"| Combine
    Combine --> |"16. Combined Results"| UA
    UA --> |"17. Formatted Response"| UI
    UI --> |"18. Displays Results"| User
    
    %% Styling
    classDef user fill:#f9f,stroke:#333,stroke-width:2px;
    classDef interface fill:#f9f,stroke:#333,stroke-width:2px;
    classDef agent fill:#bbf,stroke:#333,stroke-width:2px;
    classDef mcp fill:#bfb,stroke:#333,stroke-width:2px;
    classDef tools fill:#fbb,stroke:#333,stroke-width:2px;
    classDef catalog fill:#bff,stroke:#333,stroke-width:2px;
    classDef decision fill:#fffacd,stroke:#333,stroke-width:2px;
    classDef process fill:#f5f5f5,stroke:#333,stroke-width:2px;
    
    class User user;
    class UI interface;
    class UA,UAgent,GAgent agent;
    class UMCP,GMCP,UServer,GServer mcp;
    class UTool,GTool tools;
    class UCat,GCat catalog;
    class Decision decision;
    class UScript,GScript,Combine process;
```

## Data Structure Flow

This diagram illustrates how data is transformed as it flows through the system:

```mermaid
flowchart LR
    %% Input
    UserQuery["User Query\n(Natural Language)"] --> UA["Unified Agent"]
    
    %% Processing in Unified Agent
    UA --> |"Analyze"| Intent["Query Intent\n- Target catalog(s)\n- Operation type\n- Search parameters"]
    Intent --> |"Transform to"| MCPCalls["MCP Tool Calls\n- Tool name\n- Parameters"]
    
    %% MCP Server Processing
    MCPCalls --> |"Unity MCP"| UAgentQuery["Unity Agent Query\n(Natural Language)"]
    MCPCalls --> |"Glue MCP"| GAgentQuery["Glue Agent Query\n(Natural Language)"]
    
    %% Specialized Agent Processing
    UAgentQuery --> UToolCall["Unity Tool Call\n- Function name\n- Parameters"]
    GAgentQuery --> GToolCall["Glue Tool Call\n- Function name\n- Parameters"]
    
    %% Catalog Queries
    UToolCall --> URequest["Unity HTTP Request\n- Endpoint\n- Query parameters"]
    GToolCall --> GRequest["Glue boto3 Call\n- Service\n- Method\n- Parameters"]
    
    %% Results
    URequest --> UResponse["Unity Response\n(JSON)"]
    GRequest --> GResponse["Glue Response\n(JSON)"]
    
    %% Result Processing
    UResponse --> UAgentResponse["Unity Agent Response\n(Formatted JSON)"]
    GResponse --> GAgentResponse["Glue Agent Response\n(Formatted JSON)"]
    
    %% Result Combination
    UAgentResponse --> Combined["Combined Results\n(Unified JSON)"]
    GAgentResponse --> Combined
    
    %% Final Response
    Combined --> FinalResponse["Final Response to User\n(Formatted JSON with summary)"]
    
    %% Styling
    classDef input fill:#f9f,stroke:#333,stroke-width:2px;
    classDef agent fill:#bbf,stroke:#333,stroke-width:2px;
    classDef process fill:#f5f5f5,stroke:#333,stroke-width:2px;
    classDef request fill:#fbb,stroke:#333,stroke-width:2px;
    classDef response fill:#bff,stroke:#333,stroke-width:2px;
    classDef output fill:#bfb,stroke:#333,stroke-width:2px;
    
    class UserQuery input;
    class UA,UAgentQuery,GAgentQuery agent;
    class Intent,MCPCalls,UToolCall,GToolCall process;
    class URequest,GRequest request;
    class UResponse,GResponse,UAgentResponse,GAgentResponse response;
    class Combined,FinalResponse output;
```

## JSON Response Format

The unified agent returns responses in a standardized JSON format:

```json
{
  "query": "The user's original query",
  "unity_results": [
    {
      "database": "catalog_name.schema_name",
      "table": "table_name",
      "matching_columns": ["column1", "column2"]
    }
  ],
  "glue_results": [
    {
      "database": "database_name",
      "table": "table_name",
      "matching_columns": ["column1", "column2"]
    }
  ],
  "summary": "A brief natural language summary of what was found across both catalogs"
}
```

## MCP Server Architecture

The MCP servers act as bridges between the unified agent and the specialized agents:

```mermaid
flowchart TD
    %% MCP Server Components
    subgraph "MCP Server"
        Server["Server Class\n(@modelcontextprotocol/sdk)"]
        Transport["StdioServerTransport"]
        Handlers["Request Handlers"]
        PythonExec["Python Script Execution"]
    end
    
    %% External Components
    Client["MCP Client\n(in Unified Agent)"] <--> |"MCP Protocol"| Transport
    PythonExec <--> |"stdin/stdout"| Agent["Specialized Agent\n(Python)"]
    
    %% Internal Connections
    Transport <--> Server
    Server <--> Handlers
    Handlers <--> PythonExec
    
    %% Request Types
    Client --> |"ListToolsRequest"| Handlers
    Client --> |"CallToolRequest"| Handlers
    
    %% Styling
    classDef server fill:#bbf,stroke:#333,stroke-width:2px;
    classDef transport fill:#bfb,stroke:#333,stroke-width:2px;
    classDef handlers fill:#fbb,stroke:#333,stroke-width:2px;
    classDef exec fill:#f5f5f5,stroke:#333,stroke-width:2px;
    classDef external fill:#bff,stroke:#333,stroke-width:2px;
    
    class Server server;
    class Transport transport;
    class Handlers handlers;
    class PythonExec exec;
    class Client,Agent external;
```

## Tool Execution Flow

This diagram shows the detailed flow of a tool execution:

```mermaid
sequenceDiagram
    participant UA as Unified Agent
    participant MCP as MCP Client
    participant Server as MCP Server
    participant Script as Python Script
    participant Agent as Specialized Agent
    participant Tool as Catalog Tool
    participant Catalog as Data Catalog
    
    UA->>MCP: CallToolRequest
    MCP->>Server: Forward request via stdio
    Server->>Script: Spawn Python process
    Script->>Agent: Call agent with query
    Agent->>Tool: Use appropriate tool
    Tool->>Catalog: Query catalog
    Catalog->>Tool: Return results
    Tool->>Agent: Return formatted results
    Agent->>Script: Return JSON response
    Script->>Server: Write to stdout
    Server->>MCP: Return response
    MCP->>UA: Return results
```

These diagrams provide a comprehensive view of how data flows through the multi-agent catalog system, from the user's query to the final response.
