# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Unified Catalog Agent (Simple Version)

This module defines an agent for interacting with both the Unity catalog and AWS Glue catalog
using direct tool imports instead of MCP servers.
"""

import json
import logging
from strands import Agent
from tools.unity_tools import (
    list_unity_databases,
    list_unity_tables,
    get_table_details as get_unity_table_details,
    search_tables_by_name as search_unity_tables_by_name,
    search_tables_by_column as search_unity_tables_by_column
)
from tools.glue_tools import (
    list_glue_databases,
    list_glue_tables,
    get_table_details as get_glue_table_details,
    search_tables_by_name as search_glue_tables_by_name,
    search_tables_by_column as search_glue_tables_by_column
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Create the unified catalog agent
unified_agent = Agent(
    model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    tools=[
        # Unity Catalog Tools
        list_unity_databases,
        list_unity_tables,
        get_unity_table_details,
        search_unity_tables_by_name,
        search_unity_tables_by_column,
        # AWS Glue Catalog Tools
        list_glue_databases,
        list_glue_tables,
        get_glue_table_details,
        search_glue_tables_by_name,
        search_glue_tables_by_column
    ],
    system_prompt="""You are a unified catalog assistant that can help users find data products 
    in both the Unity catalog and the AWS Glue catalog.
    
    You have access to tools for both catalogs:
    
    Unity Catalog Tools:
    - list_unity_databases: List all databases in the Unity catalog
    - list_unity_tables: List all tables in a specific Unity database (requires database name in format 'catalog_name.schema_name')
    - get_table_details: Get detailed information about a specific table in the Unity catalog
    - search_tables_by_name: Search for tables by name pattern in the Unity catalog
    - search_tables_by_column: Search for tables containing columns matching the pattern in the Unity catalog
    
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
