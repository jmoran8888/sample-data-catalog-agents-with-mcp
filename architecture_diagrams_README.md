# Architecture Diagrams for Multi-Agent Catalog System

This directory contains comprehensive architecture diagrams for the multi-agent catalog system that integrates Unity Catalog and AWS Glue Catalog using Strands agents and MCP.

## Overview of Diagram Files

### 1. [Architecture Diagrams](architecture_diagrams.md)

This file provides high-level architecture diagrams showing:
- System Architecture Overview: The hierarchical multi-agent architecture with three main agents
- Data Flow Sequence: How data flows when a user makes a query
- Key Components: Detailed explanations of each component in the system
- Technology Stack: The technologies used in the implementation

These diagrams are ideal for getting a general understanding of the system architecture and how the components interact at a high level.

### 2. [Technical Data Flow Diagrams](technical_data_flow.md)

This file provides more detailed technical diagrams focusing on data flow:
- Component Interaction Flow: Step-by-step interaction between all components
- Data Structure Flow: How data is transformed as it flows through the system
- JSON Response Format: The standardized JSON format used for responses
- MCP Server Architecture: How MCP servers act as bridges between agents
- Tool Execution Flow: Detailed flow of a tool execution

These diagrams are useful for understanding the technical details of how data flows through the system and how the components interact at a more granular level.

### 3. [Implementation Details](implementation_details.md)

This file provides code-focused diagrams showing the actual implementation:
- Agent Implementation Structure: Class diagrams for the agent implementation
- Tool Implementation Structure: Class diagrams for the tool implementation
- MCP Server Implementation: Class diagrams for the MCP server implementation
- Demo Application Structure: Class diagrams for the demo applications
- Code Snippets: Example code snippets for key components
- Key Implementation Patterns: Common patterns used in the implementation

These diagrams are valuable for developers who need to understand the code structure and implementation details.

## How to View the Diagrams

The diagrams are created using Mermaid, a markdown-based diagramming tool. To view the diagrams:

1. Open the respective markdown files in a Mermaid-compatible viewer
2. GitHub natively supports Mermaid diagrams in markdown files
3. VS Code with the Mermaid extension can render the diagrams
4. Online Mermaid editors can be used to view and modify the diagrams

## Diagram Types

The architecture documentation includes several types of diagrams:

- **Flowcharts**: Show the flow of data and control between components
- **Sequence Diagrams**: Illustrate the sequence of interactions between components
- **Class Diagrams**: Represent the structure of classes and their relationships
- **Component Diagrams**: Show the high-level components and their connections

## Key Architectural Concepts

The diagrams illustrate several key architectural concepts:

1. **Hierarchical Multi-Agent Architecture**: A supervisor agent coordinates specialized worker agents
2. **Tool-Using Agent Pattern**: The supervisor agent uses other agents as tools via MCP
3. **Adapter Pattern**: Each specialized agent adapts its respective catalog's API to a common interface
4. **Facade Pattern**: The supervisor agent provides a simplified interface to the complex multi-catalog system

## Use Cases for the Diagrams

- **Project Onboarding**: Help new team members understand the system architecture
- **Documentation**: Provide comprehensive documentation for the project
- **Design Discussions**: Facilitate discussions about system design and architecture
- **Implementation Reference**: Serve as a reference for developers implementing the system
- **Troubleshooting**: Aid in diagnosing issues by understanding the flow of data and control

These architecture diagrams provide a comprehensive view of the multi-agent catalog system from different perspectives and at different levels of detail.
