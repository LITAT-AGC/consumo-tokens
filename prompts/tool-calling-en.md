# MCP Server Integration Task

You are an AI assistant helping a developer integrate MCP (Model Context Protocol) servers into their application.

## Context
The developer has a Node.js application and wants to connect multiple MCP servers to extend functionality:
- A filesystem server for file operations
- A database server for PostgreSQL queries  
- A web search server for retrieving documentation

## Available MCP Tools

### Filesystem Server
Tools: read_file, write_file, list_directory, search_files, get_file_info
Connection: stdio transport, path: /usr/local/bin/mcp-server-filesystem

### Database Server  
Tools: execute_query, list_tables, describe_table, get_schema
Connection: stdio transport, requires PG_CONNECTION_STRING env var

### Web Search Server
Tools: search_web, fetch_page, extract_code
Connection: SSE transport, endpoint: http://localhost:3000/sse

## Task Requirements

1. **Server Configuration**
   - Create a configuration file that defines all three MCP servers
   - Include proper connection parameters and environment variables
   - Set appropriate timeouts and retry policies

2. **Client Implementation**
   - Write code to initialize the MCP client
   - Implement connection logic for each server type (stdio and SSE)
   - Add error handling for connection failures

3. **Tool Discovery**
   - Query each server for available tools
   - Build a unified tool registry
   - Handle tool name conflicts if they occur

4. **Request Routing**
   - Implement logic to route tool calls to the correct server
   - Support parallel execution when tools are independent
   - Handle dependencies between tool calls

5. **Error Handling**
   - Retry failed tool calls with exponential backoff
   - Gracefully degrade if a server is unavailable
   - Log errors with context for debugging

## Expected Output

Provide complete, production-ready code including:
- Configuration file (JSON or YAML)
- MCP client class with connection management
- Tool registry and routing logic
- Error handling middleware
- Usage examples demonstrating all three servers
- Unit tests for critical paths

Use TypeScript with proper type definitions for MCP protocol types.
