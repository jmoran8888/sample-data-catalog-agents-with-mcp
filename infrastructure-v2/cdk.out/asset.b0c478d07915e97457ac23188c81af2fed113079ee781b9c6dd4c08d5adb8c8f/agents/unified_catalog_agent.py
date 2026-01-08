# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Unified Catalog Agent using AgentCore Runtime MCP Servers

This module defines an agent for interacting with both the Unity catalog and AWS Glue catalog
using MCP servers hosted on AgentCore Runtime.
"""

import boto3
from strands import Agent
import json
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

class AgentCoreMCPTool:
    """Tool wrapper for AgentCore MCP servers"""
    
    def __init__(self, name: str, description: str, runtime_id: str, tool_name: str):
        self.name = name
        self.description = description
        self.runtime_id = runtime_id
        self.tool_name = tool_name
        self.client = boto3.client('bedrock-agentcore-control')
    
    def __call__(self, **kwargs):
        """Call the MCP tool via AgentCore Runtime"""
        try:
            # Use AgentCore control plane to invoke the runtime
            response = self.client.invoke_agent_runtime(
                agentRuntimeId=self.runtime_id,
                inputText=json.dumps({
                    "tool": self.tool_name,
                    "parameters": kwargs
                })
            )
            
            # Parse the response
            result = response.get('output', '')
            return result if result else "No result"
                    
        except Exception as e:
            logging.error(f"Error calling AgentCore MCP tool {self.tool_name}: {e}")
            return f"Error: {str(e)}"

# AgentCore Runtime IDs from environment
UNITY_RUNTIME_ID = os.getenv("UNITY_MCP_RUNTIME_ID")
GLUE_RUNTIME_ID = os.getenv("GLUE_MCP_RUNTIME_ID")

# Create MCP tools for Unity Catalog
unity_tools = [
    AgentCoreMCPTool(
        "list_unity_databases",
        "List all databases in the Unity catalog",
        UNITY_RUNTIME_ID,
        "list_unity_databases_tool"
    ),
    AgentCoreMCPTool(
        "list_unity_tables",
        "List all tables in a specific Unity database",
        UNITY_RUNTIME_ID,
        "list_unity_tables_tool"
    ),
    AgentCoreMCPTool(
        "get_unity_table_details",
        "Get detailed information about a specific table in the Unity catalog",
        UNITY_RUNTIME_ID,
        "get_unity_table_details_tool"
    ),
    AgentCoreMCPTool(
        "search_unity_tables_by_name",
        "Search for tables by name pattern in the Unity catalog",
        UNITY_RUNTIME_ID,
        "search_unity_tables_by_name_tool"
    ),
    AgentCoreMCPTool(
        "search_unity_tables_by_column",
        "Search for tables containing columns matching the pattern in the Unity catalog",
        UNITY_RUNTIME_ID,
        "search_unity_tables_by_column_tool"
    )
]

# Create MCP tools for AWS Glue Catalog
glue_tools = [
    AgentCoreMCPTool(
        "list_glue_databases",
        "List all databases in the AWS Glue catalog",
        GLUE_RUNTIME_ID,
        "list_glue_databases_tool"
    ),
    AgentCoreMCPTool(
        "list_glue_tables",
        "List all tables in a specific AWS Glue database",
        GLUE_RUNTIME_ID,
        "list_glue_tables_tool"
    ),
    AgentCoreMCPTool(
        "get_glue_table_details",
        "Get detailed information about a specific table in the AWS Glue catalog",
        GLUE_RUNTIME_ID,
        "get_glue_table_details_tool"
    ),
    AgentCoreMCPTool(
        "search_glue_tables_by_name",
        "Search for tables by name pattern in the AWS Glue catalog",
        GLUE_RUNTIME_ID,
        "search_glue_tables_by_name_tool"
    ),
    AgentCoreMCPTool(
        "search_glue_tables_by_column",
        "Search for tables containing columns matching the pattern in the AWS Glue catalog",
        GLUE_RUNTIME_ID,
        "search_glue_tables_by_column_tool"
    )
]

# Create the unified catalog agent
unified_agent = Agent(
    model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    tools=unity_tools + glue_tools,
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
