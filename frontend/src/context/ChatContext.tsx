import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import {
  chatAPI,
  handleAPIError,
  ChatMessageResponse,
  AssistantStreamEvent,
  HitlActionRequest,
  HitlDecisionType,
} from '../services/api';

// Type definitions
interface Message {
  message: string;
  role: 'user' | 'assistant';
  metadata?: Record<string, any>;
}

type ToolEventStatus = 'running' | 'success' | 'error' | 'awaiting-approval';

interface ToolCallEvent {
  id: string;
  type: 'tool' | 'hitl';
  toolName: string;
  args: Record<string, any>;
  output?: any;
  status: ToolEventStatus;
  startedAt: string;
  completedAt?: string;
}

interface HitlRequestState {
  interruptId: string;
  conversationId: string;
  actions: HitlActionRequest[];
}

interface HitlDecisionInput {
  action: HitlActionRequest;
  decision: HitlDecisionType;
  editedArgs?: Record<string, any>;
  reason?: string;
}

interface ChatContextType {
  messages: Message[];
  isTyping: boolean;
  handleSendMessage: (userMsg: string) => Promise<void>;
  handleToggleImage: () => void;
  resetToDefaultMode: () => void;
  agentMode: string;
  conversationId: string | null;
  error: string | null;
  clearConversation: () => void;
  toolEvents: ToolCallEvent[];
  latestToolEventId: string | null;
  toolPanelFocusKey: number;
  hitlRequest: HitlRequestState | null;
  submitHitlDecision: (input: HitlDecisionInput) => Promise<void>;
  isSubmittingHitl: boolean;
}

