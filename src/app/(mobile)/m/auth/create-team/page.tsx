'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/app/(mobile)/RoleContext'
import { FeatureGateModal } from '@/app/(mobile)/components/FeatureGateModal'

const LEVELS = [
  { value: 'Youth', label: 'Youth' },
  { value: 'Middle School', label: 'Middle School' },
  { value: 'JV', label: 'JV' },
  { value: 'Varsity', label: 'Varsity' },
  { value: 'College', label: 'College' },
]

export default function CreateTeamPage() {
  const router = useRouter()
  const { refetch } = useRole()

  const [name, setName] = useState('')
  const [level, setLevel] = useState('Varsity')
  const [sport] = useState('football')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTeamLimitGate, setShowTeamLimitGate] = useState(false)
  const [teamLimitMax, setTeamLimitMax] = useState(1)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setError(null)
    setLoading(true)

    try {
      // Create team via existing API
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sport,
          level,
          colors: { primary: 'Blue', secondary: 'White' },
          default_tier: 'basic',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'TEAM_LIMIT_REACHED') {
          setTeamLimitMax(data.max_teams ?? 1)
          setShowTeamLimitGate(true)
        } else {
          setError(data.error || 'Failed to create team')
        }
        setLoading(false)
        return
      }

      const teamId = data.team?.id
      if (!teamId) {
        setError('Team created but no ID returned')
        setLoading(false)
        return
      }

      // Activate free Rookie communication plan
      try {
        await fetch('/api/communication/plan/activate-rookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
        })
      } catch {
        // Non-blocking — comm plan activation failure shouldn't block onboarding
      }

      // Refresh role context so coach flow picks up the new team
      await refetch()

      // Navigate to coach home
      router.replace('/m/practice')
    } catch {
      setError('Network error. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center px-6 pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8">
        <img
          src="/logo-darkmode.png"
          className="w-12 h-12 object-contain mb-4"
          alt=""
        />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Set up your team</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">You can customize everything later</p>
      </div>

      {/* Form */}
      <form onSubmit={handleCreate} className="w-full max-w-sm space-y-5">
        {/* Team name */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Team Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Lincoln Lions"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
          />
        </div>

        {/* Level */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Level
          </label>
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm appearance-none"
          >
            {LEVELS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[var(--status-error)] text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
          )}
          Create Team
        </button>
      </form>

      {/* Footer */}
      <p className="text-xs text-[var(--text-tertiary)] mt-8 text-center max-w-[260px]">
        Your team starts on the free Basic plan. You can upgrade anytime.
      </p>

      {/* Team limit gate modal */}
      <FeatureGateModal
        open={showTeamLimitGate}
        onClose={() => setShowTeamLimitGate(false)}
        title="Team limit reached"
        description={`You've reached your limit of ${teamLimitMax} team${teamLimitMax !== 1 ? 's' : ''} on your current plan. Upgrade for more teams.`}
        actionLabel="View Plans"
        actionHref="/dashboard"
      />
    </div>
  )
}
