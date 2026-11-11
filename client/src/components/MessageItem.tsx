import React from 'react';
import { Message, WebSourceCitation } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { User, Bot, Clock, BrainCircuit, Globe, ExternalLink, Calendar } from 'lucide-react';

interface MessageItemProps {
  message: Message;
}

/**
 * Extracts markdown links from content to present as structured source citation pills.
 */
function extractSources(content: string): WebSourceCitation[] {
  const linkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
  const sources: WebSourceCitation[] = [];
  const seenUrls = new Set<string>();

  let match;
  let index = 1;
  while ((match = linkRegex.exec(content)) !== null) {
    const title = match[1];
    const url = match[2];

    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      let domain = url;
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch {
        // fallback
      }

      sources.push({
        index,
        title,
        url,
        domain,
      });
      index++;
    }
  }

  return sources;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'USER';
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sources = !isUser ? extractSources(message.content) : [];
  const memories = !isUser && message.recalledMemories ? message.recalledMemories : [];

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 px-4 md:px-8`}>
      <div
        className={`flex max-w-[92%] md:max-w-[85%] items-start space-x-3.5 ${
          isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isUser
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
              : 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Container */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header Role & Time */}
          <div
            className={`flex items-center space-x-2 mb-1.5 text-[11px] ${
              isUser ? 'justify-end text-emerald-400/80' : 'justify-start text-indigo-300/80'
            }`}
          >
            <span className="font-medium">{isUser ? 'You' : 'Recall Agent'}</span>
            <span>•</span>
            <span className="flex items-center text-slate-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {formattedTime}
            </span>
          </div>

          {/* 1. VISUAL DISTINCTION: RECALLED MEMORY INDICATOR */}
          {memories.length > 0 && (
            <div className="mb-2.5 rounded-xl border border-violet-500/30 bg-violet-950/30 p-3 text-xs shadow-sm">
              <div className="flex items-center space-x-1.5 text-violet-300 font-medium mb-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
                <span>Information Recalled From Prior Context:</span>
              </div>
              <div className="space-y-1.5 pl-5">
                {memories.map((mem) => {
                  const dateLabel = mem.occurredAt
                    ? new Date(mem.occurredAt).toLocaleDateString()
                    : new Date(mem.createdAt).toLocaleDateString();

                  return (
                    <div
                      key={mem.id}
                      className="text-slate-300 flex items-start space-x-2 text-[11px] leading-relaxed"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 font-mono text-[10px] shrink-0 border border-violet-800/50">
                        {mem.subCategory}
                      </span>
                      <span className="flex-1 font-sans">{mem.content}</span>
                      <span className="text-slate-400 text-[10px] shrink-0 flex items-center">
                        <Calendar className="w-3 h-3 inline mr-1 text-violet-400" />
                        {dateLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. VISUAL DISTINCTION: MAIN NEWLY GENERATED EXPLANATION BUBBLE */}
          <div
            className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
              isUser
                ? 'bg-emerald-600 text-white rounded-tr-none'
                : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>

          {/* 3. VISUAL DISTINCTION: SEARCH SOURCE CITATIONS SECTION */}
          {sources.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-indigo-500/20 bg-slate-900/60 p-3 text-xs">
              <div className="flex items-center space-x-1.5 text-indigo-300 font-medium mb-2 text-[11px]">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sources Retrieved From Live Web Search:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sources.map((src) => (
                  <a
                    key={src.index}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all group"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-4 h-4 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center text-[10px] font-mono shrink-0 border border-indigo-800/60">
                        {src.index}
                      </span>
                      <span className="truncate text-[11px] font-medium">{src.title}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <span className="text-[10px] text-slate-500 font-mono">{src.domain}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
