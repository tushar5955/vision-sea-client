import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Configuration
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // You can add auth tokens or other headers here
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error: No response from server');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// API Error types
export interface APIError {
  message: string;
  status?: number;
  details?: any;
}

// Helper function to handle API errors
export const handleAPIError = (error: unknown): APIError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    return {
      message: axiosError.response?.data?.detail || axiosError.message || 'An error occurred',
      status: axiosError.response?.status,
      details: axiosError.response?.data,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred',
  };
};

// ==================== Chat API ====================

export interface ChatMessagePayload {
  role: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string | null;
  history?: ChatMessagePayload[];
}

export interface ChatMessageResponse {
  role: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessageResponse;
  history: ChatMessageResponse[];
}

export interface HitlActionRequest {
  name: string;
  args: Record<string, any>;
  tool_call_id?: string;
}

export interface AssistantStreamEvent {
  type: string;
  conversation_id: string;
  timestamp?: string;
  text?: string;
  content?: string;
  tool_name?: string;
  tool_call_id?: string;
  args?: Record<string, any>;
  output?: any;
  status?: string;
  interrupt_id?: string;
  action_requests?: HitlActionRequest[];
  decisions?: Array<{ tool_name: string; decision: string; reason?: string | null }>;
  message?: string;
}

export type HitlDecisionType = 'approve' | 'reject' | 'skip' | 'edit';

export interface HitlDecisionEntryRequest {
  action: HitlActionRequest;
  decision: HitlDecisionType;
  edited_args?: Record<string, any>;
  reason?: string;
}

export interface HitlDecisionRequestPayload {
  conversation_id: string;
  decisions: HitlDecisionEntryRequest[];
}

export interface StreamOptions {
  signal?: AbortSignal;
}

export interface ConversationListResponse {
  conversations: string[];
}

export const chatAPI = {
  // Send a message to the assistant
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/api/assistant/message', request);
    return response.data;
  },

  // Get list of all conversations
  listConversations: async (): Promise<ConversationListResponse> => {
    const response = await apiClient.get<ConversationListResponse>('/api/chat/conversations');
    return response.data;
  },

  // Get a specific conversation
  getConversation: async (conversationId: string): Promise<ChatResponse> => {
    const response = await apiClient.get<ChatResponse>(`/api/chat/${conversationId}`);
    return response.data;
  },

  // Delete a conversation
  deleteConversation: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/api/chat/${conversationId}`);
  },

  // Stream assistant response via SSE
  streamMessage: async (
    request: ChatRequest,
    onEvent: (event: AssistantStreamEvent) => void,
    options: StreamOptions = {}
  ): Promise<void> => {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abortListener = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/assistant/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(`Stream failed (${response.status}): ${message}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const trimmed = chunk.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr) as AssistantStreamEvent;
                onEvent(parsed);
              } catch (err) {
                console.error('Failed to parse stream event', err);
              }
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }
    }
  },

  // Submit a HITL decision
  submitHitlDecision: async (
    interruptId: string,
    request: HitlDecisionRequestPayload
  ): Promise<void> => {
    await apiClient.post(`/api/assistant/interrupts/${interruptId}`, request);
  },
};

// ==================== MCP API ====================

export interface MCPServerInfo {
  name: string;
  transport: string;
  description?: string | null;
  enabled: boolean;
  has_command: boolean;
  has_url: boolean;
}

export interface MCPServersResponse {
  servers: MCPServerInfo[];
}

export interface MCPStatusResponse {
  loaded_servers: number;
  available_tools: number;
}

export interface MCPToolInfo {
  name: string;
  description?: string | null;
}

export interface MCPToolsResponse {
  tools: MCPToolInfo[];
}

export interface ToolHitlStatus {
  tool_name: string;
  requires_human: boolean;
}

export interface ToolHitlStatusResponse {
  tools: ToolHitlStatus[];
}

export interface ToolHitlUpdateRequest {
  tool_name: string;
  requires_human: boolean;
}

export interface ToolInvokeRequest {
  tool_name: string;
  arguments?: Record<string, any>;
}

export interface ToolInvokeResponse {
  tool_name: string;
  arguments: Record<string, any>;
  output: any;
}

export const mcpAPI = {
  // Get list of all MCP servers
  listServers: async (): Promise<MCPServersResponse> => {
    const response = await apiClient.get<MCPServersResponse>('/api/mcp/servers');
    return response.data;
  },

  // Get MCP status
  getStatus: async (): Promise<MCPStatusResponse> => {
    const response = await apiClient.get<MCPStatusResponse>('/api/mcp/status');
    return response.data;
  },

  // Reload all MCP servers
  reloadServers: async (): Promise<void> => {
    await apiClient.post('/api/mcp/reload');
  },

  // Get list of all available tools
  listTools: async (): Promise<MCPToolsResponse> => {
    const response = await apiClient.get<MCPToolsResponse>('/api/mcp/tools');
    return response.data;
  },

  // Invoke a specific tool
  invokeTool: async (request: ToolInvokeRequest): Promise<ToolInvokeResponse> => {
    const response = await apiClient.post<ToolInvokeResponse>('/api/mcp/tools/invoke', request);
    return response.data;
  },

  // List HITL requirements per tool
  listToolHitlStates: async (): Promise<ToolHitlStatusResponse> => {
    const response = await apiClient.get<ToolHitlStatusResponse>('/api/mcp/tools/hitl');
    return response.data;
  },

  // Update HITL requirement for a tool
  updateToolHitlState: async (request: ToolHitlUpdateRequest): Promise<void> => {
    await apiClient.post('/api/mcp/tools/hitl', request);
  },
};

// ==================== Meta API ====================

export interface HealthResponse {
  status: string;
  timestamp?: number;
}

export const metaAPI = {
  // Root endpoint
  getRoot: async (): Promise<Record<string, string>> => {
    const response = await apiClient.get<Record<string, string>>('/');
    return response.data;
  },

  // Health check
  getHealth: async (): Promise<HealthResponse> => {
    const response = await apiClient.get<HealthResponse>('/health');
    return response.data;
  },
};

export default apiClient;
