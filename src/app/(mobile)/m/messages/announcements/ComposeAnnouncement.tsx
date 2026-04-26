'use client'

import { useState } from 'react'
import { useCommHub } from '../CommHubContext'
import { useMobile } from '@/app/(mobile)/MobileContext'

// TODO: MULTI-SPORT — pull position groups dynamically per sport
const POSITION_GROUPS = [
  { value: '', label: 'All Parents' },
  { value: 'offense', label: 'Offense' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_teams', label: 'Special Teams' },
]

const PRIORITIES = ['normal', 'important', 'urgent'] as const
const CHANNELS = [
  { value: 'in_app', label: 'In-App Only', requiresPaid: false },
  { value: 'email', label: 'Email', requiresPaid: true },
  { value: 'sms', label: 'SMS', requiresPaid: true },
  { value: 'email_sms', label: 'Email + SMS', requiresPaid: true },
] as const

interface ComposeAnnouncementProps {
  onClose: () => void
  onSent: () => void
}

export default function ComposeAnnouncement({ onClose, onSent }: ComposeAnnouncementProps) {
  const { teamId } = useMobile()
  const { isPaid } = useCommHub()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('normal')
  const [channel, setChannel] = useState('in_app')
  const [positionGroup, setPositionGroup] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!title.trim() || !body.trim() || !teamId) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/communication/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          title: title.trim(),
          body: body.trim(),
          priority,
          notificationChannel: channel,
          targetPositionGroup: positionGroup || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send')
        setSending(false)
        return
      }

      onSent()
      onClose()
    } catch {
      setError('Failed to send. Check your connection.')
      setSending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">New Announcement</h3>

          {/* Title */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Announcement title"
            />
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Write your message to parents..."
            />
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5 mt-1">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md capitalize transition-colors ${
                    priority === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Channel */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Send via</label>
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
                          ? 'bg-gray-100 text-gray-300'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {ch.label}
                    {disabled && <span className="ml-1 text-[10px] text-gray-400">Upgrade</span>}
                  </button>
                )
              })}
            </div>
            {(channel === 'sms' || channel === 'email_sms') && (
              <p className="text-[10px] text-gray-400 mt-1">SMS requires parent consent. Only consented parents will receive.</p>
            )}
          </div>

          {/* Position group */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Send to</label>
            <select
              value={positionGroup}
              onChange={e => setPositionGroup(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              {POSITION_GROUPS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-500 mb-3">{error}</p>
          )}

          {/* Send */}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </div>
    </>
  )
}
