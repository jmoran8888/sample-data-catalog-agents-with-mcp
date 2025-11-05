#!/usr/bin/env python3
"""
Unity Catalog MCP Server using FastMCP for AgentCore Runtime
"""

from mcp.server.fastmcp import FastMCP
from tools.unity_tools import (
    list_unity_databases,
    list_unity_tables,
    get_table_details,
    search_tables_by_name,
    search_tables_by_column
)

# Create FastMCP server with AgentCore Runtime compatibility
mcp = FastMCP(host="0.0.0.0", stateless_http=True)

@mcp.tool()
def list_unity_databases_tool() -> list:
    """List all databases in the Unity catalog"""
    return list_unity_databases()

@mcp.tool()
def list_unity_tables_tool(database_name: str) -> list:
    """List all tables in a specific Unity database (format: catalog_name.schema_name)"""
    return list_unity_tables(database_name)

@mcp.tool()
def get_unity_table_details_tool(database_name: str, table_name: str) -> dict:
    """Get detailed information about a specific table in the Unity catalog"""
    return get_table_details(database_name, table_name)

@mcp.tool()
def search_unity_tables_by_name_tool(name_pattern: str) -> list:
    """Search for tables by name pattern in the Unity catalog"""
    return search_tables_by_name(name_pattern)

@mcp.tool()
def search_unity_tables_by_column_tool(column_pattern: str) -> list:
    """Search for tables containing columns matching the pattern in the Unity catalog"""
    return search_tables_by_column(column_pattern)

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
