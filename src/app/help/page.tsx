'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { ChatContainer } from '@/components/chat';
import { useChat } from '@/hooks/use-chat';
import { createClient } from '@/utils/supabase/client';

/**
 * Help Page
 *
 * Full-page AI help chat interface.
 * Requires authentication.
 */
export default function HelpPage() {
  const router = useRouter();
  const {
    messages,
    isLoading,
    error,
    streamingContent,
    rateLimitInfo,
    sendMessage,
    clearChat,
  } = useChat();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/help');
      }
    };
    checkAuth();
  }, [router]);

  // Listen for suggested prompts
  useEffect(() => {
    const handleSuggest = (e: CustomEvent<string>) => {
      sendMessage(e.detail);
    };
    window.addEventListener('chat-suggest', handleSuggest as EventListener);
    return () => {
      window.removeEventListener('chat-suggest', handleSuggest as EventListener);
    };
  }, [sendMessage]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Help</h1>
            <p className="text-sm text-gray-500">
              Ask me anything about Youth Coach Hub
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear chat</span>
          </button>
        )}
      </header>

      {/* Error display */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Chat container - takes remaining height */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          streamingContent={streamingContent}
          onSendMessage={sendMessage}
          rateLimitInfo={
            rateLimitInfo
              ? {
                  limit: rateLimitInfo.limit,
                  used: rateLimitInfo.used,
                  remaining: rateLimitInfo.remaining,
                  unlimited: rateLimitInfo.unlimited,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
