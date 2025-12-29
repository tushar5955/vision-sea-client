import React from 'react';

interface InteractProps {
  component?: React.ComponentType<any>;
  [key: string]: any;
}

const Interact: React.FC<InteractProps> = ({ component: DynamicComponent, ...props }) => {
  return (
    <div className="interact-container">
      {DynamicComponent ? (
        <DynamicComponent {...props} />
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          color: '#888',
          fontSize: '18px',
          fontStyle: 'italic'
        }}>
          No component provided
        </div>
      )}
    </div>
  );
};

export default Interact;