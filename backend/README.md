# MCP Host Backend

A FastAPI-based backend for hosting and managing multiple Model Context Protocol (MCP) servers.

## Features

- ✅ **Multi-Server Management**: Load and manage multiple MCP servers from configuration
- ✅ **RESTful API**: Complete REST API for chat, tool invocation, and server management
- ✅ **Real-time Chat**: Chat with MCP agents that can invoke tools from connected servers
- ✅ **Tool Invocation**: Direct tool invocation with argument validation
- ✅ **Server Control**: Enable/disable servers dynamically
- ✅ **Auto-initialization**: Automatic MCP client initialization on startup
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **CORS Support**: Cross-origin resource sharing for frontend integration

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install fastapi uvicorn
# Optional: Install MCP dependencies when available
# pip install langchain-mcp-adapters langgraph
```

### 2. Set Up Configuration

Copy the example configuration file and add your API keys:

```bash
cp src/configuration/config.toml.example src/configuration/config.toml
```

Then edit `src/configuration/config.toml` with your actual API keys:
- OpenAI API key
- LangSmith API key (optional, for tracing)
- Binance API credentials (if using Binance MCP server)

**Important**: Never commit `config.toml` to git - it's already in `.gitignore`.

### 3. Configure MCP Servers

The repo ships with sample Binance and Playwright servers **disabled** so the backend can start without those binaries. To enable a server, set `"enabled": true` and ensure the referenced command plus credentials exist on your machine. Edit `src/client/mcp-servers.json`:

```json
{
  "mcpServers": {
    "binance": {
      "command": "path/to/binance-mcp-server.exe",
      "args": ["--api-key", "your_key", "--api-secret", "your_secret"],
      "transport": "stdio",
      "enabled": true
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "transport": "stdio",
      "enabled": true
    }
  }
}
```

### 3. Start the Backend

```bash
# Option 1: Using the startup script
python run_server.py

# Option 2: Direct uvicorn
cd src
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Health & Status
- `GET /` - Root endpoint
- `GET /health` - Health check with MCP status
- `GET /api/mcp/status` - Summarise loaded servers and tool count

### MCP Management
- `GET /api/mcp/servers` - List configured servers
- `POST /api/mcp/reload` - Reload server configuration from disk

### Tools
- `GET /api/mcp/tools` - List available MCP tools (name + description)
- `POST /api/mcp/tools/invoke` - Invoke a specific tool via the MCP client

### Chat & Assistant
- `POST /api/assistant/message` - Send user input and receive assistant reply
- `GET /api/chat/conversations` - List active conversation IDs
- `GET /api/chat/{conversation_id}` - Fetch full history for a conversation
- `DELETE /api/chat/{conversation_id}` - Clear a stored conversation

## Example API Usage

### Chat with Agent
```bash
curl -X POST "http://localhost:8000/api/assistant/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the current Bitcoin price?"
  }'
```

### Invoke Tool Directly
```bash
curl -X POST "http://localhost:8000/api/mcp/tools/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "binance_get_price",
    "arguments": {"symbol": "BTCUSDT"}
  }'
```

### Toggle Server
```bash
curl -X POST "http://localhost:8000/api/mcp/servers/toggle" \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "binance",
    "enabled": false
  }'
```

## Development Mode

The backend includes mock implementations for testing without real MCP servers:

1. **Mock Tools**: Simulated Binance and Playwright tools
2. **Mock Responses**: Realistic responses for testing
3. **Fallback Mode**: Graceful degradation when MCP dependencies are missing

### Testing Without MCP Servers

The backend will work in mock mode even without MCP dependencies installed:

```bash
# Start in mock mode (no MCP dependencies needed)
python run_server.py
```

## Project Structure

```
backend/
├── src/
│   ├── main.py                 # FastAPI application
│   ├── api/
│   │   ├── input_payload.py    # Request models
│   │   └── output_payload.py   # Response models
│   ├── configuration/
│   │   └── config.toml         # Optional local overrides
│   ├── client/
│   │   ├── manager.py          # MCP client manager
│   │   ├── models.py           # MCP registry models
│   │   └── mcp-servers.json    # MCP server config
├── run_server.py               # Startup script
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Integration with Frontend

The backend is designed to work with the React frontend:

1. **CORS Enabled**: Allows requests from frontend (localhost:3000, localhost:5173)
2. **WebSocket Ready**: Prepared for streaming chat (future)
3. **Real-time Updates**: Server status and tool availability

### Frontend Integration Example

```typescript
import { backendMCPClient } from './services/backendMcpClient';

// Initialize connection
await backendMCPClient.initialize();

// Send chat message
const response = await backendMCPClient.sendChatMessage("Hello!");

// Invoke tool
const result = await backendMCPClient.callTool("binance_get_price", {
  symbol: "BTCUSDT"
});
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server settings
HOST=0.0.0.0
PORT=8000
DEBUG=true

# Logging
LOG_LEVEL=info

# CORS origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### MCP Server Configuration

The `mcp-servers.json` file supports various MCP server types:

```json
{
  "mcpServers": {
    "stdio_server": {
      "command": "/path/to/server",
      "args": ["--arg1", "value1"],
      "transport": "stdio"
    },
    "http_server": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable_http"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Backend not starting**: Check if required dependencies are installed
2. **MCP servers not loading**: Verify paths and arguments in configuration
3. **CORS errors**: Ensure frontend URL is in CORS origins
4. **Tool invocation fails**: Check if servers are enabled and initialized

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug python run_server.py
```

### Health Check

Verify backend is working:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "mcp_initialized": true,
  "timestamp": "2025-10-27T12:00:00.000Z"
}
```

## Next Steps

1. **Install Real MCP Dependencies**: `pip install langchain-mcp-adapters langgraph`
2. **Configure Real MCP Servers**: Update configuration with actual server paths
3. **Tune MCP Timeouts**: Set `VISIONSEA_MCP_TOOL_TIMEOUT_SECONDS` if you want the backend to fail fast when tool discovery hangs (default is unlimited)
4. **Add Authentication**: Secure API endpoints
5. **Add Monitoring**: Implement metrics and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is part of the VisionSea MCP Host application.