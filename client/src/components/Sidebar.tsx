import React from 'react';
import { Conversation } from '../types';
import { PlusCircle, MessageSquare, Trash2, Cpu, X } from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isLoading,
  isOpenMobile,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-80 bg-slate-950/95 md:bg-slate-900 border-r border-slate-800/80 flex flex-col h-full select-none transform transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-semibold text-sm tracking-wide text-white">Recall</h1>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Contextual Memory Agent</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNew();
              onCloseMobile?.();
            }}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium py-2.5 px-3.5 rounded-xl text-sm transition-all shadow-md shadow-emerald-950/40 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
            Recent Conversations
          </div>

          {isLoading && (
            <div className="px-2 py-6 text-xs text-slate-500 text-center animate-pulse">
              Loading conversations...
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="px-4 py-8 text-xs text-slate-500 text-center">
              No conversations yet. Start one above!
            </div>
          )}

          {conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => {
                  onSelect(c.id);
                  onCloseMobile?.();
                }}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                  isActive
                    ? 'bg-slate-800/90 text-white font-medium shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
                    }`}
                  />
                  <span className="truncate">{c.title || 'Untitled Chat'}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded-md hover:bg-slate-700/50 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info & system health */}
        <div className="p-3 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between bg-slate-950/40">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-500/50"></span>
            <span className="font-medium text-slate-400">Recall Core</span>
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            v1.0.0
          </span>
        </div>
      </aside>
    </>
  );
};
