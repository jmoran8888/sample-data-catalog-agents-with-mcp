FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy MCP server code
COPY mcp/ ./mcp/
COPY agents/ ./agents/
COPY tools/ ./tools/

# Expose MCP port
EXPOSE 8000

# Run the Glue MCP server
CMD ["python", "-m", "mcp.glue_catalog_mcp_server"]
