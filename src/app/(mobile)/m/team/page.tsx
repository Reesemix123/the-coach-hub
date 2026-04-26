'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const PlaybookPage = dynamic(() => import('../playbook/page'), { ssr: false })
const RosterPage = dynamic(() => import('../roster/page'), { ssr: false })

type TeamSegment = 'playbook' | 'roster'

export default function MobileTeamPage() {
  const [segment, setSegment] = useState<TeamSegment>(() => {
    try {
      return (sessionStorage.getItem('ych-team-segment') as TeamSegment) || 'playbook'
    } catch { return 'playbook' }
  })

  function handleSegmentChange(s: TeamSegment) {
    setSegment(s)
    try { sessionStorage.setItem('ych-team-segment', s) } catch {}
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Segmented control overlay */}
      <div className="bg-[var(--bg-primary)] px-4 pt-12 pb-3 sticky top-0 z-20">
        <div className="flex bg-[var(--bg-pill-inactive)] rounded-lg p-0.5">
          {(['playbook', 'roster'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleSegmentChange(s)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                segment === s
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {s === 'playbook' ? 'Playbook' : 'Roster'}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-page content */}
      {segment === 'playbook' ? <PlaybookPage /> : <RosterPage />}
    </div>
  )
}
