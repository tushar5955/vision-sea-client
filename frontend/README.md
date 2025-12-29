# AgentHub

AgentHub is a React application that provides an interactive interface for communicating with AI agents. The application features a dual-panel layout with a main interface on the left and a chat interface on the right.

## 🚀 Features

- **Interactive Chat Interface**: Send messages and receive responses from AI
- **Agent Carousel**: Browse through different specialized AI agents
- **Special Commands**: Use commands like "show agents" and "exit" to control the interface
- **Responsive Design**: Works across different device sizes
- **Animated UI Elements**: Smooth transitions and visual effects

## 🏗️ Architecture

### Layout
- **MainLayout**: Splits the screen into interface and chatbox sections

### Chat Components
- **ChatContainer**: Houses the message list and input interface
- **MessageList**: Displays chat history in reverse chronological order
- **ChatMessage**: Renders individual message bubbles with different styling for AI vs human messages
- **ChatInput**: Text input component with send button

### Agent Components
- **InterfaceContainer**: Controls the left panel display (image or agent carousel)
- **AgentCarousel**: Browsable carousel of available AI agents
- **AgentCard**: Displays agent information with image, title, and description

### State Management
- **ChatContext**: React context for maintaining application state including:
  - Message history
  - Display mode
  - Toggle functions

## 💻 Technology Stack

- React 19
- Vite build tools
- Context API for state management
- CSS for styling
- ESLint for code quality

## 🚦 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Current Status

This application is currently in development. AI responses are simulated using predefined messages. Additional features and real AI integration are planned for future updates.
