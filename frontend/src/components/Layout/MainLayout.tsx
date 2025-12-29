import React, { useState } from 'react';
import ResizeHandle from './ResizeHandle';
import '../../styles/Layout/MainLayout.css';

const MainLayout = ({ leftSection, rightSection }) => {
  const [chatWidth, setChatWidth] = useState(0.33); // Default 33% of screen width

  const handleResize = (newWidth) => {
    setChatWidth(newWidth);
  };

  return (
    <div className="main-layout">
      <div 
        className="interface-section"
        style={{ flex: `${1 - chatWidth}` }}
      >
        {leftSection}
      </div>
      <div 
        className="chatbox-section"
        style={{ flex: chatWidth }}
      >
        <ResizeHandle onResize={handleResize} />
        {rightSection}
      </div>
    </div>
  );
};

export default MainLayout;
