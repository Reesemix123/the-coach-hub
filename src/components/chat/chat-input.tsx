'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

/**
 * ChatInput
 *
 * Input field with send button for composing messages.
 * Supports Enter to send, Shift+Enter for newline.
 */

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about Youth Coach Hub...',
  compact = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight (capped at max)
    const maxHeight = compact ? 100 : 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className={`border-t border-gray-200 bg-white ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
          }`}
          style={{ minHeight: compact ? '40px' : '48px', maxHeight: compact ? '100px' : '200px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={`flex-shrink-0 flex items-center justify-center rounded-xl bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            compact ? 'w-10 h-10' : 'w-12 h-12'
          }`}
          aria-label="Send message"
        >
          <Send className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>
      </div>
      {!compact && (
        <p className="mt-2 text-xs text-gray-400 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      )}
    </div>
  );
}
