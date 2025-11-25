FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy required Python modules
COPY mcp/__init__.py ./mcp/
COPY mcp/unity_catalog_mcp_server.py ./mcp/
COPY agents/__init__.py ./agents/
COPY agents/unity_catalog_agent.py ./agents/
COPY tools/__init__.py ./tools/
COPY tools/unity_tools.py ./tools/

# Expose MCP port
EXPOSE 8080

# Run the Unity MCP server
CMD ["python", "-m", "mcp.unity_catalog_mcp_server"]
