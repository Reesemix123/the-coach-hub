'use client'

import React, { memo, useMemo, useState } from 'react'
import type { PlayInstance } from '@/types/football'

// ============================================
// TYPES
// ============================================

interface SidelinePlayListPanelProps {
  sidelinePlays: PlayInstance[]
  gameId?: string
  gameCreatedAt?: string
  gameHasLineup?: boolean // game_lineups rows exist — evidence of sideline tracking
}

// ============================================
// HELPERS
// ============================================

function getDownLabel(down?: number): string {
  if (!down) return ''
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
  return labels[down] || `${down}th`
}

function getResultLabel(result?: string): string {
  if (!result) return ''
  const labels: Record<string, string> = {
    run_gain: 'Run',
    run_loss: 'Run Loss',
    run_no_gain: 'No Gain',
    pass_complete: 'Complete',
    pass_incomplete: 'Incomplete',
    touchdown: 'Touchdown',
    fumble: 'Turnover',
    sack: 'Sack',
    penalty: 'Penalty',
    safety: 'Safety',
  }
  return labels[result] || result.replace(/_/g, ' ')
}

function getQuarterLabel(quarter?: number): string {
  if (!quarter) return 'Unknown'
  if (quarter === 5) return 'OT'
  const labels: Record<number, string> = { 1: '1st Quarter', 2: '2nd Quarter', 3: '3rd Quarter', 4: '4th Quarter' }
  return labels[quarter] || `Q${quarter}`
}

// ============================================
// COMPONENT
// ============================================

export const SidelinePlayListPanel = memo(function SidelinePlayListPanel({
  sidelinePlays,
  gameId,
  gameCreatedAt,
  gameHasLineup,
}: SidelinePlayListPanelProps) {
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (!gameId) return false
    try { return sessionStorage.getItem(`sideline-banner-dismissed-${gameId}`) === '1' } catch { return false }
  })

  // Group plays by quarter
  const groupedByQuarter = useMemo(() => {
    const groups = new Map<number, PlayInstance[]>()
    for (const play of sidelinePlays) {
      const q = play.quarter ?? 1
      if (!groups.has(q)) groups.set(q, [])
      groups.get(q)!.push(play)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b)
  }, [sidelinePlays])

  if (sidelinePlays.length === 0) {
    // Show "not synced yet" banner if evidence of sideline tracking exists
    if (!gameHasLineup || bannerDismissed) return null

    // Only show for games created within last 7 days
    if (gameCreatedAt) {
      const age = Date.now() - new Date(gameCreatedAt).getTime()
      if (age > 7 * 24 * 60 * 60 * 1000) return null
    }

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg mt-4 p-3 flex items-start gap-2.5">
        <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-xs text-gray-600 flex-1">
          Sideline plays haven&apos;t synced yet. Open Youth Coach Hub on your phone to sync your game data.
        </p>
        <button
          type="button"
          onClick={() => {
            setBannerDismissed(true)
            try { sessionStorage.setItem(`sideline-banner-dismissed-${gameId}`, '1') } catch {}
          }}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 mt-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Sideline Logged</h3>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
          {sidelinePlays.length} play{sidelinePlays.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Play list grouped by quarter */}
      <div className="max-h-[500px] overflow-y-auto">
        {groupedByQuarter.map(([quarter, plays]) => (
          <div key={quarter}>
            {/* Quarter header */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {getQuarterLabel(quarter)}
              </p>
            </div>

            {/* Plays in this quarter */}
            {plays.map((play, index) => {
              const yards = play.yards_gained ?? 0
              const isPositive = yards > 0
              const isNegative = yards < 0

              return (
                <div
                  key={play.id || `${quarter}-${index}`}
                  className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: play info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Down & distance */}
                        {play.down && play.distance && (
                          <span className="text-sm font-medium text-gray-900">
                            {getDownLabel(play.down)} & {play.distance}
                          </span>
                        )}

                        {/* Play code */}
                        {play.play_code && (
                          <span className="text-sm text-gray-600">{play.play_code}</span>
                        )}

                        {/* Opponent badge */}
                        {play.is_opponent_play && (
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                            Opponent
                          </span>
                        )}
                      </div>

                      {/* Result and yards */}
                      {play.result && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{getResultLabel(play.result)}</span>
                          {yards !== 0 && (
                            <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                              {isPositive ? '+' : ''}{yards} yd{Math.abs(yards) !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {play.notes && (
                        <div className="mt-1.5 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                          <p className="text-xs text-yellow-800">{play.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                        No film
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
})
