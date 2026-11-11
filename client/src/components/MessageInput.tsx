import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, CornerDownLeft, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  return (
    <div className="p-3 md:p-5 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md shrink-0">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end bg-slate-900 border border-slate-800/80 rounded-2xl focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 shadow-lg shadow-black/40 transition-all p-1.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Recall anything, or discuss tasks, events, and topics..."
            disabled={disabled}
            rows={1}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm px-3.5 py-2.5 resize-none focus:outline-none max-h-44 min-h-[44px] leading-relaxed"
          />
          <div className="pb-1 pr-1 shrink-0">
            <button
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              className={`p-2.5 rounded-xl transition-all ${
                text.trim() && !disabled
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-md shadow-emerald-950/40 active:scale-95'
                  : 'text-slate-600 bg-slate-800/40 cursor-not-allowed'
              }`}
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
          <span className="hidden sm:inline">Recall Cognitive Agent • PostgreSQL Memory • Tavily Search</span>
          <span className="sm:hidden">Recall AI</span>
          <span className="flex items-center space-x-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
              Enter
            </kbd>
            <span>to send,</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
              Shift+Enter
            </kbd>
            <span>for new line</span>
          </span>
        </div>
      </div>
    </div>
  );
};
