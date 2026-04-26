'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useParent } from '../ParentContext'
import { EmptyState } from '@/app/(mobile)/components/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  id: string
  title: string | null
  body: string
  priority: string
  created_at: string
  is_read?: boolean
}

interface ConversationSummary {
  participantId: string
  participantName: string
  participantType: 'coach' | 'parent'
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

interface DirectMessage {
  id: string
  sender_type: string
  sender_id: string
  body: string
  image_url?: string | null
  created_at: string
}

type InboxItem =
  | { type: 'announcement'; id: string; date: string; data: Announcement }
  | { type: 'thread'; id: string; date: string; data: ConversationSummary }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function msgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function groupTs(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return `Today ${msgTime(dateStr)}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Yesterday ${msgTime(dateStr)}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ---------------------------------------------------------------------------
// Inbox list
// ---------------------------------------------------------------------------

function InboxList({ items, loading, onSelectAnnouncement, onSelectThread }: {
  items: InboxItem[]
  loading: boolean
  onSelectAnnouncement: (a: Announcement) => void
  onSelectThread: (c: ConversationSummary) => void
}) {
  if (loading) {
    return (
      <div className="px-4 mt-3 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--bg-card)] rounded-xl px-4 py-3.5 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-[var(--bg-card-alt)] rounded-full" />
              <div className="flex-1"><div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" /><div className="h-3 bg-[var(--bg-card-alt)] rounded w-full" /></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
        title="No messages yet"
        description="Messages from your coach will appear here."
      />
    )
  }

  return (
    <div className="mt-2">
      {items.map(item => item.type === 'announcement' ? (
        <button key={item.id} type="button" onClick={() => onSelectAnnouncement(item.data as Announcement)}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{(item.data as Announcement).title || 'Announcement'}</p>
              <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{relativeTime(item.date)}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{(item.data as Announcement).body}</p>
          </div>
          {!(item.data as Announcement).is_read && (
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0" />
          )}
        </button>
      ) : (
        <button key={item.id} type="button" onClick={() => onSelectThread(item.data as ConversationSummary)}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{initials((item.data as ConversationSummary).participantName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{(item.data as ConversationSummary).participantName}</p>
              <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{relativeTime(item.date)}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{(item.data as ConversationSummary).lastMessage}</p>
          </div>
          {(item.data as ConversationSummary).unreadCount > 0 && (
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Announcement detail (read-only)
// ---------------------------------------------------------------------------

function AnnouncementDetail({ announcement, onBack }: { announcement: Announcement; onBack: () => void }) {
  // Mark as read on mount
  useEffect(() => {
    if (!announcement.is_read) {
      fetch(`/api/communication/announcements/${announcement.id}/read`, { method: 'PATCH' }).catch(() => {})
    }
  }, [announcement])

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-3 mb-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Messages
        </button>
      </div>
      <div className="px-4">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
          {announcement.priority !== 'normal' && (
            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 mb-2 inline-block ${
              announcement.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>{announcement.priority}</span>
          )}
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{announcement.title || 'Announcement'}</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{new Date(announcement.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          <p className="text-sm text-[var(--text-primary)] mt-3 whitespace-pre-wrap leading-relaxed">{announcement.body}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thread view (messages + reply)
// ---------------------------------------------------------------------------

function ThreadView({ conversation, teamId, onBack }: { conversation: ConversationSummary; teamId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/communication/messages?teamId=${teamId}&participantId=${conversation.participantId}`)
      .then(r => r.json())
      .then(data => { if (data.messages) setMessages(data.messages); setLoading(false) })
      .catch(() => setLoading(false))
  }, [teamId, conversation.participantId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!reply.trim() || sending) return
    setSending(true); setSendError(null)
    try {
      const res = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, recipientId: conversation.participantId, recipientType: conversation.participantType, message: reply.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.message) setMessages(prev => [...prev, data.message])
        setReply('')
      } else { const d = await res.json(); setSendError(d.error || 'Failed to send') }
    } catch { setSendError('Failed to send') }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 pt-3 pb-3 flex items-center gap-3 shrink-0">
        <button type="button" onClick={onBack} className="text-[var(--text-secondary)] active:text-[var(--text-primary)] -ml-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="w-8 h-8 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">{initials(conversation.participantName)}</span>
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{conversation.participantName}</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-10 bg-[var(--bg-pill-inactive)] rounded-2xl animate-pulse" style={{ width: `${40 + (i * 17) % 40}%` }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-[var(--text-tertiary)]">No messages yet</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_type === 'parent'
            const prev = idx > 0 ? messages[idx - 1] : null
            const gap = prev && Math.abs(new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) > 300000
            return (
              <div key={msg.id}>
                {(gap || idx === 0) && <p className="text-[10px] text-[var(--text-tertiary)] text-center my-2">{groupTs(msg.created_at)}</p>}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    {msg.image_url && <img src={msg.image_url} alt="" className={`rounded-xl mb-1 max-w-full object-cover ${isMe ? 'ml-auto' : ''}`} style={{ maxHeight: 200 }} />}
                    {msg.body && (
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe ? 'bg-[var(--accent)] text-[var(--accent-text)] rounded-br-sm' : 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm rounded-bl-sm'
                      }`}>{msg.body}</div>
                    )}
                    <p className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${isMe ? 'text-right' : 'text-left'}`}>{msgTime(msg.created_at)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Reply */}
      <div className="bg-[var(--bg-card)] border-t border-[var(--border-primary)] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shrink-0">
        {sendError && <p className="text-[11px] text-red-500 mb-2">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            rows={1} placeholder="Message..."
            className="flex-1 bg-[var(--bg-card-alt)] rounded-2xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none resize-none max-h-28 leading-relaxed" />
          <button type="button" onClick={handleSend} disabled={!reply.trim() || sending}
            className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 disabled:bg-[var(--bg-pill-inactive)] active:opacity-80 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recipient picker sheet (for new messages)
// ---------------------------------------------------------------------------

interface RosterParent {
  id: string
  first_name: string
  last_name: string
  children: { player_name: string }[]
}

interface RecipientOption {
  id: string
  name: string
  subtitle: string
  type: 'coach' | 'parent'
}

function RecipientPickerSheet({ teamId, conversations, onSelect, onClose }: {
  teamId: string
  conversations: ConversationSummary[]
  onSelect: (c: ConversationSummary) => void
  onClose: () => void
}) {
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch settings + roster in parallel
      const [settingsRes, rosterRes, defaultRes] = await Promise.all([
        fetch(`/api/communication/settings?teamId=${teamId}`).then(r => r.json()).catch(() => ({ settings: {} })),
        fetch(`/api/communication/parents/roster?teamId=${teamId}`).then(r => r.json()).catch(() => ({ parents: [] })),
        // Fetch coachId from default parent messages endpoint
        fetch(`/api/communication/messages?teamId=${teamId}`).then(r => r.json()).catch(() => ({})),
      ])

      const opts: RecipientOption[] = []

      // Always show coaching staff
      if (defaultRes.coachId) {
        opts.push({ id: defaultRes.coachId, name: 'Coaching Staff', subtitle: 'Send a message to your coach', type: 'coach' })
      }

      // Show other parents if allowed
      const allowP2P = settingsRes.settings?.allow_parent_to_parent_messaging ?? true
      if (allowP2P && rosterRes.parents) {
        // Get current parent's ID to exclude self
        const profileRes = await fetch('/api/communication/parents/profile').then(r => r.json()).catch(() => ({}))
        const myId = profileRes?.id ?? null

        for (const p of rosterRes.parents as RosterParent[]) {
          if (p.id === myId) continue
          const childNames = p.children?.map((c: { player_name: string }) => c.player_name).join(', ') || ''
          opts.push({ id: p.id, name: `${p.first_name} ${p.last_name}`, subtitle: childNames ? `Parent of ${childNames}` : 'Parent', type: 'parent' })
        }
      }

      setRecipients(opts)
      setLoading(false)
    }
    load()
  }, [teamId])

  function handleSelect(opt: RecipientOption) {
    // Check for existing conversation
    const existing = conversations.find(c => c.participantId === opt.id)
    if (existing) {
      onSelect(existing)
    } else {
      // Create stub conversation for ThreadView
      onSelect({ participantId: opt.id, participantName: opt.name, participantType: opt.type, lastMessage: '', lastMessageAt: new Date().toISOString(), unreadCount: 0 })
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-[var(--bg-overlay)] z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-sheet)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[70vh] animate-slide-up">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[var(--border-secondary)]" /></div>
        <div className="px-5 pt-2 pb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">New Message</h3>
          {loading ? (
            <div className="space-y-3 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)]" />
                  <div className="flex-1"><div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-1" /><div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[50vh]">
              {recipients.map(opt => (
                <button key={opt.id} type="button" onClick={() => handleSelect(opt)}
                  className="w-full flex items-center gap-3 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] transition-colors text-left">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center shrink-0">
                    {opt.type === 'coach' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent)]">
                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
                      </svg>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{initials(opt.name)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{opt.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{opt.subtitle}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
              {recipients.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-6">No recipients available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ParentMessagesPage() {
  const { currentTeamId } = useParent()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<InboxItem[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [selectedThread, setSelectedThread] = useState<ConversationSummary | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  // Tracks deep-link param consumption so we don't re-trigger on conversation reloads
  const consumedDeepLinkRef = useRef(false)

  const loadInbox = useCallback(() => {
    if (!currentTeamId) { setLoading(false); return }
    setLoading(true)

    Promise.all([
      fetch(`/api/communication/announcements?teamId=${currentTeamId}`).then(r => r.json()).catch(() => ({ announcements: [] })),
      fetch(`/api/communication/messages?teamId=${currentTeamId}&view=inbox`).then(r => r.json()).catch(() => ({ conversations: [] })),
    ]).then(([annData, msgData]) => {
      const convos: ConversationSummary[] = msgData.conversations ?? []
      setConversations(convos)

      const merged: InboxItem[] = []
      for (const a of (annData.announcements ?? [])) {
        merged.push({ type: 'announcement', id: `ann-${a.id}`, date: a.created_at, data: a })
      }
      for (const c of convos) {
        merged.push({ type: 'thread', id: `thread-${c.participantId}`, date: c.lastMessageAt, data: c })
      }
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setItems(merged)
      setLoading(false)
    })
  }, [currentTeamId])

  useEffect(() => { loadInbox() }, [loadInbox])

  // Deep-link from Directory: /p/messages?to=<id>&type=coach|parent&name=<encoded>
  // Opens the matching thread (or stub) once conversations have loaded.
  useEffect(() => {
    if (consumedDeepLinkRef.current) return
    if (loading) return
    const to = searchParams.get('to')
    const type = searchParams.get('type')
    if (!to || (type !== 'coach' && type !== 'parent')) return
    const name = searchParams.get('name') ?? 'Recipient'

    const existing = conversations.find(c => c.participantId === to)
    if (existing) {
      setSelectedThread(existing)
    } else {
      setSelectedThread({
        participantId: to,
        participantName: name,
        participantType: type,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      })
    }
    consumedDeepLinkRef.current = true

    // Clear params so the back button returns to a clean inbox URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('to')
      url.searchParams.delete('type')
      url.searchParams.delete('name')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, conversations, loading])

  if (selectedAnnouncement) {
    return <AnnouncementDetail announcement={selectedAnnouncement} onBack={() => setSelectedAnnouncement(null)} />
  }

  if (selectedThread && currentTeamId) {
    return <ThreadView conversation={selectedThread} teamId={currentTeamId} onBack={() => { setSelectedThread(null); loadInbox() }} />
  }

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Messages</h1>
      </div>
      <InboxList items={items} loading={loading} onSelectAnnouncement={setSelectedAnnouncement} onSelectThread={setSelectedThread} />

      {/* New Message button */}
      {!loading && (
        <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] right-4 z-30">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 bg-[var(--accent)] text-[var(--accent-text)] rounded-full px-4 py-3 shadow-lg active:opacity-80 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-sm font-semibold">New Message</span>
          </button>
        </div>
      )}

      {/* Recipient picker */}
      {showPicker && currentTeamId && (
        <RecipientPickerSheet
          teamId={currentTeamId}
          conversations={conversations}
          onSelect={setSelectedThread}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
