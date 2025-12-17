'use client';

import { useEffect, useState } from 'react';

/**
 * ChatMessage
 *
 * Individual message bubble with different styles for user vs assistant.
 * Supports markdown rendering for AI responses.
 */

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const [visible, setVisible] = useState(false);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const isUser = role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gray-100 text-gray-900'
            : 'bg-white text-gray-900 shadow-sm border border-gray-100'
        }`}
      >
        <div className="prose prose-sm max-w-none">
          <MessageContent content={content} />
        </div>
        {isStreaming && (
          <span className="inline-block w-1 h-4 ml-1 bg-gray-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}

/**
 * MessageContent
 *
 * Renders message content with basic markdown support.
 */
function MessageContent({ content }: { content: string }) {
  // Simple markdown rendering for common patterns
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="font-semibold text-gray-900 mt-3">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className="font-semibold text-gray-900 mt-3">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={index} className="font-bold text-gray-900 mt-3">
              {line.slice(2)}
            </h2>
          );
        }

        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>{formatInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="text-gray-500 font-medium min-w-[1.5rem]">
                {numberedMatch[1]}.
              </span>
              <span>{formatInlineMarkdown(line.slice(numberedMatch[0].length))}</span>
            </div>
          );
        }

        // Empty lines
        if (line.trim() === '') {
          return <div key={index} className="h-2" />;
        }

        // Regular paragraphs
        return (
          <p key={index} className="text-gray-900">
            {formatInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * ChatLink - Internal link that opens the Guide slide-over and closes chat
 */
function ChatLink({ href, children }: { href: string; children: React.ReactNode }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Parse the guide path from href (e.g., "/guide/film/uploading-film" -> ["film", "uploading-film"])
    if (href.startsWith('/guide/')) {
      const path = href.replace('/guide/', '').split('/').filter(Boolean);
      // Close the chat panel (button stays visible)
      window.dispatchEvent(new CustomEvent('chat-close'));
      // Dispatch event to open guide slide-over
      window.dispatchEvent(new CustomEvent('guide-open', { detail: path }));
    } else {
      // For non-guide links, navigate normally
      window.location.href = href;
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
    >
      {children}
    </button>
  );
}

/**
 * Format inline markdown (bold, italic, code, links)
 */
function formatInlineMarkdown(text: string): React.ReactNode {
  // Simple pattern matching for inline formatting
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Link: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code: `code`
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find the earliest match
    const matches = [
      { match: linkMatch, index: linkMatch?.index ?? Infinity, type: 'link' },
      { match: boldMatch, index: boldMatch?.index ?? Infinity, type: 'bold' },
      { match: codeMatch, index: codeMatch?.index ?? Infinity, type: 'code' },
    ].filter(m => m.match !== null).sort((a, b) => a.index - b.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches[0];

    // Add text before the match
    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index));
    }

    if (earliest.type === 'link' && linkMatch) {
      const [fullMatch, linkText, linkUrl] = linkMatch;
      // Check if it's an internal link (starts with /)
      if (linkUrl.startsWith('/')) {
        parts.push(
          <ChatLink key={key++} href={linkUrl}>
            {linkText}
          </ChatLink>
        );
      } else {
        parts.push(
          <a
            key={key++}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {linkText}
          </a>
        );
      }
      remaining = remaining.slice(earliest.index + fullMatch.length);
    } else if (earliest.type === 'bold' && boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(earliest.index + boldMatch[0].length);
    } else if (earliest.type === 'code' && codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(earliest.index + codeMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts.length > 0 ? parts : text;
}
