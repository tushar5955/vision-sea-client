import React from 'react';
import './App.css';
import MainLayout from './components/Layout/MainLayout';
import ChatContainer from './components/Chatbot/ChatContainer';
import InterfaceContainer from './components/Interface/InterfaceContainer';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { MCPProvider } from './context/MCPContext';

// Wrapper component to access theme
const AppContent = () => {
  const { theme } = useTheme();
  
  // Apply appropriate theme class based on the theme mode
  const themeClass = theme.mode === 'turtle' ? 'turtle-theme' : '';
  
  return (
    <div className={themeClass}>
      <MCPProvider>
        <ChatProvider>
          <MainLayout
            leftSection={<InterfaceContainer />}
            rightSection={<ChatContainer />}
          />
        </ChatProvider>
      </MCPProvider>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;