'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Send, Loader2, ImagePlus, X } from 'lucide-react';
import type { DirectMessage } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

interface MessageThreadProps {
  messages: DirectMessage[];
  /** The current user's ID — used to determine which messages are "mine" */
  currentUserId: string;
  participantName: string;
  /**
   * Called when the user submits a message.
   * @param body - The text body (may be empty string when image-only)
   * @param imageUrl - Optional public URL of an uploaded image attachment
   */
  onSendMessage: (body: string, imageUrl?: string) => Promise<void>;
  /**
   * teamId is required for scoping the storage upload path.
   * It is passed through to the upload API so the server can namespace files.
   */
  teamId: string;
  loading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a scrollable message thread with an inline compose input.
 * Supports optional image attachments: selecting a file shows a preview
 * thumbnail; the image is uploaded when the message is sent.
 *
 * Handles its own sending state; error propagation is the parent's responsibility.
 */
export const MessageThread = memo(function MessageThread({
  messages,
  currentUserId,
  participantName,
  onSendMessage,
  teamId,
  loading = false,
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Image attachment state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Revoke the object URL when the preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;

      // Reset the input so the same file can be re-selected after removal
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (!file) return;

      setUploadError(null);

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setUploadError('Only JPEG, PNG, GIF, and WebP images are allowed.');
        return;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setUploadError('Image must be 5 MB or smaller.');
        return;
      }

      // Revoke any previous preview URL before creating a new one
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      setAttachedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [previewUrl]
  );

  const handleRemoveAttachment = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
  }, [previewUrl]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    const hasText = newMessage.trim().length > 0;
    const hasImage = attachedFile !== null;

    if ((!hasText && !hasImage) || sending) return;

    const body = newMessage.trim();
    setNewMessage('');
    setSendError(null);

    try {
      setSending(true);

      let imageUrl: string | undefined;

      if (attachedFile) {
        const form = new FormData();
        form.append('image', attachedFile);
        form.append('teamId', teamId);

        const res = await fetch('/api/communication/messages/upload', {
          method: 'POST',
          body: form,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to upload image');
        }

        const data = await res.json();
        imageUrl = data.url;

        // Clear the attachment after a successful upload
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setAttachedFile(null);
        setPreviewUrl(null);
      }

      await onSendMessage(body, imageUrl);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
      // Restore the text so the user doesn't lose it
      if (body) setNewMessage(body);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const canSend = (newMessage.trim().length > 0 || attachedFile !== null) && !sending;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <MessageBubble key={msg.id} message={msg} isMine={isMine} />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
          <p className="text-xs text-amber-700">{uploadError}</p>
        </div>
      )}

      {/* Image attachment preview */}
      {previewUrl && (
        <div className="px-4 pt-3 pb-1 border-t border-gray-100 flex items-start gap-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Attachment preview"
              className="rounded-lg max-h-24 max-w-[160px] object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={handleRemoveAttachment}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
              aria-label="Remove attachment"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{sendError}</p>
        </div>
      )}

      {/* Compose input */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 px-4 py-3 flex gap-2 items-center"
      >
        {/* Hidden file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Photo attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors rounded-full hover:bg-gray-100"
          aria-label="Attach an image"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={`Message ${participantName}...`}
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-colors"
          disabled={sending}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex-shrink-0 p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
});

// ============================================================================
// Sub-components
// ============================================================================

interface MessageBubbleProps {
  message: DirectMessage;
  isMine: boolean;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
}: MessageBubbleProps) {
  const hasText = message.body.trim().length > 0;
  const hasImage = !!message.image_url;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        {/* Bubble: only render if there is text, or if there is no image (fallback) */}
        {(hasText || !hasImage) && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
              isMine
                ? 'bg-gray-900 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
            } ${hasImage ? 'mb-2' : ''}`}
          >
            {message.body}
          </div>
        )}

        {/* Image attachment */}
        {hasImage && (
          <a
            href={message.image_url!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View full-size image"
            className={`block ${isMine ? 'ml-auto' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.image_url!}
              alt="Message attachment"
              className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
            />
          </a>
        )}

        <div
          className={`flex items-center gap-1 mt-1 ${
            isMine ? 'justify-end' : 'justify-start'
          }`}
        >
          <span className="text-xs text-gray-400">
            {formatMessageTime(message.created_at)}
          </span>
          {isMine && message.read_at && (
            <span className="text-xs text-blue-500">Read</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Utilities
// ============================================================================

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} ${timePart}`;
}
