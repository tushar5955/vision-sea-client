import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  mcpAPI,
  handleAPIError,
  MCPServerInfo,
  MCPToolInfo,
  ToolHitlStatus,
  ToolHitlUpdateRequest,
} from '../services/api';

interface MCPContextType {
  isInitialized: boolean;
  servers: MCPServerInfo[];
  tools: MCPToolInfo[];
  status: {
    loaded_servers: number;
    available_tools: number;
  } | null;
  callTool: (toolName: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
  reloadServers: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  toolHitlStates: ToolHitlStatus[];
  toggleToolHitl: (toolName: string, requiresHuman: boolean) => Promise<void>;
  refreshToolHitl: () => Promise<void>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

interface MCPProviderProps {
  children: ReactNode;
}

export const MCPProvider: React.FC<MCPProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [status, setStatus] = useState<{ loaded_servers: number; available_tools: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolHitlStates, setToolHitlStates] = useState<ToolHitlStatus[]>([]);

  const loadMCPData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch in parallel, but don't fail the whole load if one call errors.
      const [serversResult, toolsResult, statusResult, hitlResult] = await Promise.allSettled([
        mcpAPI.listServers(),
        mcpAPI.listTools(),
        mcpAPI.getStatus(),
        mcpAPI.listToolHitlStates(),
      ]);

      const errors: string[] = [];

      if (serversResult.status === 'fulfilled') {
        setServers(serversResult.value.servers);
      } else {
        errors.push(`Servers: ${handleAPIError(serversResult.reason).message}`);
      }

      if (toolsResult.status === 'fulfilled') {
        setTools(toolsResult.value.tools);
      } else {
        errors.push(`Tools: ${handleAPIError(toolsResult.reason).message}`);
        setTools([]);
      }

      if (statusResult.status === 'fulfilled') {
        setStatus(statusResult.value);
      } else {
        errors.push(`Status: ${handleAPIError(statusResult.reason).message}`);
        setStatus(null);
      }

      if (hitlResult.status === 'fulfilled') {
        setToolHitlStates(hitlResult.value.tools);
      } else {
        // HITL is optional for basic MCP usage; keep UI usable if it fails.
        errors.push(`HITL: ${handleAPIError(hitlResult.reason).message}`);
        setToolHitlStates([]);
      }

      // Consider MCP "initialized" as long as we can show something.
      if (
        (serversResult.status === 'fulfilled' && serversResult.value.servers.length >= 0) ||
        toolsResult.status === 'fulfilled' ||
        statusResult.status === 'fulfilled'
      ) {
        setIsInitialized(true);
      }

      if (errors.length) {
        setError(errors.join(' | '));
      }
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
      console.error('Failed to load MCP data:', apiError);
    } finally {
      setIsLoading(false);
    }
  };

  const reloadServers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await mcpAPI.reloadServers();
      // Reload data after successful reload
      await loadMCPData();
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
      console.error('Failed to reload servers:', apiError);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToolHitl = async () => {
    try {
      const response = await mcpAPI.listToolHitlStates();
      setToolHitlStates(response.tools);
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
      console.error('Failed to refresh HITL states:', apiError);
    }
  };

  const toggleToolHitl = async (toolName: string, requiresHuman: boolean) => {
    const payload: ToolHitlUpdateRequest = {
      tool_name: toolName,
      requires_human: requiresHuman,
    };
    try {
      await mcpAPI.updateToolHitlState(payload);
      setToolHitlStates(prev => {
        const exists = prev.some(tool => tool.tool_name === toolName);
        if (exists) {
          return prev.map(tool =>
            tool.tool_name === toolName
              ? { ...tool, requires_human: requiresHuman }
              : tool,
          );
        }
        return [...prev, { tool_name: toolName, requires_human: requiresHuman }];
      });
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
      console.error('Failed to update HITL state:', apiError);
    }
  };

  const callTool = async (toolName: string, args: any) => {
    try {
      const response = await mcpAPI.invokeTool({
        tool_name: toolName,
        arguments: args,
      });

      return {
        success: true,
        result: response.output,
      };
    } catch (err) {
      const apiError = handleAPIError(err);
      console.error(`Error calling tool ${toolName}:`, apiError);
      return {
        success: false,
        error: apiError.message,
      };
    }
  };

  // Load MCP data on mount
  useEffect(() => {
    loadMCPData();
  }, []);

  const value: MCPContextType = {
    isInitialized,
    servers,
    tools,
    status,
    callTool,
    reloadServers,
    isLoading,
    error,
    toolHitlStates,
    toggleToolHitl,
    refreshToolHitl,
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
};