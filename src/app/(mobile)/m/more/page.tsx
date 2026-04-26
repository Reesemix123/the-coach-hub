'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { getQueue, getPendingCount, getAllQueuedGameIds, isOnline } from '@/lib/utils/playQueue'
import { processQueue } from '@/lib/utils/syncEngine'
import CollapsibleSection from './components/CollapsibleSection'
import { useTheme, type ThemePreference } from '@/app/(mobile)/ThemeContext'

// ---------------------------------------------------------------------------
// Segmented Pill (light theme)
// ---------------------------------------------------------------------------

function SegmentedPill<T extends string | number>({
  options, value, onChange, labels,
}: {
  options: T[]; value: T; onChange: (v: T) => void; labels?: Record<string, string>
}) {
  return (
    <div className="flex bg-[var(--bg-pill-inactive)] rounded-full p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-full text-sm font-semibold text-center transition-colors min-h-[36px] ${
            value === opt ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-[var(--text-secondary)]'
          }`}
        >
          {labels?.[String(opt)] ?? String(opt)}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League Rules (used inside CollapsibleSection)
// ---------------------------------------------------------------------------

function LeagueRulesContent({
  teamId,
  onSaved,
  onValuesLoaded,
}: {
  teamId: string | null
  onSaved: () => void
  onValuesLoaded: (summary: string) => void
}) {
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

  const buildSummary = useCallback((fl: number, tb: number, ko: number, ql: number) => {
    return `${fl} yd · ${tb} yd touchback · ${ko} yd kickoff · ${ql} min quarters`
  }, [])

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    const supabase = createClient()
    supabase
      .from('teams')
      .select('field_length, touchback_yard_line, kickoff_yard_line, quarter_length_minutes')
      .eq('id', teamId)
      .single()
      .then(({ data }) => {
        if (data) {
          const fl = data.field_length ?? 100
          const tb = data.touchback_yard_line ?? 20
          const ko = data.kickoff_yard_line ?? 40
          const ql = data.quarter_length_minutes ?? 12
          setFieldLength(fl); setTouchbackYardLine(tb); setKickoffYardLine(ko); setQuarterLength(ql)
          setSavedFl(fl); setSavedTb(tb); setSavedKo(ko); setSavedQl(ql)
          onValuesLoaded(buildSummary(fl, tb, ko, ql))
        }
        setLoading(false)
      })
  }, [teamId, onValuesLoaded, buildSummary])

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
    onValuesLoaded(buildSummary(fieldLength, touchbackYardLine, kickoffYardLine, quarterLength))
    setTimeout(() => { setShowSaved(false); onSaved() }, 800)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-[var(--bg-card-alt)] rounded-full animate-pulse" />
        <div className="h-10 bg-[var(--bg-card-alt)] rounded-full animate-pulse" />
        <div className="h-10 bg-[var(--bg-card-alt)] rounded-full animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Field Length</p>
        <SegmentedPill options={[50, 80, 100]} value={fieldLength} onChange={setFieldLength}
          labels={{ '50': '50 yds', '80': '80 yds', '100': '100 yds' }} />
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Touchback</p>
        <SegmentedPill options={[20, 25, 30]} value={touchbackYardLine} onChange={setTouchbackYardLine}
          labels={{ '20': '20 yd', '25': '25 yd', '30': '30 yd' }} />
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Kickoff From</p>
        <SegmentedPill options={[30, 35, 40]} value={kickoffYardLine} onChange={setKickoffYardLine}
          labels={{ '30': '30 yd', '35': '35 yd', '40': '40 yd' }} />
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Quarter Length</p>
        <SegmentedPill options={[8, 10, 12, 15]} value={quarterLength} onChange={setQuarterLength}
          labels={{ '8': '8 min', '10': '10 min', '12': '12 min', '15': '15 min' }} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={!hasChanges || saving}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors min-h-[40px] ${
            hasChanges && !saving ? 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]' : 'bg-[var(--bg-pill-inactive)] text-[var(--text-tertiary)]'
          }`}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {showSaved && <span className="text-xs text-[#B8CA6E] font-medium">Saved ✓</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game Data Section (light theme)
// ---------------------------------------------------------------------------

function GameDataSection() {
  const { teamId, activeGameId, setConsecutiveSyncFailures } = useMobile()
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)

  const orphaned = getAllQueuedGameIds()
  const activeQueueId = activeGameId ?? orphaned[0]?.gameId ?? null
  const activeQueueTeamId = activeGameId ? teamId : orphaned[0]?.teamId ?? null
  const pendingCount = activeQueueId ? getPendingCount(activeQueueId) : 0
  const hasOrphaned = !activeGameId && orphaned.length > 0

  const hasOldItems = (() => {
    if (!activeQueueId) return false
    const queue = getQueue(activeQueueId)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    return queue.some(e => (e.status === 'pending' || e.status === 'failed') && e.createdAt < dayAgo)
  })()

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
    <div className="mt-5">
      <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-4 mb-2">Data</p>
      <div className="bg-[var(--bg-card)] rounded-xl mx-4 p-4">
        <p className="text-sm text-[var(--text-primary)] font-medium">
          {pendingCount === 0
            ? 'All game data saved ✓'
            : hasOrphaned
              ? `${pendingCount} play${pendingCount !== 1 ? 's' : ''} from your last game waiting to save`
              : `${pendingCount} play${pendingCount !== 1 ? 's' : ''} waiting to save`
          }
        </p>
        {saveResult && <p className="text-xs text-[#B8CA6E] mt-1">{saveResult}</p>}
        {pendingCount > 0 && (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleSaveNow} disabled={saving || !isOnline()}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[40px] ${
                saving ? 'bg-[var(--bg-card-alt)] text-[var(--text-tertiary)]' : 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]'
              }`}>
              {saving ? 'Saving...' : 'Save Now'}
            </button>
            {hasOldItems && (
              <button type="button" onClick={handleDownloadBackup}
                className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-2.5 text-sm font-semibold min-h-[40px] active:bg-[var(--bg-pill-inactive)] transition-colors">
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
// Nav Row (light theme)
// ---------------------------------------------------------------------------

function NavRow({ label, href, subtitle, disabled, onTap }: {
  label: string; href?: string; subtitle?: string; disabled?: boolean; onTap?: () => void
}) {
  const content = (
    <div className={`flex items-center justify-between py-3.5 px-4 transition-colors ${disabled ? '' : 'active:bg-[var(--bg-card-alt)]'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${disabled ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{label}</p>
        {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 ${disabled ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-tertiary)]'}`}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )

  if (onTap) {
    return <button type="button" onClick={onTap} className="w-full text-left border-b border-[var(--border-primary)] last:border-b-0">{content}</button>
  }
  if (href) {
    return <a href={href} className="block border-b border-[var(--border-primary)] last:border-b-0">{content}</a>
  }
  return <div className="border-b border-[var(--border-primary)] last:border-b-0">{content}</div>
}

// ---------------------------------------------------------------------------
// More Page
// ---------------------------------------------------------------------------

const THEME_LABELS: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export default function MobileMorePage() {
  const { teamId, players } = useMobile()
  const { themePreference, setThemePreference } = useTheme()
  const [rulesSummary, setRulesSummary] = useState('Loading...')
  const [rulesCollapsed, setRulesCollapsed] = useState(false)
  const [comingSoonMsg, setComingSoonMsg] = useState<string | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showThemeSheet, setShowThemeSheet] = useState(false)

  function handleComingSoon(feature: string) {
    setComingSoonMsg(`${feature} coming soon`)
    setTimeout(() => setComingSoonMsg(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">More</h1>
      </div>

      {/* Coming soon toast */}
      {comingSoonMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-pulse">
          {comingSoonMsg}
        </div>
      )}

      {/* TEAM */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-4 mb-2">Team</p>
        <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Roster & Depth Chart" subtitle={`${players.length} player${players.length !== 1 ? 's' : ''}`} href="/m/roster" />
          {/* // TODO: Mobile-specific team settings page */}
          <NavRow label="Team Settings" subtitle="Name, level, colors" href={teamId ? `/football/teams/${teamId}/settings` : undefined} />
        </div>
      </div>

      {/* GAME RULES (collapsible) */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-4 mb-2">Game Rules</p>
        <CollapsibleSection
          title="Field & Quarter Settings"
          summary={rulesSummary}
          defaultExpanded={false}
          key={rulesCollapsed ? 'collapsed' : 'default'}
        >
          <LeagueRulesContent
            teamId={teamId}
            onSaved={() => setRulesCollapsed(prev => !prev)}
            onValuesLoaded={setRulesSummary}
          />
        </CollapsibleSection>
      </div>

      {/* DATA */}
      <GameDataSection />

      {/* ACCOUNT */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-4 mb-2">Account</p>
        <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden">
          <NavRow label="Appearance" subtitle={THEME_LABELS[themePreference]} onTap={() => setShowThemeSheet(true)} />
          <NavRow label="Profile" subtitle="Name, email, avatar" onTap={() => handleComingSoon('Profile settings')} disabled />
          <NavRow label="Notifications" subtitle="Push and email preferences" onTap={() => handleComingSoon('Notification settings')} disabled />
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full text-left px-4 py-3.5 active:bg-[var(--bg-card-alt)] transition-colors"
          >
            <p className="text-sm font-medium text-red-500">Sign Out</p>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">Youth Coach Hub</p>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">v0.1.0</p>
      </div>

      {/* Theme Selector Sheet */}
      {showThemeSheet && (
        <>
          <div className="fixed inset-0 bg-[var(--bg-overlay)] z-50" onClick={() => setShowThemeSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-sheet)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" /></div>
            <div className="px-5 pb-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Appearance</h3>
              {(['light', 'dark', 'system'] as ThemePreference[]).map(pref => (
                <button
                  key={pref}
                  type="button"
                  onClick={() => { setThemePreference(pref); setShowThemeSheet(false) }}
                  className="w-full flex items-center justify-between py-3.5 border-b border-[var(--border-primary)] last:border-b-0 active:opacity-70"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">{THEME_LABELS[pref]}</span>
                  {themePreference === pref && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8CA6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sign Out Confirmation */}
      {showSignOutConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowSignOutConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" /></div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Sign Out?</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">You&apos;ll need to sign in again to access your team.</p>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-semibold active:bg-[var(--bg-pill-inactive)]">
                  Cancel
                </button>
                <a href="/auth/signout"
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold text-center active:bg-red-700">
                  Sign Out
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
