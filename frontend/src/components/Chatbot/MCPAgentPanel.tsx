import React, { useState } from 'react';
import { useMCP } from '../../context/MCPContext';
import MCPAgentConfig from './MCPAgentConfig';
import { MCPServerConfig } from '../../types';
import '../../styles/Chatbot/MCPAgentPanel.css';

interface MCPAgentPanelProps {
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

const MCPAgentPanel: React.FC<MCPAgentPanelProps> = ({ 
  isExpanded = false, 
  onToggleExpanded 
}) => {
  const {
    servers,
    tools,
    status,
    isInitialized,
    isLoading,
    error,
    reloadServers,
    toolHitlStates,
    toggleToolHitl,
  } = useMCP();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const handleConfigSave = (config: MCPServerConfig[]) => {
    // Handle configuration save logic here
    console.log('Saving MCP configuration:', config);
  };

  const getServerTools = (serverName: string) => {
    return tools.filter(tool => tool.name.startsWith(serverName + '_'));
  };

  if (isLoading && !isInitialized) {
    return (
      <div className="mcp-agent-panel loading">
        <div className="loading-spinner"></div>
        <p>Loading MCP agents...</p>
      </div>
    );
  }

  if (error && !isInitialized) {
    return (
      <div className="mcp-agent-panel error">
        <p>Error: {error}</p>
        <button onClick={reloadServers}>Retry</button>
      </div>
    );
  }

  const enabledServers = servers.filter(s => s.enabled);

  return (
    <>
      <div className={`mcp-agent-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="panel-header">
          <h4>MCP Servers ({enabledServers.length}/{servers.length})</h4>
          <div className="header-actions">
            {status && (
              <span className="status-badge" title={`${status.loaded_servers} loaded servers, ${status.available_tools} tools`}>
                {status.available_tools} tools
              </span>
            )}
            <button 
              className="config-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfigOpen(true);
              }}
              title="Configure MCP Agents"
            >
              ⚙️
            </button>
            <button 
              className="reload-button"
              onClick={(e) => {
                e.stopPropagation();
                reloadServers();
              }}
              disabled={isLoading}
              title="Reload Servers"
            >
              🔄
            </button>
            <span 
              className={`expand-icon ${isExpanded ? 'rotated' : ''}`}
              onClick={onToggleExpanded}
              style={{ cursor: 'pointer' }}
            >
              ▼
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="panel-content">
            {isLoading && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading MCP agents...</p>
              </div>
            )}

            {error && (
              <div className="error-state">
                <p>Error: {error}</p>
                <button onClick={reloadServers}>Retry</button>
              </div>
            )}

            {!isInitialized && !isLoading && !error && (
              <div className="not-initialized-state">
                <p>MCP client not initialized</p>
                <button 
                  className="configure-button"
                  onClick={() => setIsConfigOpen(true)}
                >
                  Configure Now
                </button>
              </div>
            )}

            {isInitialized && !isLoading && (
              <div className="servers-overview">
                {servers.length === 0 ? (
                  <div className="no-servers">
                    <p>No MCP servers configured</p>
                    <small>Configure servers in the backend</small>
                  </div>
                ) : (
                  <div className="servers-list">
                    {servers.map(server => {
                      const serverTools = getServerTools(server.name);
                      
                      return (
                        <div key={server.name} className={`server-item ${server.enabled ? 'enabled' : 'disabled'}`}>
                          <div className="server-header">
                            <div className="server-info-main">
                              <span className="server-name">{server.name}</span>
                              <span className={`status-dot ${server.enabled ? 'connected' : 'disconnected'}`}></span>
                            </div>
                            <div className="server-meta">
                              <span className="tool-count">{serverTools.length} tools</span>
                              <span className="transport-badge">{server.transport}</span>
                            </div>
                          </div>
                          
                          {server.description && (
                            <div className="server-description">
                              <small>{server.description}</small>
                            </div>
                          )}
                          
                          {server.enabled && serverTools.length > 0 && (
                            <div className="tools-preview">
                              {serverTools.slice(0, 3).map(tool => (
                                <span 
                                  key={tool.name} 
                                  className="tool-tag"
                                  title={tool.description || tool.name}
                                >
                                  {tool.name.replace(server.name + '_', '')}
                                </span>
                              ))}
                              {serverTools.length > 3 && (
                                <span className="tool-tag more">+{serverTools.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tools.length > 0 && (
                  <div className="hitl-controls">
                    <div className="hitl-header">
                      <h5>Human-in-the-loop</h5>
                      <p>Require approval before specific tools run.</p>
                    </div>
                    <div className="hitl-tool-grid">
                      {tools.map(tool => {
                        const isEnabled = toolHitlStates.some(state => state.tool_name === tool.name && state.requires_human);
                        return (
                          <div key={tool.name} className="hitl-tool-card">
                            <div className="hitl-tool-info">
                              <span className="hitl-tool-name">{tool.name}</span>
                              {tool.description && <small>{tool.description}</small>}
                            </div>
                            <label className="hitl-switch">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={e => toggleToolHitl(tool.name, e.target.checked)}
                                disabled={isLoading}
                              />
                              <span className="slider" />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="panel-footer">
                  <button 
                    className="advanced-config-button"
                    onClick={() => setIsConfigOpen(true)}
                  >
                    Advanced Configuration
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MCPAgentConfig
        isVisible={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSave={handleConfigSave}
      />
    </>
  );
};

export default MCPAgentPanel;