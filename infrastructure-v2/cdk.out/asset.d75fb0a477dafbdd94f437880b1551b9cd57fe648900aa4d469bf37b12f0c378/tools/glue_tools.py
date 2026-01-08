# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
AWS Glue Catalog Tools

This module provides tools for interacting with the AWS Glue catalog.
"""

import boto3
from strands import tool


@tool
def list_glue_databases() -> list:
    """
    List all databases in the AWS Glue catalog
    
    Returns:
        list: A list of database names
    """
    glue_client = boto3.client('glue')
    response = glue_client.get_databases()
    return [db['Name'] for db in response['DatabaseList']]


@tool
def list_glue_tables(database_name: str) -> list:
    """
    List all tables in a specific Glue database
    
    Args:
        database_name: Name of the database
        
    Returns:
        list: A list of table names
    """
    glue_client = boto3.client('glue')
    response = glue_client.get_tables(DatabaseName=database_name)
    return [table['Name'] for table in response['TableList']]


@tool
def get_table_details(database_name: str, table_name: str) -> dict:
    """
    Get detailed information about a specific table
    
    Args:
        database_name: Name of the database
        table_name: Name of the table
        
    Returns:
        dict: Detailed information about the table
    """
    glue_client = boto3.client('glue')
    response = glue_client.get_table(DatabaseName=database_name, Name=table_name)
    table = response['Table']
    
    # Format the response to include key information
    return {
        "name": table['Name'],
        "database": database_name,
        "description": table.get('Description', ''),
        "columns": [
            {
                "name": col['Name'],
                "type": col['Type'],
                "comment": col.get('Comment', '')
            }
            for col in table.get('StorageDescriptor', {}).get('Columns', [])
        ],
        "location": table.get('StorageDescriptor', {}).get('Location', ''),
        "format": table.get('StorageDescriptor', {}).get('InputFormat', '').split('.')[-1].replace('InputFormat', '') if table.get('StorageDescriptor', {}).get('InputFormat') else ''
    }


@tool
def search_tables_by_name(name_pattern: str) -> list:
    """
    Search for tables by name pattern
    
    Args:
        name_pattern: Pattern to match table names
        
    Returns:
        list: A list of matching tables with their database names
    """
    glue_client = boto3.client('glue')
    response = glue_client.search_tables(
        SearchText=name_pattern,
        MaxResults=100
    )
    
    return [
        {
            "database": table['DatabaseName'],
            "table": table['Name']
        }
        for table in response.get('TableList', [])
    ]


@tool
def search_tables_by_column(column_pattern: str) -> list:
    """
    Search for tables containing columns matching the pattern
    
    Args:
        column_pattern: Pattern to match column names
        
    Returns:
        list: A list of tables with matching columns
    """
    glue_client = boto3.client('glue')
    response = glue_client.search_tables(
        SearchText=column_pattern,
        MaxResults=100
    )
    
    results = []
    for table in response.get('TableList', []):
        # Check if any column matches the pattern
        columns = table.get('StorageDescriptor', {}).get('Columns', [])
        matching_columns = [
            col['Name'] for col in columns 
            if column_pattern.lower() in col['Name'].lower()
        ]
        
        if matching_columns:
            results.append({
                "database": table['DatabaseName'],
                "table": table['Name'],
                "matching_columns": matching_columns
            })
    
    return results
