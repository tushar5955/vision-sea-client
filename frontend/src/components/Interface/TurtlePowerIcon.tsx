import React, { useEffect, useState } from 'react';
import '../../styles/Interface/TurtlePowerIcon.css';

const TurtlePowerIcon = () => {
  const [animated, setAnimated] = useState(false);

  // Apply animation effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`turtle-power-container ${animated ? 'animated' : ''}`}>
      <div className="turtle-power-icon">
        {/* Using the provided turtle robot image */}
        <div className="turtle-icon-glow"></div>
        <div className="turtle-icon-image-container">
          <div className="pulse-ring"></div>
          <div className="pulse-ring delay1"></div>
          <div className="pulse-ring delay2"></div>
        </div>
      </div>
      <div className="turtle-power-text">
        <h2 className="turtle-power-title">TurtleFlow Active</h2>
        <p className="turtle-power-subtitle">Your automated crypto trading assistant is running</p>
        <div className="status-indicator">
          <span className="status-dot"></span>
          System operational
        </div>
        <div className="turtle-power-stats">
          <div className="stat-item">
            <div className="stat-label">Trading Status</div>
            <div className="stat-value">Online</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Monitoring</div>
            <div className="stat-value">Active</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">API Status</div>
            <div className="stat-value">Connected</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TurtlePowerIcon;
