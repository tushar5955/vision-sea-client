import React, { useState, useEffect } from 'react';
import { chatAPI, handleAPIError } from '../../services/api';
import '../../styles/Chatbot/ConversationManager.css';

interface ConversationManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onConversationSelect: (conversationId: string) => void;
  currentConversationId: string | null;
}

const ConversationManager: React.FC<ConversationManagerProps> = ({
  isVisible,
  onClose,
  onConversationSelect,
  currentConversationId
}) => {
  const [conversations, setConversations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadConversations();
    }
  }, [isVisible]);

  const loadConversations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await chatAPI.listConversations();
      setConversations(response.conversations);
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Delete conversation ${conversationId}?`)) {
      return;
    }

    try {
      await chatAPI.deleteConversation(conversationId);
      setConversations(prev => prev.filter(id => id !== conversationId));
    } catch (err) {
      const apiError = handleAPIError(err);
      alert(`Failed to delete conversation: ${apiError.message}`);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId);
    onClose();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="conversation-manager-overlay" onClick={onClose}>
      <div className="conversation-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Conversation History</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading conversations...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>Error: {error}</p>
              <button onClick={loadConversations}>Retry</button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {conversations.length === 0 ? (
                <div className="empty-state">
                  <p>No conversations yet</p>
                  <small>Start chatting to create your first conversation</small>
                </div>
              ) : (
                <div className="conversations-list">
                  {conversations.map(convId => (
                    <div
                      key={convId}
                      className={`conversation-item ${convId === currentConversationId ? 'active' : ''}`}
                      onClick={() => handleConversationClick(convId)}
                    >
                      <div className="conversation-info">
                        <span className="conversation-id">{convId}</span>
                        {convId === currentConversationId && (
                          <span className="current-badge">Current</span>
                        )}
                      </div>
                      <button
                        className="delete-button"
                        onClick={(e) => handleDelete(convId, e)}
                        title="Delete conversation"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="refresh-button" onClick={loadConversations} disabled={isLoading}>
            Refresh
          </button>
          <button className="close-button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationManager;