interface ChatProviderProps {
  children: ReactNode;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([
    { message: "Hello! I'm your AI assistant. How can I help you today?", role: "assistant" as const }
  ]);
  const [agentMode, setAgentMode] = useState('agentHub');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<ToolCallEvent[]>([]);
  const [latestToolEventId, setLatestToolEventId] = useState<string | null>(null);
  const [toolPanelFocusKey, setToolPanelFocusKey] = useState<number>(0);
  const [hitlRequest, setHitlRequest] = useState<HitlRequestState | null>(null);
  const [isSubmittingHitl, setIsSubmittingHitl] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const updateLatestAssistantMessage = useCallback((updater: (prev: string) => string) => {
    setMessages(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === 'assistant') {
          const current = next[i];
          next[i] = { ...current, message: updater(current.message) };
          return next;
        }
      }
      return next;
    });
  }, []);

  const handleStreamEvent = useCallback(
    (event: AssistantStreamEvent) => {
      if (event.conversation_id) {
        setConversationId(prev => prev ?? event.conversation_id ?? prev);
      }

      const timestamp = event.timestamp || new Date().toISOString();

      switch (event.type) {
        case 'token':
          if (event.text) {
            updateLatestAssistantMessage(prev => prev + event.text);
          }
          break;
        case 'assistant_message':
        case 'final_message':
          if (event.content) {
            updateLatestAssistantMessage(() => event.content || '');
          }
          if (event.type === 'final_message') {
            setIsTyping(false);
          }
          break;
        case 'tool_call_start':
          if (event.tool_call_id) {
            setToolEvents(prev => [
              ...prev,
              {
                id: event.tool_call_id,
                type: 'tool',
                toolName: event.tool_name || 'Tool',
                args: event.args || {},
                status: 'running',
                startedAt: timestamp,
              },
            ]);
            setLatestToolEventId(event.tool_call_id);
            setToolPanelFocusKey(Date.now());
          }
          break;
        case 'tool_call_end':
          if (event.tool_call_id) {
            setToolEvents(prev =>
              prev.map(step =>
                step.id === event.tool_call_id
                  ? {
                      ...step,
                      status: event.status === 'success' ? 'success' : 'error',
                      output: event.output,
                      completedAt: timestamp,
                    }
                  : step,
              ),
            );
            setLatestToolEventId(event.tool_call_id);
            setToolPanelFocusKey(Date.now());
          }
          break;
        case 'hitl_request':
          if (event.interrupt_id) {
            const hitlState: HitlRequestState = {
              interruptId: event.interrupt_id,
              conversationId: event.conversation_id || conversationId || '',
              actions: event.action_requests || [],
            };
            setHitlRequest(hitlState);
            setToolEvents(prev => [
              ...prev,
              {
                id: event.interrupt_id,
                type: 'hitl',
                toolName: event.action_requests?.[0]?.name || 'Tool Approval',
                args: event.action_requests?.[0]?.args || {},
                status: 'awaiting-approval',
                startedAt: timestamp,
              },
            ]);
            setLatestToolEventId(event.interrupt_id);
            setToolPanelFocusKey(Date.now());
          }
          break;
        case 'hitl_resolution':
          setHitlRequest(null);
          if (event.interrupt_id) {
            const decision = event.decisions?.[0];
            setToolEvents(prev =>
              prev.map(step =>
                step.id === event.interrupt_id
                  ? {
                      ...step,
                      status: decision?.decision === 'reject' ? 'error' : 'success',
                      completedAt: timestamp,
                    }
                  : step,
              ),
            );
            setToolPanelFocusKey(Date.now());
          }
          break;
        case 'error':
          if (event.message) {
            updateLatestAssistantMessage(() => `⚠️ ${event.message}`);
          }
          setIsTyping(false);
          break;
        case 'done':
          setIsTyping(false);
          break;
        default:
          break;
      }
    },
    [conversationId, updateLatestAssistantMessage],
  );

  const handleToggleImage = () => {
    console.log('Toggle image functionality');
  };

  const resetToDefaultMode = () => {
    setAgentMode('agentHub');
    setMessages(prev => [
      ...prev,
      { message: "Welcome back to MCP Agent Hub! How can I assist you today?", role: "assistant" as const }
    ]);
  };

  const clearConversation = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setMessages([
      { message: "Hello! I'm your AI assistant. How can I help you today?", role: "assistant" as const }
    ]);
    setToolEvents([]);
    setLatestToolEventId(null);
    setToolPanelFocusKey(0);
    setHitlRequest(null);
    setConversationId(null);
    setError(null);
    setIsTyping(false);
  };

  const handleSendMessage = async (userMsg: string) => {
    if (!userMsg.trim() || isTyping) return;

    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.message,
      metadata: msg.metadata || {},
    }));

    setMessages(prev => [
      ...prev,
      { message: userMsg, role: 'user' as const },
      { message: '', role: 'assistant' as const },
    ]);

    setIsTyping(true);
    setError(null);
    setHitlRequest(null);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await chatAPI.streamMessage(
        {
          message: userMsg,
          conversation_id: conversationId,
          history,
        },
        handleStreamEvent,
        { signal: controller.signal },
      );
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }
      const apiError = handleAPIError(err);
      setError(apiError.message);
      updateLatestAssistantMessage(() => `Sorry, I encountered an error: ${apiError.message}`);
    } finally {
      streamAbortRef.current = null;
      setIsTyping(false);
    }
  };

  const submitHitlDecision = useCallback(
    async (input: HitlDecisionInput) => {
      if (!hitlRequest) return;
      setIsSubmittingHitl(true);
      try {
        await chatAPI.submitHitlDecision(hitlRequest.interruptId, {
          conversation_id: hitlRequest.conversationId || conversationId || '',
          decisions: [
            {
              action: input.action,
              decision: input.decision,
              edited_args: input.editedArgs,
              reason: input.reason,
            },
          ],
        });
      } catch (err) {
        const apiError = handleAPIError(err);
        setError(apiError.message);
      } finally {
        setIsSubmittingHitl(false);
      }
    },
    [conversationId, hitlRequest],
  );

  React.useEffect(() => () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
  }, []);

  const value = {
    messages,
    isTyping,
    agentMode,
    conversationId,
    error,
    handleToggleImage,
    handleSendMessage,
    resetToDefaultMode,
    clearConversation,
    toolEvents,
    latestToolEventId,
    toolPanelFocusKey,
    hitlRequest,
    submitHitlDecision,
    isSubmittingHitl,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
