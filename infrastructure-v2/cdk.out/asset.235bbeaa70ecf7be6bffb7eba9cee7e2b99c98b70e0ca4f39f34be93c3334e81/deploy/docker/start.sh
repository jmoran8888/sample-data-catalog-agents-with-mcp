#!/bin/bash

# Start Unity Catalog MCP server on port 8001
echo "Starting Unity Catalog MCP server on port 8001..."
cd /app
python -m mcp.unity_catalog_mcp_server &
UNITY_PID=$!

# Start Glue Catalog MCP server on port 8002  
echo "Starting Glue Catalog MCP server on port 8002..."
GLUE_MCP_PORT=8002 python -c "
import os
os.environ['PORT'] = '8002'
exec(open('mcp/glue_catalog_mcp_server.py').read())
" &
GLUE_PID=$!

# Wait for MCP servers to start
sleep 5

echo "MCP servers started. Unity PID: $UNITY_PID, Glue PID: $GLUE_PID"

# Set environment variables for MCP server URLs
export UNITY_MCP_URL="http://localhost:8001/mcp"
export GLUE_MCP_URL="http://localhost:8002/mcp"

# Start Streamlit
echo "Starting Streamlit..."
exec streamlit run streamlit_demo.py --server.port=8501 --server.address=0.0.0.0
