'use client'

import { useState } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { useCommHub } from '../CommHubContext'
import ParentSelector from '../parents/ParentSelector'

// ---------------------------------------------------------------------------
// Constants (matches ComposeAnnouncement originals)
// ---------------------------------------------------------------------------

// TODO: MULTI-SPORT — pull position groups dynamically per sport
const POSITION_GROUPS = [
  { value: 'offense', label: 'Offense' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_teams', label: 'Special Teams' },
] as const

const PRIORITIES = ['normal', 'important', 'urgent'] as const

const CHANNELS = [
  { value: 'in_app', label: 'In-App Only', requiresPaid: false },
  { value: 'email', label: 'Email', requiresPaid: true },
  { value: 'sms', label: 'SMS', requiresPaid: true },
  { value: 'email_sms', label: 'Email + SMS', requiresPaid: true },
] as const

type Priority = (typeof PRIORITIES)[number]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Describes the "To:" targeting for the compose form.
 * - 'all': broadcast to every parent
 * - 'group': a position group (positionGroup is set)
 * - 'individual': a single parent (selectedParentId is set)
 */
type RecipientMode = 'all' | 'group' | 'individual'

interface ComposeSheetProps {
  /** Pre-select a parent for a direct reply */
  initialRecipientId?: string
  onClose: () => void
  onSent: () => void
}

// ---------------------------------------------------------------------------
// ComposeSheet
// ---------------------------------------------------------------------------

export default function ComposeSheet({ initialRecipientId, onClose, onSent }: ComposeSheetProps) {
  const { teamId } = useMobile()
  const { isPaid, parents } = useCommHub()

  // Recipient targeting
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(
    initialRecipientId ? 'individual' : 'all'
  )
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : []
  )
  const [positionGroup, setPositionGroup] = useState<string>('')
  const [showParentPicker, setShowParentPicker] = useState(false)

  // Announcement fields
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [channel, setChannel] = useState('in_app')

  // State
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Whether the current selection is a direct message (individual parent)
  const isDM = recipientMode === 'individual' && selectedParentIds.length === 1

  // Resolve the selected parent's display name for the "To:" chip
  const selectedParent = isDM
    ? parents.find(p => p.parent.id === selectedParentIds[0])
    : null

  // ---------------------------------------------------------------------------
  // Recipient selection helpers
  // ---------------------------------------------------------------------------

  function selectAll() {
    setRecipientMode('all')
    setSelectedParentIds([])
    setPositionGroup('')
    setShowParentPicker(false)
  }

  function selectGroup(group: string) {
    setRecipientMode('group')
    setPositionGroup(group)
    setSelectedParentIds([])
    setShowParentPicker(false)
  }

  function handleParentSelected(ids: string[]) {
    if (ids.length === 1) {
      setRecipientMode('individual')
      setSelectedParentIds(ids)
      setPositionGroup('')
      setShowParentPicker(false)
    }
  }

  function clearIndividual() {
    setRecipientMode('all')
    setSelectedParentIds([])
    setShowParentPicker(false)
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  async function handleSend() {
    if (!body.trim() || !teamId) return
    if (!isDM && !title.trim()) return
    setSending(true)
    setError(null)

    try {
      if (isDM) {
        // Direct message
        const res = await fetch('/api/communication/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            recipientId: selectedParentIds[0],
            message: body.trim(),
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to send')
          setSending(false)
          return
        }
      } else {
        // Announcement (all parents or position group)
        const res = await fetch('/api/communication/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            title: title.trim(),
            body: body.trim(),
            priority,
            notificationChannel: channel,
            targetPositionGroup:
              recipientMode === 'group' && positionGroup ? positionGroup : null,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to send')
          setSending(false)
          return
        }
      }

      onSent()
    } catch {
      setError('Failed to send. Check your connection.')
      setSending(false)
    }
  }

  const canSend = !!body.trim() && (isDM || !!title.trim()) && !sending

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>

        <div className="px-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">New Message</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-tertiary)] active:text-[var(--text-secondary)]"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* To: targeting */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">To</label>

            {/* If individual selected: show chip with X */}
            {isDM && selectedParent ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[var(--bg-card-alt)] rounded-full px-3 py-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedParent.parent.first_name} {selectedParent.parent.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={clearIndividual}
                    className="text-[var(--text-tertiary)] active:text-[var(--text-secondary)]"
                    aria-label="Remove recipient"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {/* All Parents */}
                <button
                  type="button"
                  onClick={selectAll}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    recipientMode === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
                  }`}
                >
                  All Parents
                </button>

                {/* Position group pills */}
                {POSITION_GROUPS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => selectGroup(g.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      recipientMode === 'group' && positionGroup === g.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}

                {/* Choose individual */}
                <button
                  type="button"
                  onClick={() => setShowParentPicker(prev => !prev)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)] transition-colors"
                >
                  Choose Parent
                </button>
              </div>
            )}

            {/* Inline parent picker */}
            {showParentPicker && !isDM && (
              <div className="mt-3 border border-[var(--border-primary)] rounded-xl overflow-hidden">
                <ParentSelector
                  mode="single"
                  selected={selectedParentIds}
                  onSelect={handleParentSelected}
                />
              </div>
            )}
          </div>

          {/* Announcement-only fields: title, priority, channel */}
          {!isDM && (
            <>
              {/* Title */}
              <div className="mb-4">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Announcement title"
                />
              </div>

              {/* Priority */}
              <div className="mb-4">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Priority
                </label>
                <div className="flex bg-[var(--bg-card-alt)] rounded-lg p-0.5 mt-1">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-md capitalize transition-colors ${
                        priority === p
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel */}
              <div className="mb-4">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Send via
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CHANNELS.map(ch => {
                    const disabled = ch.requiresPaid && !isPaid
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => !disabled && setChannel(ch.value)}
                        disabled={disabled}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          channel === ch.value
                            ? 'bg-gray-900 text-white'
                            : disabled
                              ? 'bg-[var(--bg-card-alt)] text-[var(--text-tertiary)]'
                              : 'bg-[var(--bg-card-alt)] text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)]'
                        }`}
                      >
                        {ch.label}
                        {disabled && (
                          <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">Upgrade</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {(channel === 'sms' || channel === 'email_sms') && (
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    SMS requires parent consent. Only consented parents will receive.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Message body */}
          <div className="mb-6">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              {isDM ? 'Message' : 'Body'}
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              className="w-full mt-1 px-3 py-2.5 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder={
                isDM
                  ? 'Write a message...'
                  : 'Write your message to parents...'
              }
            />
          </div>

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors disabled:bg-[var(--bg-pill-inactive)] disabled:text-[var(--text-tertiary)]"
          >
            {sending
              ? 'Sending...'
              : isDM
                ? 'Send Message'
                : 'Send Announcement'}
          </button>
        </div>
      </div>
    </>
  )
}
