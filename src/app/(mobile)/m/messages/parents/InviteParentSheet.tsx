'use client'

import { useState } from 'react'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { useCommHub } from '../CommHubContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RELATIONSHIPS = ['Parent', 'Guardian', 'Other'] as const
type Relationship = typeof RELATIONSHIPS[number]

// ---------------------------------------------------------------------------
// InviteParentSheet
// ---------------------------------------------------------------------------

interface InviteParentSheetProps {
  onClose: () => void
  onSent: () => void
}

export default function InviteParentSheet({ onClose, onSent }: InviteParentSheetProps) {
  const { teamId, players } = useMobile()
  const { parentCount, parentLimit } = useCommHub()

  const [playerId, setPlayerId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('Parent')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atLimit = parentLimit !== null && parentCount >= parentLimit

  async function handleSend() {
    if (!teamId || !playerId || !firstName.trim() || !lastName.trim() || !email.trim()) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/communication/parents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          playerId,
          parentEmail: email.trim(),
          parentName: `${firstName.trim()} ${lastName.trim()}`,
          relationship,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send invitation')
        setSending(false)
        return
      }

      onSent()
    } catch {
      setError('Failed to send. Check your connection.')
      setSending(false)
    }
  }

  const canSubmit = !!playerId && firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Invite Parent</h3>

          {/* Limit gate */}
          {atLimit ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-amber-800 mb-1">Parent limit reached</p>
              <p className="text-xs text-amber-600">
                {"You've reached your parent limit ({parentLimit}). Upgrade to invite more.".replace('{parentLimit}', String(parentLimit))}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-sm font-semibold text-amber-700 underline"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Player select */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Player</label>
                <select
                  value={playerId}
                  onChange={e => setPlayerId(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                >
                  <option value="">Select a player</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey_number} {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name row */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="First"
                    autoComplete="given-name"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Last"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="parent@email.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone <span className="normal-case text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="(555) 000-0000"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>

              {/* Relationship */}
              <div className="mb-6">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Relationship</label>
                <div className="flex bg-gray-100 rounded-lg p-0.5 mt-1">
                  {RELATIONSHIPS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRelationship(r)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                        relationship === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-3">{error}</p>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !canSubmit}
                className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-sm font-bold active:bg-[#a8b85e] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
