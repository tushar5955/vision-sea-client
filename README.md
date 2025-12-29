# VisionSea MCP Client

A production-ready Model Context Protocol (MCP) client application with an AI-powered assistant interface. Built with React 19 + TypeScript frontend and FastAPI + LangGraph backend, featuring LangChain MCP adapters for seamless tool integration.

## 🏗️ Architecture

- **Frontend**: React 19 + TypeScript + Vite + Monaco Editor
- **Backend**: FastAPI + Python 3.11 + LangChain + LangGraph
- **AI/ML**: OpenAI GPT-4o-mini + LangChain MCP Adapters
- **Agent Framework**: LangGraph with Human-in-the-Loop middleware
- **Visualization**: Nivo Charts + React Three Fiber
- **Deployment**: Docker + Docker Compose + Nginx
- **Protocol**: Model Context Protocol (MCP) v1.0

## ✨ Key Features

- 🤖 **AI-Powered Assistant**: LangGraph-based agent with streaming responses
- 🔧 **MCP Tool Integration**: Multi-server MCP client with dynamic tool discovery
- 👤 **Human-in-the-Loop**: Interactive approval workflow for tool calls
- 💬 **Conversational UI**: Real-time chat with conversation management
- 🎨 **Rich Visualizations**: Interactive charts and 3D graphics
- 📝 **Code Editor**: Monaco-powered code editing and execution
- 🔄 **Streaming Support**: Server-sent events for real-time responses
- 🎭 **Multi-theme Support**: Including custom "Turtle" theme

## 📁 Project Structure

```
v1/
├── frontend/                     # React 19 + TypeScript frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Chatbot/        # Chat interface components
│   │   │   ├── Interface/      # Tool execution & code editor
│   │   │   └── Layout/         # Layout components
│   │   ├── context/            # React contexts (Chat, MCP, Theme)
│   │   ├── services/           # API client services
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   └── public/                 # Static assets
├── backend/                     # FastAPI + LangGraph backend
│   ├── src/
│   │   ├── api/                # API routes & payloads
│   │   │   └── routers/        # Assistant, Chat, MCP endpoints
│   │   ├── client/             # MCP client manager
│   │   ├── services/           # Business logic layer
│   │   │   ├── assistant_service.py  # LangGraph agent
│   │   │   └── chat_service.py       # Conversation storage
│   │   ├── core/               # Settings & configuration
│   │   └── web/                # Dependencies & middleware
│   └── tests/                  # Unit & integration tests
├── docker/                      # Docker Compose configurations
├── notebooks/                   # Jupyter notebooks for experiments
└── scripts/                     # Utility scripts
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended for deployment)
- **Node.js 18+** (for frontend development)
- **Python 3.11+** (for backend development)
- **OpenAI API Key** (for AI assistant functionality)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd v1
   ```

2. **Environment Configuration**
   
   Create configuration files for the backend:
   
   ```bash
   # Backend environment variables (create .env in backend/)
   VISIONSEA_OPENAI_API_KEY=your-openai-api-key
   VISIONSEA_OPENAI_MODEL_NAME=gpt-4o-mini
   VISIONSEA_API_PREFIX=/api
   ```
   
   Or use `backend/src/configuration/config.toml` for settings.

3. **Backend Setup**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   
   # Start development server
   uvicorn src.app:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   
   # Install dependencies
   npm install
   
   # Start development server
   npm run dev
   ```

5. **Configure MCP Servers**
   
   Edit `backend/src/client/mcp-servers.json` to add your MCP servers:
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
       }
     }
   }
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Alternative API Docs: http://localhost:8000/redoc

## 🐳 Docker Deployment

### Development Environment
```bash
cd docker
docker-compose -f docker-compose.dev.yml up --build
```

### Production Environment
```bash
cd docker
docker-compose up --build -d
```

The production setup includes:
- Frontend container (port 3000)
- Backend container (port 8000)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Nginx reverse proxy

### Docker Architecture
- **frontend**: React app served via Vite/Nginx
- **backend**: FastAPI application with Uvicorn
- **db**: PostgreSQL 15 for persistent data
- **redis**: Redis for caching and sessions

## 🔧 Development

### Backend Development

```bash
cd backend

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run tests
pytest
pytest --cov=src --cov-report=html

# Code formatting
black src/
isort src/

# Type checking
mypy src/

# Start development server with auto-reload
uvicorn src.app:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📡 API Endpoints

### Assistant API (`/api/assistant`)
- `POST /api/assistant/message` - Send message to AI assistant (non-streaming)
- `POST /api/assistant/stream` - Send message with streaming response (SSE)
- `POST /api/assistant/interrupts/{interrupt_id}` - Resolve HITL (Human-in-the-Loop) interrupts

### Chat API (`/api/chat`)
- `GET /api/chat/conversations` - List all conversations
- `GET /api/chat/{conversation_id}` - Get conversation history
- `DELETE /api/chat/{conversation_id}` - Delete a conversation

