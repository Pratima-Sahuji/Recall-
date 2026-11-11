import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 leading-relaxed text-sm text-slate-200 break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          return <CodeBlock key={index} block={part} />;
        }
        return <FormattedParagraphs key={index} text={part} />;
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ block: string }> = ({ block }) => {
  const [copied, setCopied] = useState(false);

  // Extract language and code
  const match = block.match(/```(\w*)\n([\s\S]*?)```/);
  const language = match ? match[1] || 'plaintext' : 'plaintext';
  const code = match ? match[2] : block.slice(3, -3);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs text-slate-100 font-mono overflow-x-auto leading-normal">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

const FormattedParagraphs: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let isNumberedList = false;

  const flushList = (keyPrefix: number) => {
    if (currentList.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`ol-${keyPrefix}`} className="list-decimal list-inside space-y-1 my-2 pl-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="text-slate-200">
                <InlineFormatted text={item} />
              </li>
            ))}
          </ol>,
        );
      } else {
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="list-disc list-inside space-y-1 my-2 pl-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="text-slate-200">
                <InlineFormatted text={item} />
              </li>
            ))}
          </ul>,
        );
      }
      currentList = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList(i);
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-emerald-400 mt-4 mb-1">
          <InlineFormatted text={trimmed.slice(4)} />
        </h4>,
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(i);
      elements.push(
        <h3 key={i} className="text-base font-semibold text-white mt-4 mb-2">
          <InlineFormatted text={trimmed.slice(3)} />
        </h3>,
      );
    } else if (trimmed.startsWith('# ')) {
      flushList(i);
      elements.push(
        <h2 key={i} className="text-lg font-bold text-white mt-4 mb-2">
          <InlineFormatted text={trimmed.slice(2)} />
        </h2>,
      );
    }
    // Bullet list
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (isNumberedList) flushList(i);
      isNumberedList = false;
      currentList.push(trimmed.slice(2));
    }
    // Numbered list (e.g. "1. ")
    else if (/^\d+\.\s/.test(trimmed)) {
      if (!isNumberedList) flushList(i);
      isNumberedList = true;
      currentList.push(trimmed.replace(/^\d+\.\s/, ''));
    }
    // Empty line
    else if (trimmed === '') {
      flushList(i);
    }
    // Standard paragraph
    else {
      flushList(i);
      elements.push(
        <p key={i} className="leading-relaxed">
          <InlineFormatted text={trimmed} />
        </p>,
      );
    }
  });

  flushList(lines.length);

  return <>{elements}</>;
};

export const InlineFormatted: React.FC<{ text: string }> = ({ text }) => {
  // Regex to match markdown links [Title](URL) or bold **text** or inline `code`
  const regex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        // Markdown Link [Title](URL)
        const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
        if (linkMatch) {
          const title = linkMatch[1];
          const url = linkMatch[2];
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-0.5 text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 transition-colors mx-0.5"
            >
              <span>{title}</span>
              <ExternalLink className="w-3 h-3 inline ml-0.5" />
            </a>
          );
        }

        // Bold **text**
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <strong key={index} className="font-semibold text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Inline `code`
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={index}
              className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 text-emerald-300 rounded border border-slate-700/60"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        return part;
      })}
    </>
  );
};

