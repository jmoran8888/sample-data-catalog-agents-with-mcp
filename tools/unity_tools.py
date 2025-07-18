# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Unity Catalog Tools

This module provides tools for interacting with the Unity catalog.
"""

import requests
import json
from strands import tool

# Base URL for the Unity catalog API
BASE_URL = "http://localhost:8080/api/2.1/unity-catalog"


@tool
def list_unity_databases() -> list | dict:
    """
    List all schemas (databases) in the Unity catalog
    
    Returns:
        list: A list of schema (database) names
        dict: Error information if the Unity catalog service is unavailable
    """
    try:
        # First, get all catalogs
        try:
            catalogs_response = requests.get(f"{BASE_URL}/catalogs", timeout=10)
            catalogs_response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "error": "unity_catalog_unavailable",
                "error_message": f"Failed to connect to Unity catalog service: {str(e)}",
                "suggestion": "Please ensure the Unity catalog service is running at " + BASE_URL
            }
            
        catalogs_data = catalogs_response.json()
        
        # Then, get schemas for each catalog
        all_schemas = []
        for catalog in catalogs_data.get("catalogs", []):
            catalog_name = catalog.get("name")
            try:
                schemas_response = requests.get(f"{BASE_URL}/schemas?catalog_name={catalog_name}", timeout=10)
                schemas_response.raise_for_status()
                schemas_data = schemas_response.json()
                
                # Add schemas with their catalog prefix
                for schema in schemas_data.get("schemas", []):
                    schema_name = schema.get("name")
                    all_schemas.append(f"{catalog_name}.{schema_name}")
            except requests.exceptions.RequestException as e:
                return {
                    "error": "unity_catalog_unavailable",
                    "error_message": f"Failed to get schemas for catalog {catalog_name}: {str(e)}",
                    "suggestion": "Please ensure the Unity catalog service is running correctly"
                }
        
        return all_schemas
    except Exception as e:
        return {
            "error": "unity_catalog_error",
            "error_message": f"Unexpected error when accessing Unity catalog: {str(e)}",
            "suggestion": "Please check the Unity catalog service configuration"
        }


@tool
def list_unity_tables(database_name: str) -> list | dict:
    """
    List all tables in a specific Unity schema (database)
    
    Args:
        database_name: Name of the schema (database) in format 'catalog_name.schema_name'
        
    Returns:
        list: A list of table names
        dict: Error information if the Unity catalog service is unavailable or the database name is invalid
    """
    try:
        # Parse catalog and schema names
        parts = database_name.split(".")
        if len(parts) != 2:
            return {
                "error": "invalid_database_name",
                "error_message": f"Invalid database name format. Expected 'catalog_name.schema_name', got '{database_name}'",
                "suggestion": "Please provide the database name in the format 'catalog_name.schema_name'"
            }
        
        catalog_name, schema_name = parts
        
        # Get tables for the specified catalog and schema
        try:
            response = requests.get(
                f"{BASE_URL}/tables?catalog_name={catalog_name}&schema_name={schema_name}", 
                timeout=10
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "error": "unity_catalog_unavailable",
                "error_message": f"Failed to connect to Unity catalog service: {str(e)}",
                "suggestion": "Please ensure the Unity catalog service is running at " + BASE_URL
            }
            
        data = response.json()
        
        # Extract table names
        return [table.get("name") for table in data.get("tables", [])]
    except Exception as e:
        return {
            "error": "unity_catalog_error",
            "error_message": f"Unexpected error when accessing Unity catalog: {str(e)}",
            "suggestion": "Please check the Unity catalog service configuration"
        }


@tool
def get_table_details(database_name: str, table_name: str) -> dict:
    """
    Get detailed information about a specific table
    
    Args:
        database_name: Name of the schema (database) in format 'catalog_name.schema_name'
        table_name: Name of the table
        
    Returns:
        dict: Detailed information about the table or error information
    """
    try:
        # Parse catalog and schema names
        parts = database_name.split(".")
        if len(parts) != 2:
            return {
                "error": "invalid_database_name",
                "error_message": f"Invalid database name format. Expected 'catalog_name.schema_name', got '{database_name}'",
                "suggestion": "Please provide the database name in the format 'catalog_name.schema_name'"
            }
        
        catalog_name, schema_name = parts
        
        # Get table details
        try:
            response = requests.get(
                f"{BASE_URL}/tables/{catalog_name}.{schema_name}.{table_name}", 
                timeout=10
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "error": "unity_catalog_unavailable",
                "error_message": f"Failed to connect to Unity catalog service: {str(e)}",
                "suggestion": "Please ensure the Unity catalog service is running at " + BASE_URL
            }
            
        data = response.json()
        
        # Format the response to include key information
        return {
            "name": data.get("name", ""),
            "database": database_name,
            "description": data.get("comment", ""),
            "columns": [
                {
                    "name": col.get("name", ""),
                    "type": col.get("type_text", ""),
                    "comment": col.get("comment", "")
                }
                for col in data.get("columns", [])
            ],
            "location": data.get("storage_location", ""),
            "format": data.get("data_source_format", "")
        }
    except Exception as e:
        return {
            "error": "unity_catalog_error",
            "error_message": f"Unexpected error when accessing Unity catalog: {str(e)}",
            "suggestion": "Please check the Unity catalog service configuration"
        }


@tool
def search_tables_by_name(name_pattern: str) -> list | dict:
    """
    Search for tables by name pattern
    
    Args:
        name_pattern: Pattern to match table names
        
    Returns:
        list: A list of matching tables with their database names
        dict: Error information if the Unity catalog service is unavailable
    """
    try:
        # First, get all catalogs
        all_tables = []
        
        try:
            catalogs_response = requests.get(f"{BASE_URL}/catalogs", timeout=10)
            catalogs_response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "error": "unity_catalog_unavailable",
                "error_message": f"Failed to connect to Unity catalog service: {str(e)}",
                "suggestion": "Please ensure the Unity catalog service is running at " + BASE_URL
            }
            
        catalogs_data = catalogs_response.json()
        
        # For each catalog, get schemas
        for catalog in catalogs_data.get("catalogs", []):
            catalog_name = catalog.get("name")
            try:
                schemas_response = requests.get(f"{BASE_URL}/schemas?catalog_name={catalog_name}", timeout=10)
                schemas_response.raise_for_status()
                schemas_data = schemas_response.json()
                
                # For each schema, get tables
                for schema in schemas_data.get("schemas", []):
                    schema_name = schema.get("name")
                    try:
                        tables_response = requests.get(
                            f"{BASE_URL}/tables?catalog_name={catalog_name}&schema_name={schema_name}", 
                            timeout=10
                        )
                        tables_response.raise_for_status()
                        tables_data = tables_response.json()
                        
                        # Filter tables by name pattern and add to results
                        for table in tables_data.get("tables", []):
                            table_name = table.get("name", "")
                            if name_pattern.lower() in table_name.lower():
                                all_tables.append({
                                    "database": f"{catalog_name}.{schema_name}",
                                    "table": table_name
                                })
                    except requests.exceptions.RequestException:
                        # Skip schemas that can't be accessed, but continue with others
                        continue
            except requests.exceptions.RequestException:
                # Skip catalogs that can't be accessed, but continue with others
                continue
        
        return all_tables
    except Exception as e:
        return {
            "error": "unity_catalog_error",
            "error_message": f"Unexpected error when searching tables by name pattern {name_pattern}: {str(e)}",
            "suggestion": "Please check the Unity catalog service configuration"
        }


@tool
def search_tables_by_column(column_pattern: str) -> list | dict:
    """
    Search for tables containing columns matching the pattern
    
    Args:
        column_pattern: Pattern to match column names
        
    Returns:
        list: A list of tables with matching columns
        dict: Error information if the Unity catalog service is unavailable
    """
    try:
        # First, get all tables
        all_tables = []
        
        # Get all catalogs
        try:
            catalogs_response = requests.get(f"{BASE_URL}/catalogs", timeout=10)
            catalogs_response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "error": "unity_catalog_unavailable",
                "error_message": f"Failed to connect to Unity catalog service: {str(e)}",
                "suggestion": "Please ensure the Unity catalog service is running at " + BASE_URL
            }
            
        catalogs_data = catalogs_response.json()
        
        # For each catalog, get schemas
        for catalog in catalogs_data.get("catalogs", []):
            catalog_name = catalog.get("name")
            try:
                schemas_response = requests.get(f"{BASE_URL}/schemas?catalog_name={catalog_name}", timeout=10)
                schemas_response.raise_for_status()
                schemas_data = schemas_response.json()
                
                # For each schema, get tables
                for schema in schemas_data.get("schemas", []):
                    schema_name = schema.get("name")
                    tables_response = requests.get(
                        f"{BASE_URL}/tables?catalog_name={catalog_name}&schema_name={schema_name}", 
                        timeout=10
                    )
                    tables_response.raise_for_status()
                    tables_data = tables_response.json()
                    
                    # Add tables to the list
                    for table in tables_data.get("tables", []):
                        table_name = table.get("name")
                        all_tables.append({
                            "catalog_name": catalog_name,
                            "schema_name": schema_name,
                            "table_name": table_name
                        })
            except requests.exceptions.RequestException as e:
                return {
                    "error": "unity_catalog_unavailable",
                    "error_message": f"Failed to get schema or table data: {str(e)}",
                    "suggestion": "Please ensure the Unity catalog service is running correctly"
                }
        
        # For each table, get details and check columns
        results = []
        for table_info in all_tables:
            catalog_name = table_info["catalog_name"]
            schema_name = table_info["schema_name"]
            table_name = table_info["table_name"]
            
            # Get table details
            try:
                table_response = requests.get(
                    f"{BASE_URL}/tables/{catalog_name}.{schema_name}.{table_name}", 
                    timeout=10
                )
                table_response.raise_for_status()
                table_data = table_response.json()
                
                # Check if any column matches the pattern
                matching_columns = [
                    col.get("name", "") for col in table_data.get("columns", [])
                    if column_pattern.lower() in col.get("name", "").lower()
                ]
                
                if matching_columns:
                    results.append({
                        "database": f"{catalog_name}.{schema_name}",
                        "table": table_name,
                        "matching_columns": matching_columns
                    })
            except requests.exceptions.RequestException:
                # Skip tables that can't be accessed, but continue with others
                continue
        
        return results
    except Exception as e:
        return {
            "error": "unity_catalog_error",
            "error_message": f"Unexpected error when searching tables by column pattern {column_pattern}: {str(e)}",
            "suggestion": "Please check the Unity catalog service configuration"
        }
