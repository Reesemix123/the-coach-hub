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
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    const supabase = createClient()
    supabase
      .from('teams')
      .select('field_length, touchback_yard_line, kickoff_yard_line')
      .eq('id', teamId)
      .single()
      .then(({ data }) => {
        if (data) {
          setFieldLength(data.field_length ?? 100)
          setTouchbackYardLine(data.touchback_yard_line ?? 20)
          setKickoffYardLine(data.kickoff_yard_line ?? 40)
        }
        setLoading(false)
      })
  }, [teamId])

  async function saveSetting(field: string, value: number) {
    if (!teamId) return
    const supabase = createClient()
    await supabase.from('teams').update({ [field]: value }).eq('id', teamId)
    setSaved(field)
    setTimeout(() => setSaved(null), 1500)
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Field Length</p>
          {saved === 'field_length' && <span className="text-[10px] text-[#B8CA6E] font-medium">Saved</span>}
        </div>
        <SegmentedPill
          options={[50, 80, 100]}
          value={fieldLength}
          onChange={(v) => { setFieldLength(v); saveSetting('field_length', v) }}
          labels={{ '50': '50 yds', '80': '80 yds', '100': '100 yds' }}
        />
      </div>

      {/* Touchback Yard Line */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Touchback Yard Line</p>
          {saved === 'touchback_yard_line' && <span className="text-[10px] text-[#B8CA6E] font-medium">Saved</span>}
        </div>
        <SegmentedPill
          options={[20, 25, 30]}
          value={touchbackYardLine}
          onChange={(v) => { setTouchbackYardLine(v); saveSetting('touchback_yard_line', v) }}
          labels={{ '20': '20 yd', '25': '25 yd', '30': '30 yd' }}
        />
      </div>

      {/* Kickoff Yard Line */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Kickoff Yard Line</p>
          {saved === 'kickoff_yard_line' && <span className="text-[10px] text-[#B8CA6E] font-medium">Saved</span>}
        </div>
        <SegmentedPill
          options={[30, 35, 40]}
          value={kickoffYardLine}
          onChange={(v) => { setKickoffYardLine(v); saveSetting('kickoff_yard_line', v) }}
          labels={{ '30': '30 yd', '35': '35 yd', '40': '40 yd' }}
        />
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
