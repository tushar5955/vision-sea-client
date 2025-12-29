// ==================== Chat API Types ====================

export interface ChatMessagePayload {
  role: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatMessageResponse {
  role: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string | null;
  history?: ChatMessagePayload[];
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessageResponse;
  history: ChatMessageResponse[];
}

export interface ConversationListResponse {
  conversations: string[];
}

// ==================== MCP API Types ====================

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

export interface ToolInvokeRequest {
  tool_name: string;
  arguments?: Record<string, any>;
}

export interface ToolInvokeResponse {
  tool_name: string;
  arguments: Record<string, any>;
  output: any;
}

// ==================== Legacy/Local Types ====================
// These are kept for backward compatibility with existing components

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  description?: string;
}

export interface MCPServerConfig extends MCPServer {
  enabled: boolean;
  connectionTimeout?: number;
  retryAttempts?: number;
  autoReconnect?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  serverName?: string;
}

export interface MCPToolConfig extends MCPTool {
  enabled: boolean;
  serverName: string;
  permissions?: {
    allowExecute: boolean;
    requireConfirmation: boolean;
  };
}

export interface MCPServerStatus {
  name: string;
  connected: boolean;
  lastConnected?: Date;
  error?: string;
  toolCount: number;
}

export interface MCPClientConfig {
  servers: Record<string, MCPServer>;
  globalSettings?: {
    connectionTimeout: number;
    maxRetries: number;
    autoConnect: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface MCPToolExecution {
  toolName: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: Date;
  duration?: number;
}

// Component Props Types
export interface MCPAgentConfigProps {
  isVisible: boolean;
  onClose: () => void;
  onConfigSave: (config: MCPServerConfig[]) => void;
}

export interface MCPAgentPanelProps {
  className?: string;
  onToolSelect?: (tool: MCPTool) => void;
}

// ==================== Vite raw imports ====================
// Allow importing any file with the `?raw` query as a string (e.g., './file.tsx?raw')
declare module '*?raw' {
  const content: string;
  export default content;
}