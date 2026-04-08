'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestAIAssistantProps {
  testCaseId: string;
  sessionId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TestAIAssistant({ testCaseId, sessionId }: TestAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi, I'm your testing assistant. Ask me anything about this test case or how the feature works.",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent('');

      // Build messages array for API (last 10 messages, excluding welcome)
      const apiMessages = [...messages.filter((m) => m.id !== 'welcome'), userMessage]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        abortControllerRef.current = new AbortController();

        const res = await fetch('/api/test-hub/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            testCaseId,
            sessionId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          throw new Error('Failed to get response');
        }

        // Stream the response
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setStreamingContent(accumulated);
        }

        // Add completed assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: accumulated,
            timestamp: new Date(),
          },
        ]);
        setStreamingContent('');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: "I'm sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, testCaseId, sessionId]
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2 flex-shrink-0">
        <Sparkles size={16} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          streamingContent={streamingContent || undefined}
        />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder="Ask about this test case..."
          compact
        />
      </div>
    </div>
  );
}
