import React, { useState, useEffect } from 'react';
import { useMCP } from '../../context/MCPContext';
import { MCPServerConfig, MCPToolConfig, MCPAgentConfigProps } from '../../types';
import '../../styles/Chatbot/MCPAgentConfig.css';

const MCPAgentConfig: React.FC<MCPAgentConfigProps> = ({
  isVisible,
  onClose,
  onConfigSave
}) => {
  const {
    servers,
    tools,
    isLoading,
    error
  } = useMCP();

  const [activeTab, setActiveTab] = useState<'servers' | 'tools' | 'advanced'>('servers');
  const [serverConfigs, setServerConfigs] = useState<MCPServerConfig[]>([]);
  const [toolConfigs, setToolConfigs] = useState<MCPToolConfig[]>([]);
  const [globalSettings, setGlobalSettings] = useState({
    autoConnect: true,
    connectionTimeout: 30,
    maxRetries: 3,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error'
  });

  // Initialize server configs when component mounts or data changes
  useEffect(() => {
    if (!servers) return;
    const configs = servers.map(server => ({
      name: server.name,
      command: '', // This would come from actual config
      args: [],
      enabled: server.enabled,
      connectionTimeout: 30,
      retryAttempts: 3,
      description: server.description || `${server.name} MCP server`
    }));
    setServerConfigs(configs);
  }, [servers]);

  // Initialize tool configs
  useEffect(() => {
    if (!tools) return;
    const configs = tools.map(tool => ({
      name: tool.name,
      serverName: tool.name.split('_')[0] || 'unknown',
      enabled: true,
      description: tool.description || 'No description available',
      inputSchema: undefined // MCPToolInfo from backend doesn't include inputSchema
    }));
    setToolConfigs(configs);
  }, [tools]);

  const handleServerToggle = (serverName: string) => {
    // Note: Backend API doesn't support toggling individual servers yet
    // This would need to be implemented in the backend
    setServerConfigs(prev => 
      prev.map(config => 
        config.name === serverName 
          ? { ...config, enabled: !config.enabled }
          : config
      )
    );
  };

  const handleToolToggle = (toolName: string) => {
    setToolConfigs(prev =>
      prev.map(config =>
        config.name === toolName
          ? { ...config, enabled: !config.enabled }
          : config
      )
    );
  };

  const handleServerConfigChange = (serverName: string, field: keyof MCPServerConfig, value: any) => {
    setServerConfigs(prev =>
      prev.map(config =>
        config.name === serverName
          ? { ...config, [field]: value }
          : config
      )
    );
  };

  const handleSave = () => {
    onConfigSave(serverConfigs);
    onClose();
  };

  const getServerTools = (serverName: string) => {
    return toolConfigs.filter(tool => tool.serverName === serverName);
  };

  const getServerStatus = (serverName: string) => {
    const server = servers?.find(s => s.name === serverName);
    const isEnabled = server?.enabled || false;
    const toolCount = getServerTools(serverName).length;
    return { isEnabled, toolCount };
  };

  if (!isVisible) return null;

  return (
    <div className="mcp-config-overlay">
      <div className="mcp-config-modal">
        <div className="mcp-config-header">
          <h3>MCP Agent Configuration</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="mcp-config-tabs">
          <button
            className={`tab-button ${activeTab === 'servers' ? 'active' : ''}`}
            onClick={() => setActiveTab('servers')}
          >
            Servers ({servers?.length || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Tools ({tools?.length || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        <div className="mcp-config-content">
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="loading-banner">
              <div className="loading-spinner"></div>
              <span>Loading MCP configuration...</span>
            </div>
          )}

          {activeTab === 'servers' && (
            <div className="servers-config">
              <div className="section-header">
                <h4>Available Servers</h4>
                <p>Configure and manage your MCP servers</p>
              </div>
              
              {serverConfigs.length === 0 ? (
                <div className="empty-state">
                  <p>No MCP servers configured</p>
                  <small>Add servers to your config.json file to get started</small>
                </div>
              ) : (
                <div className="servers-list">
                  {serverConfigs.map(config => {
                    const { isEnabled, toolCount } = getServerStatus(config.name);
                    return (
                      <div key={config.name} className={`server-config-item ${isEnabled ? 'enabled' : 'disabled'}`}>
                        <div className="server-config-header">
                          <div className="server-info">
                            <label className="server-toggle">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => handleServerToggle(config.name)}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                            <div className="server-details">
                              <h5>{config.name}</h5>
                              <span className="server-stats">
                                {toolCount} tools • {isEnabled ? 'Connected' : 'Disconnected'}
                              </span>
                            </div>
                          </div>
                          <div className="server-status">
                            <span className={`status-indicator ${isEnabled ? 'connected' : 'disconnected'}`}></span>
                          </div>
                        </div>
                        
                        {isEnabled && (
                          <div className="server-config-details">
                            <div className="config-row">
                              <label>Description:</label>
                              <input
                                type="text"
                                value={config.description || ''}
                                onChange={(e) => handleServerConfigChange(config.name, 'description', e.target.value)}
                                placeholder="Server description"
                              />
                            </div>
                            <div className="config-row">
                              <label>Connection Timeout (seconds):</label>
                              <input
                                type="number"
                                value={config.connectionTimeout || 30}
                                onChange={(e) => handleServerConfigChange(config.name, 'connectionTimeout', parseInt(e.target.value))}
                                min="5"
                                max="300"
                              />
                            </div>
                            <div className="config-row">
                              <label>Retry Attempts:</label>
                              <input
                                type="number"
                                value={config.retryAttempts || 3}
                                onChange={(e) => handleServerConfigChange(config.name, 'retryAttempts', parseInt(e.target.value))}
                                min="0"
                                max="10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="tools-config">
              <div className="section-header">
                <h4>Available Tools</h4>
                <p>Configure individual tool settings and permissions</p>
              </div>
              
              {toolConfigs.length === 0 ? (
                <div className="empty-state">
                  <p>No tools available</p>
                  <small>Enable MCP servers to see available tools</small>
                </div>
              ) : (
                <div className="tools-list">
                  {Object.entries(
                    toolConfigs.reduce((acc, tool) => {
                      const serverName = tool.serverName || 'unknown';
                      if (!acc[serverName]) acc[serverName] = [];
                      acc[serverName].push(tool);
                      return acc;
                    }, {} as Record<string, MCPToolConfig[]>)
                  ).map(([serverName, serverTools]) => (
                    <div key={serverName} className="server-tools-group">
                      <h5 className="server-group-title">{serverName} Tools</h5>
                      {serverTools.map(tool => (
                        <div key={tool.name} className={`tool-config-item ${tool.enabled ? 'enabled' : 'disabled'}`}>
                          <div className="tool-header">
                            <label className="tool-toggle">
                              <input
                                type="checkbox"
                                checked={tool.enabled}
                                onChange={() => handleToolToggle(tool.name)}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                            <div className="tool-info">
                              <h6>{tool.name.replace(tool.serverName + '_', '')}</h6>
                              <p className="tool-description">{tool.description}</p>
                            </div>
                          </div>
                          {tool.inputSchema && (
                            <div className="tool-schema">
                              <small>Input Schema: {JSON.stringify(tool.inputSchema, null, 2).substring(0, 100)}...</small>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="advanced-config">
              <div className="section-header">
                <h4>Advanced Settings</h4>
                <p>Configure global MCP client behavior</p>
              </div>
              
              <div className="config-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={globalSettings.autoConnect}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, autoConnect: e.target.checked }))}
                  />
                  <span>Auto-connect to servers on startup</span>
                </label>
              </div>

              <div className="config-section">
                <label>Default Connection Timeout (seconds):</label>
                <input
                  type="range"
                  min="5"
                  max="120"
                  value={globalSettings.connectionTimeout}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, connectionTimeout: parseInt(e.target.value) }))}
                  className="slider"
                />
                <span className="slider-value">{globalSettings.connectionTimeout}s</span>
              </div>

              <div className="config-section">
                <label>Max Retry Attempts:</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={globalSettings.maxRetries}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                  className="slider"
                />
                <span className="slider-value">{globalSettings.maxRetries}</span>
              </div>

              <div className="config-section">
                <label>Log Level:</label>
                <select
                  value={globalSettings.logLevel}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, logLevel: e.target.value as any }))}
                  className="select-input"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="mcp-config-footer">
          <div className="footer-stats">
            <span>{servers?.filter(s => s.enabled).length || 0}/{servers?.length || 0} servers enabled</span>
            <span>{tools?.length || 0} tools available</span>
          </div>
          <div className="footer-buttons">
            <button className="cancel-button" onClick={onClose}>Cancel</button>
            <button className="save-button" onClick={handleSave}>Save Configuration</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPAgentConfig;