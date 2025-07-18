#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

// Get the project root directory
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

// Define the path to the Python script that will invoke the Unity catalog agent
const pythonScript = path.join(projectRoot, 'mcp', 'unity-catalog-server', 'invoke_unity_agent.py');

// Create the Python script if it doesn't exist
if (!fs.existsSync(pythonScript)) {
  const scriptContent = `#!/usr/bin/env python3
import sys
import json
from agents.unity_catalog_agent import unity_agent

def main():
    # Read the input from stdin
    input_data = json.loads(sys.stdin.read())
    
    # Extract the query and parameters
    tool_name = input_data.get('tool_name')
    params = input_data.get('params', {})
    
    # Process the query based on the tool name
    if tool_name == 'list_unity_databases':
        response = unity_agent("List all databases in the Unity catalog")
    elif tool_name == 'list_unity_tables':
        database_name = params.get('database_name')
        response = unity_agent(f"Show me all tables in {database_name}")
    elif tool_name == 'get_unity_table_details':
        database_name = params.get('database_name')
        table_name = params.get('table_name')
        response = unity_agent(f"Get details for {table_name} in {database_name}")
    elif tool_name == 'search_unity_tables_by_name':
        name_pattern = params.get('name_pattern')
        response = unity_agent(f"Find tables with '{name_pattern}' in the name")
    elif tool_name == 'search_unity_tables_by_column':
        column_pattern = params.get('column_pattern')
        response = unity_agent(f"Find tables with columns containing '{column_pattern}'")
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
`;
  fs.writeFileSync(pythonScript, scriptContent);
  fs.chmodSync(pythonScript, '755');
}

// Function to execute the Python script with the Unity catalog agent
async function invokeUnityAgent(toolName: string, params: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [pythonScript]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse Python output as JSON: ${stdout}`));
      }
    });
    
    // Send the input to the Python script
    pythonProcess.stdin.write(JSON.stringify({ tool_name: toolName, params }));
    pythonProcess.stdin.end();
  });
}

class UnityCatalogServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'unity-catalog-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_unity_databases',
          description: 'List all databases in the Unity catalog',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'list_unity_tables',
          description: 'List all tables in a specific Unity database',
          inputSchema: {
            type: 'object',
            properties: {
              database_name: {
                type: 'string',
                description: 'Name of the database in format catalog_name.schema_name',
              },
            },
            required: ['database_name'],
          },
        },
        {
          name: 'get_unity_table_details',
          description: 'Get detailed information about a specific table in the Unity catalog',
          inputSchema: {
            type: 'object',
            properties: {
              database_name: {
                type: 'string',
                description: 'Name of the database in format catalog_name.schema_name',
              },
              table_name: {
                type: 'string',
                description: 'Name of the table',
              },
            },
            required: ['database_name', 'table_name'],
          },
        },
        {
          name: 'search_unity_tables_by_name',
          description: 'Search for tables by name pattern in the Unity catalog',
          inputSchema: {
            type: 'object',
            properties: {
              name_pattern: {
                type: 'string',
                description: 'Pattern to match table names',
              },
            },
            required: ['name_pattern'],
          },
        },
        {
          name: 'search_unity_tables_by_column',
          description: 'Search for tables containing columns matching the pattern in the Unity catalog',
          inputSchema: {
            type: 'object',
            properties: {
              column_pattern: {
                type: 'string',
                description: 'Pattern to match column names',
              },
            },
            required: ['column_pattern'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments as Record<string, any>;
      
      try {
        const result = await invokeUnityAgent(toolName, args);
        
        // Check if there was an error in the result
        if (result.error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.message || result.error}`,
              },
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error calling Unity catalog agent:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to call Unity catalog agent: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Unity Catalog MCP server running on stdio');
  }
}

const server = new UnityCatalogServer();
server.run().catch(console.error);
