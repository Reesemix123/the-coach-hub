'use client';

import React, {
  use,
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import {
  ChevronLeft,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  Bell,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageThread } from '@/components/communication/messaging/MessageThread';
import type { DirectMessage } from '@/types/communication';

// ConversationSummary is defined here rather than imported from the server
// service to avoid pulling a server-only module into a client component bundle.
interface ConversationSummary {
  participantId: string;
  participantName: string;
  participantType: 'coach' | 'parent';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ============================================================================
// Local types
// ============================================================================

interface AnnouncementItem {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  is_read: boolean;
}

type FeedItem =
  | { type: 'conversation'; data: ConversationSummary }
  | { type: 'announcement'; data: AnnouncementItem };

interface SelectedConversation {
  participantId: string;
  participantName: string;
  participantType: 'coach' | 'parent';
}

interface ParentOption {
  id: string;
  first_name: string;
  last_name: string;
}

// ============================================================================
// Avatar helpers (mirrors directory page for visual consistency)
// ============================================================================

const AVATAR_COLORS = [
  '#6B7280',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
];

function avatarColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

// ============================================================================
// Utility: relative timestamp (shared pattern with MessageThread)
// ============================================================================

function formatRelativeTime(timestamp: string): string {
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
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}

// ============================================================================
// ConversationCard — a single row in the inbox list
// ============================================================================

interface ConversationCardProps {
  conversation: ConversationSummary;
  onClick: () => void;
}

const ConversationCard = memo(function ConversationCard({
  conversation,
  onClick,
}: ConversationCardProps) {
  const hasUnread = conversation.unreadCount > 0;
  const bgColor = avatarColorForName(conversation.participantName);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-left hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        {initials(conversation.participantName)}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-sm leading-snug truncate ${
              hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
            }`}
          >
            {conversation.participantName}
          </span>
          {conversation.participantType === 'coach' && (
            <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              Coach
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate leading-snug">
          {conversation.lastMessage}
        </p>
      </div>

      {/* Right column: timestamp + unread badge */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-xs text-gray-400">
          {formatRelativeTime(conversation.lastMessageAt)}
        </span>
        {hasUnread && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-semibold">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
});

// ============================================================================
// NewMessagePicker — dropdown listing available conversation targets
// ============================================================================

interface NewMessagePickerProps {
  teamId: string;
  myParentProfileId: string;
  onSelect: (conversation: SelectedConversation) => void;
  onClose: () => void;
}

function NewMessagePicker({
  teamId,
  myParentProfileId,
  onSelect,
  onClose,
}: NewMessagePickerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachOption, setCoachOption] = useState<{ id: string; name: string } | null>(null);
  const [otherParents, setOtherParents] = useState<ParentOption[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        setLoading(true);
        setError(null);

        // Fetch roster and default coach conversation in parallel.
        // The default messages endpoint returns coachId, which we use for the coach option.
        // The roster endpoint gives us the other parents.
        const [rosterRes, defaultConvRes] = await Promise.all([
          fetch(`/api/communication/parents/roster?teamId=${teamId}`),
          fetch(`/api/communication/messages?teamId=${teamId}`),
        ]);

        if (cancelled) return;

        if (!rosterRes.ok || !defaultConvRes.ok) {
          throw new Error('Failed to load contacts');
        }

        const [rosterData, convData] = await Promise.all([
          rosterRes.json(),
          defaultConvRes.json(),
        ]);

        if (cancelled) return;

        // Build coach option from the default conversation response
        if (convData.coachId) {
          setCoachOption({ id: convData.coachId, name: 'Coach' });
        }

        // Filter out the current parent from the roster
        const parents: ParentOption[] = (rosterData.parents ?? []).filter(
          (p: ParentOption) => p.id !== myParentProfileId
        );
        setOtherParents(parents);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contacts');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [teamId, myParentProfileId]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden"
      role="menu"
      aria-label="New message — choose a recipient"
    >
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          New Message
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && error && (
        <p className="px-4 py-4 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && (
        <ul className="py-1 max-h-64 overflow-y-auto">
          {/* Coach is always the first option */}
          {coachOption && (
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  onSelect({
                    participantId: coachOption.id,
                    participantName: 'Coach',
                    participantType: 'coach',
                  })
                }
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold bg-gray-700"
                  aria-hidden="true"
                >
                  C
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Coach
                  </span>
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    Staff
                  </span>
                </div>
              </button>
            </li>
          )}

          {/* Other parents on the team */}
          {otherParents.map((parent) => {
            const fullName = `${parent.first_name} ${parent.last_name}`;
            const bgColor = avatarColorForName(fullName);
            return (
              <li key={parent.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    onSelect({
                      participantId: parent.id,
                      participantName: fullName,
                      participantType: 'parent',
                    })
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: bgColor }}
                    aria-hidden="true"
                  >
                    {initials(fullName)}
                  </div>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {fullName}
                  </span>
                </button>
              </li>
            );
          })}

          {!coachOption && otherParents.length === 0 && (
            <li className="px-4 py-4 text-sm text-gray-500 text-center">
              No contacts available
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// InboxView — conversation list
// ============================================================================

interface InboxViewProps {
  teamId: string;
  myParentProfileId: string;
  onSelectConversation: (conv: SelectedConversation) => void;
}

function InboxView({
  teamId,
  myParentProfileId,
  onSelectConversation,
}: InboxViewProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [msgRes, annRes] = await Promise.all([
        fetch(`/api/communication/messages?teamId=${teamId}&view=inbox`),
        fetch(`/api/communication/announcements?teamId=${teamId}`),
      ]);

      if (msgRes.ok) {
        const data = await msgRes.json();
        setConversations(data.conversations ?? []);
      }

      if (annRes.ok) {
        const data = await annRes.json();
        setAnnouncements(
          (data.announcements ?? []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            title: (a.title as string) ?? null,
            body: (a.body as string) ?? (a.message_text as string) ?? '',
            created_at: (a.created_at as string) ?? '',
            is_read: !!(a.is_read ?? a.read_at),
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Poll inbox every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInbox();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  // Build merged feed sorted by timestamp (newest first)
  const feed: FeedItem[] = [
    ...conversations.map((c): FeedItem => ({
      type: 'conversation',
      data: c,
    })),
    ...announcements.map((a): FeedItem => ({
      type: 'announcement',
      data: a,
    })),
  ].sort((a, b) => {
    const timeA = a.type === 'conversation' ? a.data.lastMessageAt : a.data.created_at;
    const timeB = b.type === 'conversation' ? b.data.lastMessageAt : b.data.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  function handlePickerSelect(conv: SelectedConversation) {
    setShowPicker(false);
    onSelectConversation(conv);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <Link
          href="/parent"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessagesSquare className="w-7 h-7 text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
          </div>

          {/* New Message button with dropdown picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              New Message
            </button>

            {showPicker && (
              <NewMessagePicker
                teamId={teamId}
                myParentProfileId={myParentProfileId}
                onSelect={handlePickerSelect}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && feed.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessagesSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">No Messages Yet</h2>
          <p className="text-gray-600 mb-6">
            Start a conversation with your coach or other team parents.
          </p>
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowPicker((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              New Message
            </button>
            {showPicker && (
              <NewMessagePicker
                teamId={teamId}
                myParentProfileId={myParentProfileId}
                onSelect={handlePickerSelect}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Merged feed: conversations + announcements */}
      {feed.length > 0 && (
        <div className="space-y-2">
          {feed.map((item) =>
            item.type === 'conversation' ? (
              <ConversationCard
                key={`conv-${item.data.participantId}`}
                conversation={item.data}
                onClick={() =>
                  onSelectConversation({
                    participantId: item.data.participantId,
                    participantName: item.data.participantName,
                    participantType: item.data.participantType,
                  })
                }
              />
            ) : (
              <button
                key={`ann-${item.data.id}`}
                onClick={() => router.push(`/parent/teams/${teamId}/announcements`)}
                className={`w-full text-left bg-white rounded-xl border p-4 transition-colors hover:bg-gray-50 ${
                  item.data.is_read ? 'border-gray-200' : 'border-amber-300 bg-amber-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Announcement
                      </span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                        {new Date(item.data.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    {item.data.title && (
                      <p className={`text-sm font-semibold truncate ${item.data.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                        {item.data.title}
                      </p>
                    )}
                    <p className={`text-sm truncate ${item.data.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                      {item.data.body.replace(/<[^>]*>/g, '').substring(0, 100)}
                    </p>
                  </div>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ThreadView — full message thread with a specific participant
// ============================================================================

interface ThreadViewProps {
  teamId: string;
  conversation: SelectedConversation;
  myParentProfileId: string;
  onBack: () => void;
}

function ThreadView({
  teamId,
  conversation,
  myParentProfileId,
  onBack,
}: ThreadViewProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // coachId is only needed when the participant is the coach, so we can send
  // to the correct auth user ID (not a parent profile ID).
  const coachIdRef = useRef<string>(
    conversation.participantType === 'coach' ? conversation.participantId : ''
  );

  const fetchThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/communication/messages?teamId=${teamId}&participantId=${conversation.participantId}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load conversation');
      }

      const data = await res.json();
      setMessages(data.messages ?? []);

      // The default (no participantId) response also returns coachId.
      // When opening the coach thread via the inbox (participantId IS set),
      // coachId is not returned. We captured it at construction time from
      // conversation.participantId, which is already the coach's auth user ID
      // when participantType === 'coach'.
      if (data.coachId && !coachIdRef.current) {
        coachIdRef.current = data.coachId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [teamId, conversation.participantId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/communication/messages?teamId=${teamId}&participantId=${conversation.participantId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.messages) setMessages(data.messages); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [teamId, conversation.participantId]);

  const handleSendMessage = useCallback(
    async (body: string, imageUrl?: string) => {
      const recipientId =
        conversation.participantType === 'coach'
          ? coachIdRef.current
          : conversation.participantId;

      const recipientType =
        conversation.participantType === 'coach' ? 'coach' : 'parent';

      if (!recipientId) {
        throw new Error('Recipient information not available. Please go back and try again.');
      }

      const res = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          message: body,
          recipientId,
          recipientType,
          ...(imageUrl ? { imageUrl } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      // Refresh the thread to include the newly sent message
      await fetchThread();
    },
    [teamId, conversation, fetchThread]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div
        className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
        style={{ height: '75vh' }}
      >
        {/* Thread header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 p-1 -ml-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Back to inbox"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Participant avatar */}
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
            style={{
              backgroundColor:
                conversation.participantType === 'coach'
                  ? '#374151'
                  : avatarColorForName(conversation.participantName),
            }}
            aria-hidden="true"
          >
            {initials(conversation.participantName)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900 truncate">
                {conversation.participantName}
              </h2>
              {conversation.participantType === 'coach' && (
                <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  Coach
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MessageThread handles the scrollable list + compose input */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <MessageThread
            messages={messages}
            currentUserId={myParentProfileId}
            participantName={conversation.participantName}
            onSendMessage={handleSendMessage}
            teamId={teamId}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page root
// ============================================================================

export default function ParentMessagesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);

  const [selectedConversation, setSelectedConversation] =
    useState<SelectedConversation | null>(null);
  const [myParentProfileId, setMyParentProfileId] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch the current parent's profile ID on mount.
  // This is required to correctly identify "my" messages in the thread view.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch('/api/communication/parents/profile');
        if (res.ok) {
          const data = await res.json();
          // The profile endpoint returns the object directly (not wrapped)
          if (!cancelled && data.id) {
            setMyParentProfileId(data.id);
          }
        }
      } catch {
        // Non-fatal — messages still render, just without "mine" styling
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ThreadView
          teamId={teamId}
          conversation={selectedConversation}
          myParentProfileId={myParentProfileId}
          onBack={() => setSelectedConversation(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <InboxView
        teamId={teamId}
        myParentProfileId={myParentProfileId}
        onSelectConversation={setSelectedConversation}
      />
    </div>
  );
}
