#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import sys
import json
from agents.glue_catalog_agent import glue_agent

def main():
    # Read the input from stdin
    input_data = json.loads(sys.stdin.read())
    
    # Extract the query and parameters
    tool_name = input_data.get('tool_name')
    params = input_data.get('params', {})
    
    # Process the query based on the tool name
    if tool_name == 'list_glue_databases':
        response = glue_agent("List all databases in the Glue catalog")
    elif tool_name == 'list_glue_tables':
        database_name = params.get('database_name')
        response = glue_agent(f"Show me all tables in {database_name}")
    elif tool_name == 'get_glue_table_details':
        database_name = params.get('database_name')
        table_name = params.get('table_name')
        response = glue_agent(f"Get details for {table_name} in {database_name}")
    elif tool_name == 'search_glue_tables_by_name':
        name_pattern = params.get('name_pattern')
        response = glue_agent(f"Find tables with '{name_pattern}' in the name")
    elif tool_name == 'search_glue_tables_by_column':
        column_pattern = params.get('column_pattern')
        response = glue_agent(f"Find tables with columns containing '{column_pattern}'")
    else:
        # Return an error for unknown tool names
        print(json.dumps({
            "error": "unknown_tool",
            "message": f"Unknown tool: {tool_name}"
        }))
        return
    
    # Extract the response message
    if hasattr(response, 'message'):
        response_text = str(response.message)
        
        # Try to parse the response as JSON
        try:
            response_json = json.loads(response_text)
            print(json.dumps(response_json))
        except json.JSONDecodeError:
            # If the response is not valid JSON, return it as is
            print(json.dumps({
                "raw_response": response_text,
                "error": "invalid_json_response"
            }))
    else:
        # Handle case where response doesn't have a message attribute
        print(json.dumps({
            "error": "invalid_response",
            "message": "Agent response does not have a message attribute"
        }))

if __name__ == "__main__":
    main()
