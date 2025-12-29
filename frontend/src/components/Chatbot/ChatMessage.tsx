import React from "react";
import humanIcon from "../../styles/human.png";
import aiIcon from "../../styles/ai.png";
import "../../styles/ChatMessage.css";

const ChatMessage = ({ message, role }) => {
  // Function to check if message contains HTML tags
  const isHtmlContent = (text) => {
    return /<[a-z][\s\S]*>/i.test(text);
  };

  return (
    <div
      className={`chat-message-row ${role === "user" ? "user" : "assistant"}`}
    >
      {/* Assistant: icon left, message right */}
      {role === "assistant" && (
        <>
          <img src={aiIcon} alt="Assistant" className="chat-message-icon" />
          <div
            className="chat-message-bubble"
            {...(isHtmlContent(message)
              ? { dangerouslySetInnerHTML: { __html: message } }
              : { children: message }
            )}
          />
        </>
      )}
      {/* User: message left, icon right */}
      {role === "user" && (
        <>
          <div className="chat-message-bubble">{message}</div>
          <img src={humanIcon} alt="User" className="chat-message-icon" />
        </>
      )}
    </div>
  );
};

export default ChatMessage;
