import React, { useState, useEffect } from 'react';
import '../../styles/Layout/ResizeHandle.css';

const ResizeHandle = ({ onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      // Calculate position relative to the window width
      const newPosition = e.clientX / window.innerWidth;
      // Limit the chat width between 25% and 60% of the screen
      const limitedPosition = Math.max(0.25, Math.min(0.6, 1 - newPosition));
      onResize(limitedPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  return (
    <div 
      className={`resize-handle ${isDragging ? 'dragging' : ''}`} 
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    >
      <div className="handle-grip">
        <div className="handle-line"></div>
        <div className="handle-line"></div>
        <div className="handle-line"></div>
      </div>
    </div>
  );
};

export default ResizeHandle;
