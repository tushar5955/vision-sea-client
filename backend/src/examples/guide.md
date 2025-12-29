```markdown
# LangChain MCP Adapters Guide

## Overview

LangChain MCP Adapters provide a lightweight wrapper to make Anthropic Model Context Protocol (MCP) tools compatible with LangChain and LangGraph. It supports both Python and JavaScript/TypeScript implementations.

### Key Features

- 🔌 Convert MCP tools into LangChain-compatible tools
- 🌐 Connect to multiple MCP servers and load tools dynamically
- 🧠 Integrate with LangGraph agents and StateGraph
- 📡 Support for streamable HTTP and stdio transports
- 🔐 Runtime headers for authentication and tracing

---

## Installation

```bash
pip install langchain-mcp-adapters
```

Also install dependencies:

```bash
pip install langgraph "langchain[openai]"
export OPENAI_API_KEY=<your_api_key>
```

---

## Creating MCP Servers

### Math Server (stdio)

```python
# math_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    return a * b

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Weather Server (streamable-http)

```python
# weather_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Weather")

@mcp.tool()
async def get_weather(location: str) -> str:
    return "It's always sunny in New York"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

---

## Connecting MCP Clients

### Single Server (stdio)

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

server_params = StdioServerParameters(
    command="python",
    args=["/path/to/math_server.py"]
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await load_mcp_tools(session)
        agent = create_react_agent("openai:gpt-4.1", tools)
        response = await agent.ainvoke({"messages": "what's (3 + 5) x 12?"})
```

### Multiple Servers

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

client = MultiServerMCPClient({
    "math": {
        "command": "python",
        "args": ["/path/to/math_server.py"],
        "transport": "stdio"
    },
    "weather": {
        "url": "http://localhost:8000/mcp",
        "transport": "streamable_http"
    }
})

tools = await client.get_tools()
agent = create_react_agent("openai:gpt-4.1", tools)

math_response = await agent.ainvoke({"messages": "what's (3 + 5) x 12?"})
weather_response = await agent.ainvoke({"messages": "what is the weather in nyc?"})
```

---

## Streamable HTTP Client

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

async with streamablehttp_client("http://localhost:3000/mcp") as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await load_mcp_tools(session)
        agent = create_react_agent("openai:gpt-4.1", tools)
        response = await agent.ainvoke({"messages": "what's (3 + 5) x 12?"})
```

---

## Runtime Headers

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "weather": {
        "transport": "streamable_http",
        "url": "http://localhost:8000/mcp",
        "headers": {
            "Authorization": "Bearer YOUR_TOKEN",
            "X-Custom-Header": "custom-value"
        }
    }
})
```

---

## LangGraph StateGraph Integration

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, MessagesState, START
from langgraph.prebuilt import ToolNode, tools_condition
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4.1")

client = MultiServerMCPClient({
    "math": {
        "command": "python",
        "args": ["./examples/math_server.py"],
        "transport": "stdio"
    },
    "weather": {
        "url": "http://localhost:8000/mcp",
        "transport": "streamable_http"
    }
})

tools = await client.get_tools()

def call_model(state: MessagesState):
    response = model.bind_tools(tools).invoke(state["messages"])
    return {"messages": response}

builder = StateGraph(MessagesState)
builder.add_node(call_model)
builder.add_node(ToolNode(tools))
builder.add_edge(START, "call_model")
builder.add_conditional_edges("call_model", tools_condition)
builder.add_edge("tools", "call_model")

graph = builder.compile()
math_response = await graph.ainvoke({"messages": "what's (3 + 5) x 12?"})
weather_response = await graph.ainvoke({"messages": "what is the weather in nyc?"})
```

---

## LangGraph API Server Integration

### graph.py

```python
from contextlib import asynccontextmanager
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

async def make_graph():
    client = MultiServerMCPClient({
        "math": {
            "command": "python",
            "args": ["/path/to/math_server.py"],
            "transport": "stdio"
        },
        "weather": {
            "url": "http://localhost:8000/mcp",
            "transport": "streamable_http"
        }
    })
    tools = await client.get_tools()
    agent = create_react_agent("openai:gpt-4.1", tools)
    return agent
```

### langgraph.json

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./graph.py:make_graph"
  }
}
```

---

## Converting LangChain Tools to FastMCP

```python
from langchain_core.tools import tool
from langchain_mcp_adapters.tools import to_fastmcp
from mcp.server.fastmcp import FastMCP

@tool
def add(a: int, b: int) -> int:
    return a + b

fastmcp_tool = to_fastmcp(add)
mcp = FastMCP("Math", tools=[fastmcp_tool])
mcp.run(transport="stdio")
```

---

## Notes

- Ensure MCP version >= 1.9.1 for `tools` argument in FastMCP
- Only `sse` and `streamable_http` transports support runtime headers
- Each tool invocation starts a new MCP ClientSession unless explicitly managed
```