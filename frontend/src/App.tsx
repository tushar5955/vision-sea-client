import React from 'react';
import './App.css';
import MainLayout from './components/Layout/MainLayout';
import ChatContainer from './components/Chatbot/ChatContainer';
import InterfaceContainer from './components/Interface/InterfaceContainer';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { MCPProvider, useMCP } from './context/MCPContext';

// Wrapper component to access theme
const AppContent = () => {
  const { theme } = useTheme();
  const { failedServers } = useMCP();
  
  // Apply appropriate theme class based on the theme mode
  const themeClass = theme.mode === 'turtle' ? 'turtle-theme' : '';
  
  return (
    <div className={themeClass}>
      {failedServers.length > 0 && (
        <div style={{ position: 'fixed', top: 10, right: 10, background: 'red', color: 'white', padding: '10px', zIndex: 1000 }}>
          Failed to load MCP servers: {failedServers.join(', ')}
        </div>
      )}
      <ChatProvider>
        <MainLayout
          leftSection={<InterfaceContainer />}
          rightSection={<ChatContainer />}
        />
      </ChatProvider>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <MCPProvider>
        <AppContent />
      </MCPProvider>
    </ThemeProvider>
  );
}

export default App;