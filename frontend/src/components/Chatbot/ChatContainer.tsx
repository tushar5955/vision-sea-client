import React, { useRef, useEffect, useState } from 'react';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import LLMConfig, { LLMModel } from './LLMConfig';
import MCPAgentPanel from './MCPAgentPanel';
import ConversationManager from './ConversationManager';
import '../../styles/Chatbot/ChatContainer.css';
import { useChatContext } from '../../context/ChatContext';
import { useMCP } from '../../context/MCPContext';
import { chatAPI, handleAPIError } from '../../services/api';

const ChatContainer = () => {
  const { 
    messages, 
    handleSendMessage, 
    handleToggleImage, 
    isTyping,
    agentMode,
    resetToDefaultMode,
    conversationId,
    clearConversation
  } = useChatContext();
  const { callTool } = useMCP();
  const messageHolderRef = useRef<HTMLDivElement>(null);
  
  // State for LLM configuration
  const [showLLMConfig, setShowLLMConfig] = useState(false);
  const [currentModel, setCurrentModel] = useState<LLMModel>({
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and efficient model for most tasks',
    maxTokens: 128000
  });
  const [mcpPanelExpanded, setMcpPanelExpanded] = useState(false);
  const [showConversationManager, setShowConversationManager] = useState(false);

  useEffect(() => {
    if (messageHolderRef.current) {
      messageHolderRef.current.scrollTop = messageHolderRef.current.scrollHeight;
    }
  }, [messages]);

  const handleConversationSelect = async (selectedConvId: string) => {
    try {
      const conversation = await chatAPI.getConversation(selectedConvId);
      // You can update the messages with the conversation history here
      // For now, we'll just let the user know the conversation was loaded
      console.log('Loaded conversation:', conversation);
    } catch (err) {
      const apiError = handleAPIError(err);
      alert(`Failed to load conversation: ${apiError.message}`);
    }
  };

  // Optional: Add a back-to-hub button that appears only when in agent mode
  const renderBackToHubButton = () => {
    if (agentMode !== 'agentHub') {
      return (
        <button 
          className="back-to-hub-button"
          onClick={resetToDefaultMode}
          title="Return to AgentHub"
        >
          ← Back to Hub
        </button>
      );
    }
    return null;
  };

  // Render configuration toolbar
  const renderConfigToolbar = () => {
    return (
      <div className="config-toolbar">
        <button
          className={`config-button ${showConversationManager ? 'active' : ''}`}
          onClick={() => setShowConversationManager(true)}
          title="View Conversation History"
        >
          <span className="config-icon">💬</span>
          <span className="config-label">History</span>
        </button>
        <button
          className="config-button"
          onClick={clearConversation}
          title="Start New Conversation"
        >
          <span className="config-icon">➕</span>
          <span className="config-label">New</span>
        </button>
        <button
          className={`config-button ${showLLMConfig ? 'active' : ''}`}
          onClick={() => setShowLLMConfig(true)}
          title="Configure LLM Model"
        >
          <span className="config-icon">🤖</span>
          <span className="config-label">{currentModel.name}</span>
        </button>
        <button
          className={`config-button ${mcpPanelExpanded ? 'active' : ''}`}
          onClick={() => setMcpPanelExpanded(!mcpPanelExpanded)}
          title="Toggle MCP Agents & Tools"
        >
          <span className="config-icon">⚡</span>
          <span className="config-label">Tools</span>
        </button>
      </div>
    );
  };

  const handleModelSelect = (model: LLMModel) => {
    setCurrentModel(model);
    console.log('Selected model:', model);
  };

  return (
    <>
      <div className="chat-container">
        <MCPAgentPanel 
          isExpanded={mcpPanelExpanded} 
          onToggleExpanded={() => setMcpPanelExpanded(!mcpPanelExpanded)} 
        />
        
        <div className="message-holder-section" ref={messageHolderRef}>
          {renderBackToHubButton()}
          <MessageList messages={messages} />
        </div>
        
        <div className="chat-input-section">
          <ChatInput
            onToggleImage={handleToggleImage}
            onSendMessage={handleSendMessage}
          />
          {renderConfigToolbar()}
        </div>
      </div>

      <LLMConfig
        isVisible={showLLMConfig}
        onClose={() => setShowLLMConfig(false)}
        onModelSelect={handleModelSelect}
        currentModel={currentModel}
      />

      <ConversationManager
        isVisible={showConversationManager}
        onClose={() => setShowConversationManager(false)}
        onConversationSelect={handleConversationSelect}
        currentConversationId={conversationId}
      />
    </>
  );
};

export default ChatContainer;
