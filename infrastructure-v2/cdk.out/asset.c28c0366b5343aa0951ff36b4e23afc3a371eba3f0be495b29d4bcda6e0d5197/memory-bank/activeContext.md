# Active Context

## Current Work Focus
- Implementing the unified catalog agent using MCP to interact with both the Unity and AWS Glue catalog agents
- Creating MCP servers for the Unity and AWS Glue catalog agents
- Setting up a demo to showcase all three agents

## Recent Changes
- Created initial project brief
- Established memory bank structure with core documentation files
- Defined system architecture and component relationships
- Documented technical context and requirements
- Implemented AWS Glue catalog agent with search capabilities
- Created custom tools for interacting with the AWS Glue catalog
- Implemented Unity catalog agent with search capabilities
- Created custom tools for interacting with the Unity catalog
- Set up a demo script to showcase both agents' capabilities
- Created test scripts for both agents
- Updated Unity catalog tools to use the correct API endpoints based on the Unity Catalog REST API specification
- Updated Unity catalog agent to handle the three-level namespace (catalog.schema.table)
- Created MCP servers for both the Unity and AWS Glue catalog agents
- Implemented the unified catalog agent that uses both catalog agents via MCP
- Updated the demo script to include the unified catalog agent
- Created a test script for the unified catalog agent
- Updated documentation to reflect the new unified agent and MCP integration
- Added documentation to README.md about building the MCP servers before running the unified agent
- Created a Streamlit web application for demonstrating the unified catalog agent
- Updated requirements.txt to include Streamlit
- Updated documentation to include instructions for running the Streamlit demo
- Created comprehensive architecture diagrams showing how the agents work together and interact with data catalogs:
  - Created high-level architecture diagrams in architecture_diagrams.md
  - Created detailed technical data flow diagrams in technical_data_flow.md
  - Created implementation details diagrams in implementation_details.md
  - Created an architecture diagrams README to guide users through the documentation
  - Updated the main README.md to include information about the architecture diagrams

## Next Steps
1. **Unity Catalog Implementation**:
   - ✅ Design data structures for the local Unity catalog
   - ✅ Implement basic query functionality
   - Create sample catalog data

2. **Unity Catalog Agent Development**:
   - ✅ Implement the Unity catalog agent
   - ✅ Create tools for interacting with the local Unity catalog
   - ✅ Configure agent prompts and behaviors

3. **Supervisor Agent Development**:
   - ✅ Implement the supervisor agent (unified catalog agent)
   - ✅ Configure the agent to use both worker agents
   - ✅ Implement response synthesis logic

4. **MCP Integration**:
   - ✅ Wrap worker agents as MCP tools
   - ✅ Configure the supervisor agent to use these tools
   - ✅ Implement error handling and response processing

5. **Complete Demo Creation**:
   - ✅ Extend the demo script to include all agents
   - ✅ Implement sample queries that span both catalogs
   - ✅ Add documentation and explanations
   - ✅ Create a Streamlit web application for the unified agent

6. **Architecture Documentation**:
   - ✅ Create high-level architecture diagrams
   - ✅ Create detailed technical data flow diagrams
   - ✅ Create implementation details diagrams
   - ✅ Create an architecture diagrams README
   - ✅ Update the main README.md with architecture information

## Active Decisions and Considerations
- **Agent Granularity**: Implemented dedicated catalog agents with specialized tools for each catalog
- **Query Complexity**: Supporting natural language queries for database, table, and column searches
- **Response Format**: Using JSON format for consistent, structured responses across both agents
- **Error Handling**: Implemented error handling in the demo script and agent tools
- **Performance Optimization**: Using efficient queries to minimize latency
- **Consistent Interface**: Ensuring both agents have the same interface and response format
- **Unity Catalog Structure**: Handling the three-level namespace (catalog.schema.table) in the Unity catalog
- **API Compliance**: Following the Unity Catalog REST API specification for all Unity catalog operations

## Important Patterns and Preferences
- **Consistent Interface**: Using a consistent JSON response format for all queries across both agents
- **Modular Design**: Implemented modular tools for different types of catalog operations
- **Clear Documentation**: Added docstrings and comments throughout the code
- **Robust Error Handling**: Implemented error handling in both tools and the demo script
- **User-Friendly Responses**: Formatting responses as JSON for both human readability and machine parsing
- **Unified Demo**: Created a unified demo script that can showcase both agents
- **Comprehensive Architecture Documentation**: Created detailed architecture diagrams using Mermaid to visualize the system
- **Multiple Diagram Types**: Used flowcharts, sequence diagrams, and class diagrams to document different aspects of the system

## Learnings and Project Insights
- The Strands SDK provides a powerful framework for building AI agents with specialized tools
- Custom tools can be easily implemented using the @tool decorator
- JSON formatting provides a consistent interface for agent responses
- The architecture can be extended to include additional data sources and capabilities
- Both catalog agents can be integrated with other agents using MCP
- Using the same interface for both agents makes it easier to switch between them
- HTTP requests can be used to interact with local services like the Unity catalog
- Understanding the API structure is crucial for implementing tools that interact with external services
- The Unity Catalog uses a three-level namespace (catalog.schema.table) which differs from the AWS Glue catalog's two-level namespace (database.table)
- Mermaid diagrams are an effective way to document system architecture in a version-control friendly format
- Documenting architecture from multiple perspectives (high-level, data flow, implementation) provides a comprehensive understanding of the system
- Hierarchical multi-agent systems with specialized worker agents and a supervisor agent are an effective pattern for complex tasks
