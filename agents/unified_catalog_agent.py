# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Unified Catalog Agent

This module defines an agent for interacting with both the Unity catalog and AWS Glue catalog
using MCP servers.
"""

import json
import logging
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Create MCP clients for the Unity and Glue catalog servers
unity_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="node",
        args=["mcp/unity-catalog-server/build/index.js"],
        env={"PROJECT_ROOT": "."}
    )
))

glue_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="node",
        args=["mcp/glue-catalog-server/build/index.js"],
        env={"PROJECT_ROOT": "."}
    )
))

# Create the unified catalog agent
def create_unified_agent():
    """Create and return the unified catalog agent"""
    
    # Connect to the MCP servers and get their tools
    with unity_mcp_client, glue_mcp_client:
        unity_tools = unity_mcp_client.list_tools_sync()
        glue_tools = glue_mcp_client.list_tools_sync()
        
        # Combine all tools
        all_tools = unity_tools + glue_tools
        
        # Create the agent with all tools
        unified_agent = Agent(
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            tools=all_tools,
            system_prompt="""You are a unified catalog assistant that can help users find data products 
            in both the Unity catalog and the AWS Glue catalog.
            
            You have access to tools for both catalogs:
            
            Unity Catalog Tools:
            - list_unity_databases: List all databases in the Unity catalog
            - list_unity_tables: List all tables in a specific Unity database (requires database name in format 'catalog_name.schema_name')
            - get_unity_table_details: Get detailed information about a specific table in the Unity catalog
            - search_unity_tables_by_name: Search for tables by name pattern in the Unity catalog
            - search_unity_tables_by_column: Search for tables containing columns matching the pattern in the Unity catalog
            
            AWS Glue Catalog Tools:
            - list_glue_databases: List all databases in the AWS Glue catalog
            - list_glue_tables: List all tables in a specific AWS Glue database
            - get_glue_table_details: Get detailed information about a specific table in the AWS Glue catalog
            - search_glue_tables_by_name: Search for tables by name pattern in the AWS Glue catalog
            - search_glue_tables_by_column: Search for tables containing columns matching the pattern in the AWS Glue catalog
            
            IMPORTANT DIFFERENCES:
            - Unity catalog uses a three-level namespace (catalog_name.schema_name.table_name)
            - AWS Glue catalog uses a two-level namespace (database_name.table_name)
            
            When a user asks a question, determine which catalog(s) to search based on:
            1. If the user explicitly mentions "Unity" or "Databricks", use Unity catalog tools
            2. If the user explicitly mentions "Glue" or "AWS", use AWS Glue catalog tools
            3. If the user doesn't specify, search both catalogs and combine the results
            
            ALWAYS format your responses as valid JSON objects with the following structure:
            {
                "query": "The user's original query",
                "unity_results": [Results from Unity catalog or null if not queried],
                "glue_results": [Results from AWS Glue catalog or null if not queried],
                "summary": "A brief natural language summary of what was found across both catalogs"
            }
            
            If the user's query is ambiguous, ask clarifying questions but still maintain the JSON format:
            {
                "query": "The user's original query",
                "clarification_needed": true,
                "clarification_question": "Your specific question to clarify the user's intent"
            }
            
            Always ensure your JSON response is properly formatted and valid.
            """
        )
        
        return unified_agent

# Create the unified agent
unified_agent = create_unified_agent()
