'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { getQueue, getPendingCount, getAllQueuedGameIds, isOnline } from '@/lib/utils/playQueue'
import { processQueue } from '@/lib/utils/syncEngine'

// ---------------------------------------------------------------------------
// Segmented Pill
// ---------------------------------------------------------------------------

function SegmentedPill<T extends string | number>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labels?: Record<string, string>
}) {
  return (
    <div className="flex bg-[#3a3a3c] rounded-full p-1">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={[
            'flex-1 py-2 rounded-full text-sm font-semibold text-center transition-colors min-h-[36px]',
            value === opt ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400',
          ].join(' ')}
        >
          {labels?.[String(opt)] ?? String(opt)}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League Rules Section
// ---------------------------------------------------------------------------

function LeagueRulesSection({ teamId }: { teamId: string | null }) {
  const [fieldLength, setFieldLength] = useState(100)
  const [touchbackYardLine, setTouchbackYardLine] = useState(20)
  const [kickoffYardLine, setKickoffYardLine] = useState(40)
  const [quarterLength, setQuarterLength] = useState(12)
  const [savedFl, setSavedFl] = useState(100)
  const [savedTb, setSavedTb] = useState(20)
  const [savedKo, setSavedKo] = useState(40)
  const [savedQl, setSavedQl] = useState(12)
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[LeagueRules] teamId:', teamId)
    if (!teamId) {
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase
      .from('teams')
      .select('field_length, touchback_yard_line, kickoff_yard_line, quarter_length_minutes')
      .eq('id', teamId)
      .single()
      .then(({ data, error }) => {
        console.log('[LeagueRules] fetch result:', { data, error })
        if (data) {
          const fl = data.field_length ?? 100, tb = data.touchback_yard_line ?? 20, ko = data.kickoff_yard_line ?? 40, ql = data.quarter_length_minutes ?? 12
          console.log('[LeagueRules] setting values:', { fl, tb, ko, ql })
          setFieldLength(fl); setTouchbackYardLine(tb); setKickoffYardLine(ko); setQuarterLength(ql)
          setSavedFl(fl); setSavedTb(tb); setSavedKo(ko); setSavedQl(ql)
        }
        setLoading(false)
      })
  }, [teamId])

  const hasChanges = fieldLength !== savedFl || touchbackYardLine !== savedTb || kickoffYardLine !== savedKo || quarterLength !== savedQl

  async function handleSave() {
    if (!teamId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('teams').update({
      field_length: fieldLength,
      touchback_yard_line: touchbackYardLine,
      kickoff_yard_line: kickoffYardLine,
      quarter_length_minutes: quarterLength,
    }).eq('id', teamId)
    setSavedFl(fieldLength); setSavedTb(touchbackYardLine); setSavedKo(kickoffYardLine); setSavedQl(quarterLength)
    setSaving(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="h-4 w-32 bg-[#3a3a3c] rounded animate-pulse mb-4" />
        <div className="h-10 bg-[#3a3a3c] rounded-full animate-pulse mb-4" />
        <div className="h-10 bg-[#3a3a3c] rounded-full animate-pulse mb-4" />
        <div className="h-10 bg-[#3a3a3c] rounded-full animate-pulse mb-4" />
        <div className="h-10 bg-[#3a3a3c] rounded-full animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      {/* Field Length */}
      <div className="mb-5">
        <p className="text-sm font-medium text-white mb-2">Field Length</p>
        <SegmentedPill
          options={[50, 80, 100]}
          value={fieldLength}
          onChange={setFieldLength}
          labels={{ '50': '50 yds', '80': '80 yds', '100': '100 yds' }}
        />
      </div>

      {/* Touchback Yard Line */}
      <div className="mb-5">
        <p className="text-sm font-medium text-white mb-2">Touchback Yard Line</p>
        <SegmentedPill
          options={[20, 25, 30]}
          value={touchbackYardLine}
          onChange={setTouchbackYardLine}
          labels={{ '20': '20 yd', '25': '25 yd', '30': '30 yd' }}
        />
      </div>

      {/* Kickoff Yard Line */}
      <div className="mb-5">
        <p className="text-sm font-medium text-white mb-2">Kickoff Yard Line</p>
        <SegmentedPill
          options={[30, 35, 40]}
          value={kickoffYardLine}
          onChange={setKickoffYardLine}
          labels={{ '30': '30 yd', '35': '35 yd', '40': '40 yd' }}
        />
      </div>

      {/* Quarter Length */}
      <div className="mb-5">
        <p className="text-sm font-medium text-white mb-2">Quarter Length</p>
        <SegmentedPill
          options={[8, 10, 12, 15]}
          value={quarterLength}
          onChange={setQuarterLength}
          labels={{ '8': '8 min', '10': '10 min', '12': '12 min', '15': '15 min' }}
        />
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={[
            'rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors min-h-[40px]',
            hasChanges && !saving
              ? 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]'
              : 'bg-[#3a3a3c] text-gray-500',
          ].join(' ')}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {showSaved && <span className="text-xs text-[#B8CA6E] font-medium">Saved</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nav Row
// ---------------------------------------------------------------------------

function NavRow({ label, href, subtitle }: { label: string; href?: string; subtitle?: string }) {
  const content = (
    <div className="flex items-center justify-between py-4 px-4 active:bg-[#2c2c2e] transition-colors">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )

  if (href) {
    return <a href={href} className="block border-b border-[#3a3a3c]">{content}</a>
  }
  return <div className="border-b border-[#3a3a3c] opacity-50">{content}</div>
}

// ---------------------------------------------------------------------------
// Game Data Section
// ---------------------------------------------------------------------------

function GameDataSection() {
  const { teamId, activeGameId, setConsecutiveSyncFailures } = useMobile()
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)

  // Check for any queued items (active game or orphaned)
  const orphaned = getAllQueuedGameIds()
  const activeQueueId = activeGameId ?? orphaned[0]?.gameId ?? null
  const activeQueueTeamId = activeGameId ? teamId : orphaned[0]?.teamId ?? null
  const pendingCount = activeQueueId ? getPendingCount(activeQueueId) : 0
  const hasOrphaned = !activeGameId && orphaned.length > 0

  // Check for items older than 24h (for download button)
  const hasOldItems = (() => {
    if (!activeQueueId) return false
    const queue = getQueue(activeQueueId)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    return queue.some(e => (e.status === 'pending' || e.status === 'failed') && e.createdAt < dayAgo)
  })()

  // Don't show section if no active game and no orphaned items
  if (!activeGameId && orphaned.length === 0) return null

  async function handleSaveNow() {
    if (!activeQueueId || !activeQueueTeamId || saving) return
    setSaving(true)
    setSaveResult(null)
    try {
      const supabase = createClient()
      const result = await processQueue(activeQueueId, activeQueueTeamId, supabase)
      if (result.synced > 0) {
        setConsecutiveSyncFailures(0)
        setSaveResult(`${result.synced} play${result.synced !== 1 ? 's' : ''} saved`)
      } else if (result.remaining > 0) {
        setSaveResult(`${result.remaining} still waiting`)
      } else {
        setSaveResult('All saved')
      }
    } catch {
      setSaveResult('Save failed — try again')
    }
    setSaving(false)
    setTimeout(() => setSaveResult(null), 3000)
  }

  function handleDownloadBackup() {
    if (!activeQueueId) return
    const queue = getQueue(activeQueueId)
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ych-game-backup-${activeQueueId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Game Data</p>
      <div className="bg-[#2c2c2e] rounded-xl mx-4 p-4">
        {/* Status */}
        <p className="text-sm text-white font-medium">
          {pendingCount === 0
            ? 'All game data saved ✓'
            : hasOrphaned
              ? `${pendingCount} play${pendingCount !== 1 ? 's' : ''} from your last game waiting to save`
              : `${pendingCount} play${pendingCount !== 1 ? 's' : ''} waiting to save`
          }
        </p>

        {saveResult && (
          <p className="text-xs text-[#B8CA6E] mt-1">{saveResult}</p>
        )}

        {/* Buttons */}
        {pendingCount > 0 && (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSaveNow}
              disabled={saving || !isOnline()}
              className={[
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[40px]',
                saving ? 'bg-[#3a3a3c] text-gray-500' : 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]',
              ].join(' ')}
            >
              {saving ? 'Saving...' : 'Save Now'}
            </button>

            {hasOldItems && (
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex-1 bg-[#3a3a3c] text-white rounded-xl py-2.5 text-sm font-semibold min-h-[40px] active:bg-[#48484a] transition-colors"
              >
                Download Backup
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// More Page
// ---------------------------------------------------------------------------

export default function MobileMorePage() {
  const { teamId, players } = useMobile()

  return (
    <div className="min-h-screen bg-[#1c1c1e] pb-8">
      {/* Roster */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Roster</p>
        <div className="bg-[#2c2c2e] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Roster & Depth Chart" subtitle={`${players.length} player${players.length !== 1 ? 's' : ''}`} href="/m/roster" />
        </div>
      </div>

      {/* League Rules */}
      <div className="px-4 pt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">League Rules</p>
        <div className="bg-[#2c2c2e] rounded-xl p-4">
          <LeagueRulesSection teamId={teamId} />
        </div>
      </div>

      {/* Game Data */}
      <GameDataSection />

      {/* Team Settings */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Team</p>
        <div className="bg-[#2c2c2e] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Team Settings" subtitle="Name, level, colors" href={teamId ? `/football/teams/${teamId}/settings` : undefined} />
          <NavRow label="Schedule" subtitle="Games and events" />
        </div>
      </div>

      {/* Account */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Account</p>
        <div className="bg-[#2c2c2e] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Profile" subtitle="Name, email, avatar" />
          <NavRow label="Notifications" subtitle="Push and email preferences" />
          <NavRow label="Sign Out" href="/auth/signout" />
        </div>
      </div>

      {/* App Info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-600">Youth Coach Hub</p>
        <p className="text-[10px] text-gray-700 mt-0.5">v0.1.0</p>
      </div>
    </div>
  )
}