### MCP API (`/api/mcp`)
- `GET /api/mcp/servers` - List connected MCP servers
- `GET /api/mcp/tools` - List available tools from all servers
- `POST /api/mcp/refresh` - Refresh tool discovery

## 🤖 Agent Architecture

The assistant uses **LangGraph** to create a stateful agent with:

1. **Tool Integration**: Dynamic MCP tool discovery via `langchain-mcp-adapters`
2. **Conversation Memory**: In-memory checkpoint saver for multi-turn conversations
3. **Human-in-the-Loop**: Interrupt mechanism for user approval of tool calls
4. **Streaming**: Token-by-token and event-based streaming responses
5. **Error Handling**: Graceful fallbacks when LLM credentials are missing

### Agent Flow
```
User Message → LangGraph Agent → Tool Selection → HITL Check → Tool Execution → Response
```

## 🧪 Testing

### Backend Tests
```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_mcp_manager.py

# Run with verbose output
pytest -v
```

### Test Files
- `tests/test_app.py` - API endpoint tests
- `tests/test_mcp_manager.py` - MCP client manager tests
- `tests/test_mcp_models.py` - MCP models and configuration tests

## 📦 Dependencies

### Backend
- **FastAPI 0.104** - Modern web framework
- **LangChain** - LLM orchestration framework
- **LangGraph 0.1.10** - Agent workflow management
- **langchain-mcp-adapters 0.0.7** - MCP integration for LangChain
- **langchain-openai 0.1.7** - OpenAI LLM integration
- **MCP SDK 0.1.0** - Model Context Protocol client
- **Pydantic 2.5** - Data validation
- **Uvicorn** - ASGI server
- **SQLAlchemy 2.0** - ORM (for future database features)
- **Redis 5.0** - Caching layer

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Monaco Editor** - VS Code-powered code editor
- **Nivo Charts** - Data visualization
- **React Three Fiber** - 3D graphics
- **Axios** - HTTP client
- **React Icons** - Icon library

## 🔒 Security & Configuration

- **Environment Variables**: Sensitive configuration via `.env` or environment
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Pydantic models for request/response validation
- **API Key Security**: OpenAI API keys never exposed to frontend
- **Tool Timeouts**: Configurable timeouts to prevent hanging

### Configuration Options

Backend settings can be configured via:
1. Environment variables (prefixed with `VISIONSEA_`)
2. `backend/src/configuration/config.toml` file
3. `.env` file in backend directory

Key settings:
```toml
[app]
api_prefix = "/api"
openai_model_name = "gpt-4o-mini"
default_temperature = 0.1
mcp_tool_timeout_seconds = 360.0

[cors]
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
```

## 🛠️ MCP Server Configuration

MCP servers are configured in `backend/src/client/mcp-servers.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

Example configurations:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/directory"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## 🎯 Features in Detail

### Chat Interface
- Real-time messaging with AI assistant
- Conversation history management
- Streaming token-by-token responses
- Message metadata support
- Multiple conversation support

### Human-in-the-Loop (HITL)
- Tool call approval workflow
- Interactive decision making (approve/reject/edit)
- Argument editing before execution
- Custom rejection reasons
- Visual tool call tracking

### Tool Execution
- Multi-server MCP client support
- Dynamic tool discovery
- Automatic tool refresh
- Tool execution monitoring
- Error handling and reporting

### Code Editor
- Monaco Editor integration (VS Code engine)
- Syntax highlighting
- Code execution capabilities
- Multiple language support

### Visualization
- Interactive charts (Line, Bar, Pie, Radar)
- 3D graphics rendering
- Real-time data updates
- Responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Coding Standards
- **Backend**: Follow PEP 8, use Black for formatting, type hints required
- **Frontend**: Use TypeScript, follow ESLint rules, functional components preferred
- **Commits**: Use conventional commits format

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support & Documentation

- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)
- **OpenAPI Schema**: http://localhost:8000/openapi.json
- **Issues**: GitHub Issues
- **Examples**: See `backend/src/examples/` for usage examples

## 🗺️ Roadmap

### Current Features ✅
- Multi-server MCP client integration
- LangGraph-based AI agent
- Human-in-the-Loop workflow
- Streaming responses
- Conversation management
- Code editor integration
- Data visualization

### Planned Features 🚧
- Database persistence for conversations
- User authentication and authorization
- Multi-user support
- Custom MCP server templates
- Advanced agent configurations
- WebSocket support for real-time updates
- Performance monitoring dashboard
- Deployment to cloud platforms (AWS, GCP, Azure)

## 🙏 Acknowledgments

- **Model Context Protocol**: MCP SDK and specification
- **LangChain**: Agent orchestration framework
- **LangGraph**: Stateful agent workflows
- **FastAPI**: Modern Python web framework
- **React**: UI library
- **Vite**: Next-generation build tool

---

**Built with ❤️ using MCP, LangChain, and modern web technologies**