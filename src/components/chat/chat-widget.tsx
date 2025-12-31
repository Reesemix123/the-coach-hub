'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Trash2, Sparkles, ExternalLink } from 'lucide-react';
import { ChatContainer } from './chat-container';
import { useChat } from '@/hooks/use-chat';
import { createClient } from '@/utils/supabase/client';

/**
 * ChatWidget
 *
 * Floating AI assistant chat widget that appears on all pages.
 * Features:
 * - Draggable floating action button with app logo
 * - Chat panel with close button in header
 * - Clear AI assistant branding
 * - Persisted chat history
 * - Position saved to localStorage
 */

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'ych-chat-widget-position-v2'; // v2: changed from top to bottom positioning
const DEFAULT_POSITION = { x: 24, y: 24 }; // right: 24px, bottom: 24px

export function ChatWidget() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Draggable state
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    messages,
    isLoading,
    error,
    streamingContent,
    rateLimitInfo,
    sendMessage,
    clearChat,
    messageCount,
  } = useChat();

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      }
    } catch {
      // Ignore errors, use default
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (!isDragging) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      } catch {
        // Ignore errors
      }
    }
  }, [position, isDragging]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Animate visibility after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  // Listen for close event (from chat links opening guide)
  useEffect(() => {
    const handleClose = () => {
      setIsOpen(false);
    };
    window.addEventListener('chat-close', handleClose);
    return () => {
      window.removeEventListener('chat-close', handleClose);
    };
  }, []);

  // Listen for practice-builder-open event to hide chat widget
  const [isPracticeBuilderOpen, setIsPracticeBuilderOpen] = useState(false);
  useEffect(() => {
    const handlePracticeBuilderOpen = () => {
      setIsPracticeBuilderOpen(true);
      setIsOpen(false); // Close chat if open
    };
    const handlePracticeBuilderClose = () => {
      setIsPracticeBuilderOpen(false);
    };
    window.addEventListener('practice-builder-open', handlePracticeBuilderOpen);
    window.addEventListener('practice-builder-close', handlePracticeBuilderClose);
    return () => {
      window.removeEventListener('practice-builder-open', handlePracticeBuilderOpen);
      window.removeEventListener('practice-builder-close', handlePracticeBuilderClose);
    };
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = dragStartRef.current.x - e.clientX;
    const deltaY = dragStartRef.current.y - e.clientY; // Inverted for bottom positioning

    // Calculate new position (right-based for x, bottom-based for y)
    const newX = Math.max(0, Math.min(window.innerWidth - 150, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 50, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();

    const touch = e.touches[0];
    const deltaX = dragStartRef.current.x - touch.clientX;
    const deltaY = dragStartRef.current.y - touch.clientY; // Inverted for bottom positioning

    const newX = Math.max(0, Math.min(window.innerWidth - 150, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 50, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  // Click handler that ignores drag
  const handleClick = useCallback(() => {
    // Only toggle if we weren't dragging
    if (!isDragging) {
      setIsOpen(prev => !prev);
    }
  }, [isDragging]);

  // Don't render for unauthenticated users
  if (!isAuthenticated) return null;

  const handleViewAllHistory = () => {
    setIsOpen(false);
    router.push('/help');
  };

  return (
    <>
      {/* Draggable Floating Action Button - hidden when chat is open */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        style={{
          right: position.x,
          bottom: position.y,
        }}
        className={`fixed z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-300 ${
          isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-105'
        } ${
          isVisible && !isOpen && !isPracticeBuilderOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        } bg-white ring-2 ring-gray-200 hover:ring-gray-400 hover:shadow-xl`}
        aria-label="Open AI Assistant"
      >
        <div className="relative">
          <Image
            src="/apple-touch-icon.png"
            alt="AI Assistant"
            width={32}
            height={32}
            className="rounded-lg pointer-events-none"
            draggable={false}
          />
          {/* AI indicator badge - green to match logo */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <span className="text-gray-900 font-medium text-sm select-none">AI Assistant</span>
      </button>

      {/* Chat Panel */}
      <div
        style={{
          right: position.x,
          bottom: position.y + 52, // Position above the button
        }}
        className={`fixed z-[60] w-[400px] max-w-[calc(100vw-3rem)] transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-10rem)]">
          {/* Header with close button - draggable */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 flex items-center justify-between ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div className="flex items-center gap-3 pointer-events-none select-none">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                <Image
                  src="/apple-touch-icon.png"
                  alt="Youth Coach Hub"
                  width={28}
                  height={28}
                  className="rounded"
                />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
                  AI Assistant
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                </h3>
                <p className="text-gray-400 text-xs">Ask me anything about the app</p>
              </div>
            </div>
            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              )}
              {/* Close button inside header */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Chat container */}
          <div className="flex-1 overflow-hidden h-[450px]">
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
              compact
            />
          </div>

          {/* Footer with history link */}
          {messageCount > 10 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <button
                onClick={handleViewAllHistory}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span>View full chat history ({messageCount} messages)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

export default ChatWidget;
