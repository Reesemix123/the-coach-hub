'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'

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
  const [savedFl, setSavedFl] = useState(100)
  const [savedTb, setSavedTb] = useState(20)
  const [savedKo, setSavedKo] = useState(40)
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return // Keep loading=true until teamId arrives
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('teams')
      .select('field_length, touchback_yard_line, kickoff_yard_line')
      .eq('id', teamId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[LeagueRules] Fetch error:', error.message)
        }
        if (data) {
          const fl = data.field_length ?? 100, tb = data.touchback_yard_line ?? 20, ko = data.kickoff_yard_line ?? 40
          setFieldLength(fl); setTouchbackYardLine(tb); setKickoffYardLine(ko)
          setSavedFl(fl); setSavedTb(tb); setSavedKo(ko)
        }
        setLoading(false)
      })
  }, [teamId])

  const hasChanges = fieldLength !== savedFl || touchbackYardLine !== savedTb || kickoffYardLine !== savedKo

  async function handleSave() {
    if (!teamId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('teams').update({
      field_length: fieldLength,
      touchback_yard_line: touchbackYardLine,
      kickoff_yard_line: kickoffYardLine,
    }).eq('id', teamId)
    setSavedFl(fieldLength); setSavedTb(touchbackYardLine); setSavedKo(kickoffYardLine)
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
// More Page
// ---------------------------------------------------------------------------

export default function MobileMorePage() {
  const { teamId } = useMobile()

  return (
    <div className="min-h-screen bg-[#1c1c1e] pb-8">
      {/* League Rules */}
      <div className="px-4 pt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">League Rules</p>
        <div className="bg-[#2c2c2e] rounded-xl p-4">
          <LeagueRulesSection teamId={teamId} />
        </div>
      </div>

      {/* Team Settings */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Team</p>
        <div className="bg-[#2c2c2e] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Team Settings" subtitle="Name, level, colors" href={teamId ? `/football/teams/${teamId}/settings` : undefined} />
          <NavRow label="Roster" subtitle="Players and depth chart" href="/m/roster" />
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
