import React, { useState } from "react";
import { useChatContext } from "../../context/ChatContext";
import "../../styles/ChatInput.css";

const ChatInput = ({ onToggleImage, onSendMessage }) => {
  const [value, setValue] = useState("");
  const { isTyping, agentMode, resetToDefaultMode } = useChatContext();

  const handleChange = (e) => setValue(e.target.value);

  const handleSend = () => {
    if (value.trim()) {
      // Check for exit commands
      const lowerValue = value.trim().toLowerCase();
      if (agentMode !== "agentHub" && 
         (lowerValue === "exit" || lowerValue === "stop" || 
          lowerValue === "back to hub" || lowerValue === "stop agent")) {
        resetToDefaultMode();
        setValue("");
        return;
      }

      if (onSendMessage) onSendMessage(value);
      setValue("");
      if (onToggleImage) onToggleImage();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      {isTyping && (
        <div className="typing-indicator">
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
      )}
      <textarea
        className="chat-input-box"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={
          isTyping 
            ? "Agent is typing..." 
            : agentMode !== "agentHub" 
              ? "Type your message or 'exit' to return to hub..." 
              : "Type your message..."
        }
        rows={1}
        disabled={isTyping}
      />
      <button
        className={`chat-input-small-btn${value ? " glow" : ""}`}
        onClick={handleSend}
        type="button"
        disabled={isTyping || !value.trim()}
      >
        <span className="btn-text">→</span>
      </button>
    </div>
  );
};

export default ChatInput;
