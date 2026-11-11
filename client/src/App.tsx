import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message, RecalledMemoryItem } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import {
  fetchConversations,
  createConversation,
  fetchMessages,
  deleteConversation,
  checkHealth,
  streamChat,
  ToolCallEvent,
} from './services/api';

export function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeTool, setActiveTool] = useState<ToolCallEvent | null>(null);
  const [activeMemories, setActiveMemories] = useState<RecalledMemoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<{ api: string; database: string } | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Poll or check health once on mount
  useEffect(() => {
    checkHealth()
      .then((res) => {
        if (res && res.services) {
          setHealthStatus(res.services);
        }
      })
      .catch(() => {
        setHealthStatus({ api: 'offline', database: 'unknown' });
      });
  }, []);

  // Load conversations from PostgreSQL
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConvs(true);
      const data = await fetchConversations();
      setConversations(data);
      if (data.length > 0 && !activeId) {
        setActiveId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConvs(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages whenever activeId changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setStreamingContent('');
      setActiveTool(null);
      setActiveMemories([]);
      setErrorMessage(null);
      return;
    }

    // Do not wipe or race if a message is currently streaming in this conversation
    if (isSending) return;

    let isMounted = true;
    setIsLoadingMessages(true);
    setStreamingContent('');
    setActiveTool(null);
    setActiveMemories([]);
    setErrorMessage(null);

    fetchMessages(activeId)
      .then((msgs) => {
        if (isMounted) {
          setMessages(msgs);
        }
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeId, isSending]);

  const handleCreateNewConversation = async () => {
    try {
      const newConv = await createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newConv.id);
      setMessages([]);
      setStreamingContent('');
      setActiveTool(null);
      setActiveMemories([]);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (content: string) => {
    let targetConversationId = activeId;

    // Auto-create a conversation if none exists
    if (!targetConversationId) {
      try {
        const newConv = await createConversation();
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(newConv.id);
        targetConversationId = newConv.id;
      } catch (err) {
        setErrorMessage('Failed to create conversation session.');
        return;
      }
    }

    if (isSending) return;

    setErrorMessage(null);
    setIsSending(true);
    setStreamingContent('');
    setActiveTool(null);
    setActiveMemories([]);

    // Optimistically render the user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: targetConversationId,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      await streamChat(targetConversationId, content, {
        onToolEvent: (event) => {
          setActiveTool(event);
        },
        onChunk: (delta: string) => {
          setActiveTool(null);
          setStreamingContent((prev) => prev + delta);
        },
        onDone: (data) => {
          const assistantMsgWithMemories: Message = {
            ...data.assistantMessage,
            recalledMemories: data.recalledMemories || [],
          };

          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempUserMessage.id),
            data.userMessage,
            assistantMsgWithMemories,
          ]);
          setStreamingContent('');
          setActiveTool(null);
          setActiveMemories([]);
        },
        onError: (errText: string) => {
          setErrorMessage(errText);
          setStreamingContent('');
          setActiveTool(null);
          setActiveMemories([]);
        },
      });

      // Automatically sync latest persisted messages from PostgreSQL immediately
      const latest = await fetchMessages(targetConversationId);
      if (latest && latest.length > 0) {
        setMessages(latest);
      }
      loadConversations();
    } catch (err) {
      console.error('Error during message sending:', err);
    } finally {
      setIsSending(false);
      setStreamingContent('');
      setActiveTool(null);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  return (
    <div className="flex h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden antialiased">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleCreateNewConversation}
        onDelete={handleDeleteConversation}
        isLoading={isLoadingConvs}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />
      <ChatWindow
        conversation={activeConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoadingMessages={isLoadingMessages}
        isSending={isSending}
        streamingContent={streamingContent}
        activeTool={activeTool}
        activeMemories={activeMemories}
        errorMessage={errorMessage}
        healthStatus={healthStatus}
        onOpenMobileMenu={() => setIsOpenMobile(true)}
      />
    </div>
  );
}

export default App;
