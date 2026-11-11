import React, { useRef, useEffect } from 'react';
import { Conversation, Message, RecalledMemoryItem } from '../types';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallEvent } from '../services/api';
import {
  MessageSquareDashed,
  Activity,
  Bot,
  AlertTriangle,
  Globe,
  Menu,
  BrainCircuit,
  Sparkles,
} from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoadingMessages: boolean;
  isSending: boolean;
  streamingContent: string;
  activeTool: ToolCallEvent | null;
  activeMemories: RecalledMemoryItem[];
  errorMessage: string | null;
  healthStatus: { api: string; database: string } | null;
  onOpenMobileMenu?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  onSendMessage,
  isLoadingMessages,
  isSending,
  streamingContent,
  activeTool,
  activeMemories,
  errorMessage,
  healthStatus,
  onOpenMobileMenu,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, activeTool]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/40">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-white">Recall AI</span>
          <div className="w-5" />
        </div>

        {/* Welcome Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-slate-800 flex items-center justify-center text-emerald-400 shadow-2xl">
              <Sparkles className="w-9 h-9" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BrainCircuit className="w-3.5 h-3.5" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Meet Recall</h2>
          <p className="text-sm text-slate-400 max-w-md mt-2.5 leading-relaxed">
            An intelligent context-aware assistant with episodic memory, semantic preferences, and live web research.
          </p>

          {/* Quick Starters */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full text-left">
            <button
              onClick={() => onSendMessage('I am preparing for a backend interview next Friday.')}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all text-xs text-slate-300"
            >
              <div className="font-medium text-emerald-400 mb-1">Schedule an Event</div>
              <div className="text-slate-400">&ldquo;I am preparing for a backend interview next Friday.&rdquo;</div>
            </button>
            <button
              onClick={() => onSendMessage('Find some resources for the interview we discussed.')}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all text-xs text-slate-300"
            >
              <div className="font-medium text-indigo-400 mb-1">Recall & Research</div>
              <div className="text-slate-400">&ldquo;Find some resources for the interview we discussed.&rdquo;</div>
            </button>
          </div>

          {healthStatus && (
            <div className="mt-10 flex items-center space-x-3 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>
                  API: <strong className="text-emerald-400">{healthStatus.api}</strong>
                </span>
              </span>
              <span>•</span>
              <span>
                DB:{' '}
                <strong
                  className={
                    healthStatus.database === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {healthStatus.database}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-4 md:px-8 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50 backdrop-blur shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-semibold text-sm text-slate-100 truncate max-w-[200px] md:max-w-md">
              {conversation.title}
            </h2>
            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px] md:max-w-xs">
              ID: {conversation.id}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-2 md:space-x-3">
          <span className="hidden sm:flex text-[11px] px-2.5 py-1 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/50 items-center space-x-1.5">
            <BrainCircuit className="w-3 h-3 text-violet-400" />
            <span>Memory Active</span>
          </span>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 flex items-center space-x-1.5">
            <Globe className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">Web Search Ready</span>
            <span className="sm:hidden">Search</span>
          </span>
          {healthStatus && (
            <div className="hidden md:flex items-center space-x-1.5 text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthStatus.database === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-400 text-[11px]">DB: {healthStatus.database}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800/60 px-4 py-2.5 text-xs text-red-200 flex items-center space-x-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6">
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-32 text-xs text-slate-500 animate-pulse">
            Loading message history...
          </div>
        ) : messages.length === 0 && !streamingContent && !activeTool ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs px-4 text-center">
            <MessageSquareDashed className="w-8 h-8 mb-2 text-slate-600" />
            <p>No messages yet in this conversation.</p>
            <p className="mt-1 text-slate-600">Ask a question or request research to begin.</p>
          </div>
        ) : (
          messages.map((m) => <MessageItem key={m.id} message={m} />)
        )}

        {/* Real-time Tool Calling Activity Pill */}
        {activeTool && (
          <div className="flex w-full justify-start mb-4 px-4 md:px-8">
            <div className="flex items-center space-x-2.5 bg-slate-900 border border-indigo-500/40 px-4 py-2.5 rounded-2xl text-xs text-indigo-200 shadow-lg shadow-indigo-950/20">
              <Globe className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>
                Searching web for: <strong className="text-indigo-300">&ldquo;{activeTool.query}&rdquo;</strong>...
              </span>
            </div>
          </div>
        )}

        {/* Live Streaming Response Bubble */}
        {streamingContent && (
          <div className="flex w-full justify-start mb-6 px-4 md:px-8">
            <div className="flex max-w-[92%] md:max-w-[85%] items-start space-x-3.5 flex-row">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-sm">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex flex-col flex-1">
                {/* Active Memory Indicator during stream */}
                {activeMemories.length > 0 && (
                  <div className="mb-2 rounded-xl border border-violet-500/30 bg-violet-950/30 p-2.5 text-xs text-violet-300 flex items-center space-x-2">
                    <BrainCircuit className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="truncate">
                      Context Guided by {activeMemories.length} recalled personal memory item(s)
                    </span>
                  </div>
                )}
                <div className="px-5 py-3.5 rounded-2xl rounded-tl-none text-sm leading-relaxed bg-slate-900 text-slate-100 border border-slate-800 shadow-sm">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-slate-500">
                  <span>Synthesizing response...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <MessageInput onSend={onSendMessage} disabled={isSending} />
    </div>
  );
};
