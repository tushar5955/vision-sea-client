import React from 'react';
import ChatMessage from './ChatMessage';
import '../../styles/ChatMessage.css';

const MessageList = ({ messages }) => {
  return (
    <div className="chat-messages-list">
      {[...messages].reverse().map((msg, idx) => (
        <ChatMessage
          key={idx}
          message={msg.message}
          role={msg.role}
        />
      ))}
    </div>
  );
};

export default MessageList;
