#!/usr/bin/env python3
"""
AWS Glue Catalog MCP Server using FastMCP for AgentCore Runtime
"""

from mcp.server.fastmcp import FastMCP
from tools.glue_tools import (
    list_glue_databases,
    list_glue_tables,
    get_table_details,
    search_tables_by_name,
    search_tables_by_column
)

# Create FastMCP server with AgentCore Runtime compatibility
mcp = FastMCP(host="0.0.0.0", stateless_http=True)

@mcp.tool()
def list_glue_databases_tool() -> list:
    """List all databases in the AWS Glue catalog"""
    return list_glue_databases()

@mcp.tool()
def list_glue_tables_tool(database_name: str) -> list:
    """List all tables in a specific AWS Glue database"""
    return list_glue_tables(database_name)

@mcp.tool()
def get_glue_table_details_tool(database_name: str, table_name: str) -> dict:
    """Get detailed information about a specific table in the AWS Glue catalog"""
    return get_table_details(database_name, table_name)

@mcp.tool()
def search_glue_tables_by_name_tool(name_pattern: str) -> list:
    """Search for tables by name pattern in the AWS Glue catalog"""
    return search_tables_by_name(name_pattern)

@mcp.tool()
def search_glue_tables_by_column_tool(column_pattern: str) -> list:
    """Search for tables containing columns matching the pattern in the AWS Glue catalog"""
    return search_tables_by_column(column_pattern)

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
