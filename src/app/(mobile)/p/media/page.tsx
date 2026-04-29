'use client'

import { useState, useEffect, useRef } from 'react'
import { useParent } from '../ParentContext'
import { useSubscription } from '@/app/(mobile)/SubscriptionContext'
import { EmptyState } from '@/app/(mobile)/components/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SharedVideo {
  id: string
  title: string
  description: string | null
  mux_playback_id: string | null
  mux_asset_status: string
  duration_seconds: number | null
  coach_notes: string | null
  thumbnail_url: string | null
  created_at: string
}

interface SharedReport {
  id: string
  report_type: string
  coach_notes: string | null
  report_data: Record<string, unknown>
  shared_at: string
  viewed_at?: string | null
}

interface GameSummary {
  id: string
  opponent: string | null
  score_us: number | null
  score_them: number | null
  game_date: string | null
  published_text: string | null
  player_highlights: { player_id: string; highlight_text: string }[]
  published_at: string | null
}

type Tab = 'videos' | 'reports'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDuration(secs: number | null) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Video card
// ---------------------------------------------------------------------------

function VideoCard({ video, onTap }: { video: SharedVideo; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="w-full bg-[var(--bg-card)] rounded-xl overflow-hidden active:opacity-80 transition-opacity shadow-[var(--shadow)]">
      <div className="relative aspect-video bg-[var(--bg-card-alt)]">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
              <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          </div>
        )}
        {video.duration_seconds && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium rounded px-1.5 py-0.5">
            {fmtDuration(video.duration_seconds)}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{video.title}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{fmtDate(video.created_at)}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Video detail view (HLS player)
// ---------------------------------------------------------------------------

function VideoDetailView({ video, onBack }: { video: SharedVideo; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(true)

  // Fetch signed playback URL
  useEffect(() => {
    if (!video.mux_playback_id) { setLoadingUrl(false); return }
    fetch(`/api/communication/videos/${video.id}`)
      .then(r => r.json())
      .then(data => { setPlaybackUrl(data.playback_url ?? null); setLoadingUrl(false) })
      .catch(() => setLoadingUrl(false))
  }, [video])

  // HLS setup
  useEffect(() => {
    if (!playbackUrl || !videoRef.current) return
    const el = videoRef.current

    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = playbackUrl
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({ maxBufferLength: 30 })
          hls.loadSource(playbackUrl)
          hls.attachMedia(el)
        }
      }).catch(() => { el.src = playbackUrl })
    }
  }, [playbackUrl])

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-3 mb-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Media
        </button>
      </div>

      {/* Player */}
      <div className="mx-4 rounded-xl overflow-hidden bg-black aspect-video">
        {loadingUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : playbackUrl ? (
          <video ref={videoRef} controls playsInline className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-white/60">Video not available</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 mt-3">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{video.title}</h2>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{fmtDate(video.created_at)}{video.duration_seconds ? ` · ${fmtDuration(video.duration_seconds)}` : ''}</p>
        {video.description && <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-wrap">{video.description}</p>}
        {video.coach_notes && (
          <div className="bg-[var(--bg-card)] rounded-xl p-3 mt-3 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-1">Coach&apos;s Notes</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{video.coach_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report row + detail
// ---------------------------------------------------------------------------

function ReportRow({ report, onTap }: { report: SharedReport; onTap: () => void }) {
  const rd = report.report_data
  const opponent = (rd.opponent as string) || (rd.playerName as string) || 'Report'
  const preview = ((rd.highlights as string[]) ?? [])[0] ?? (rd.teamEffortSummary as string) ?? ''
  const isNew = !report.viewed_at

  return (
    <button type="button" onClick={onTap} className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{opponent}</p>
          {isNew && <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />}
        </div>
        {preview && <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{preview}</p>}
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{fmtDate(report.shared_at)}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  )
}

function ReportDetailView({ report, onBack }: { report: SharedReport; onBack: () => void }) {
  const rd = report.report_data
  const playerName = (rd.playerName as string) ?? null
  const jerseyNumber = (rd.jerseyNumber as string) ?? null
  const highlights = (rd.highlights as string[]) ?? []
  const growthAreas = (rd.growthAreas as string[]) ?? []
  const teamEffort = (rd.teamEffortSummary as string) ?? null
  const opponent = (rd.opponent as string) ?? null

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-3 mb-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Media
        </button>
      </div>

      <div className="px-4 space-y-3">
        {/* Header */}
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
          {playerName && (
            <div className="flex items-center gap-3 mb-2">
              {jerseyNumber && (
                <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] flex items-center justify-center">
                  <span className="text-sm font-bold text-[var(--text-primary)]">#{jerseyNumber}</span>
                </div>
              )}
              <p className="text-base font-bold text-[var(--text-primary)]">{playerName}</p>
            </div>
          )}
          {opponent && <p className="text-sm text-[var(--text-secondary)]">vs {opponent}</p>}
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{fmtDate(report.shared_at)}</p>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Highlights</p>
            <ul className="space-y-2">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] mt-1.5 shrink-0" />
                  <p className="text-sm text-[var(--text-primary)]">{h}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Growth areas */}
        {growthAreas.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Areas to Improve</p>
            <ul className="space-y-2">
              {growthAreas.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)] mt-1.5 shrink-0" />
                  <p className="text-sm text-[var(--text-primary)]">{g}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Coach notes */}
        {report.coach_notes && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Coach&apos;s Notes</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{report.coach_notes}</p>
          </div>
        )}

        {/* Team effort */}
        {teamEffort && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Team Effort</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{teamEffort}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game recap row + detail
// ---------------------------------------------------------------------------

function RecapRow({ recap, onTap }: { recap: GameSummary; onTap: () => void }) {
  const score = recap.score_us != null && recap.score_them != null ? `${recap.score_us}–${recap.score_them}` : null
  return (
    <button type="button" onClick={onTap} className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">vs {recap.opponent ?? 'Opponent'}</p>
          {score && <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-card-alt)] rounded-full px-2 py-0.5">{score}</span>}
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{fmtDate(recap.game_date)}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  )
}

function RecapDetailView({ recap, onBack }: { recap: GameSummary; onBack: () => void }) {
  const score = recap.score_us != null && recap.score_them != null ? `${recap.score_us}–${recap.score_them}` : null
  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-3 mb-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Media
        </button>
      </div>
      <div className="px-4 space-y-3">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">vs {recap.opponent ?? 'Opponent'}</h2>
          <div className="flex items-center gap-2 mt-1">
            {score && <span className="text-sm font-semibold text-[var(--text-primary)]">{score}</span>}
            <span className="text-xs text-[var(--text-tertiary)]">{fmtDate(recap.game_date)}</span>
          </div>
        </div>

        {recap.published_text && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Game Recap</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{recap.published_text}</p>
          </div>
        )}

        {recap.player_highlights?.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Player Highlights</p>
            <ul className="space-y-2">
              {recap.player_highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <p className="text-sm text-[var(--text-primary)]">{h.highlight_text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function VideoSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[var(--bg-card)] rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-[var(--bg-card-alt)]" />
          <div className="px-3 py-2.5"><div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-1" /><div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/3" /></div>
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-[var(--border-primary)] animate-pulse">
          <div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" /><div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ParentMediaPage() {
  const { currentTeamId, loading: parentLoading } = useParent()
  const { parentHasAccess, parentAccessSource, loading: subscriptionLoading } = useSubscription()
  const [tab, setTab] = useState<Tab>('videos')
  const [videos, setVideos] = useState<SharedVideo[]>([])
  const [reports, setReports] = useState<SharedReport[]>([])
  const [recaps, setRecaps] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedVideo, setSelectedVideo] = useState<SharedVideo | null>(null)
  const [selectedReport, setSelectedReport] = useState<SharedReport | null>(null)
  const [selectedRecap, setSelectedRecap] = useState<GameSummary | null>(null)

  useEffect(() => {
    if (!currentTeamId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/communication/videos?teamId=${currentTeamId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/communication/reports?teamId=${currentTeamId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/communication/game-summaries?teamId=${currentTeamId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([vData, rData, sData]) => {
      setVideos(vData.videos ?? [])
      setReports(rData.reports ?? [])
      setRecaps((sData.summaries ?? []).filter((s: GameSummary) => s.published_at))
      setLoading(false)
    })
  }, [currentTeamId])

  // No-team state — checked first so a parent with no team access doesn't see
  // a confusing subscription gate before they've even joined a team
  if (!parentLoading && !currentTeamId) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-4">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Media</h1>
        </div>
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
          title="You're not on a team yet"
          description="Once your coach adds you, game videos and reports will appear here."
        />
      </div>
    )
  }

  // Access gate — parent without comm hub access
  if (!subscriptionLoading && !parentHasAccess && parentAccessSource === 'none') {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-4">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Media</h1>
        </div>
        <EmptyState
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>}
          title="Media isn't available yet"
          description="Game videos and reports show up here once your team activates the Communication Hub."
          actionLabel="Learn more"
          actionHref="https://youthcoachhub.com"
        />
      </div>
    )
  }

  // Detail views
  if (selectedVideo) return <VideoDetailView video={selectedVideo} onBack={() => setSelectedVideo(null)} />
  if (selectedReport) return <ReportDetailView report={selectedReport} onBack={() => setSelectedReport(null)} />
  if (selectedRecap) return <RecapDetailView recap={selectedRecap} onBack={() => setSelectedRecap(null)} />

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Media</h1>
      </div>

      {/* Tab toggle */}
      <div className="px-4 mb-3">
        <div className="flex bg-[var(--bg-pill-inactive)] rounded-lg p-0.5">
          {(['videos', 'reports'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                tab === t ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
              }`}>
              {t === 'videos' ? 'Videos' : 'Reports'}
            </button>
          ))}
        </div>
      </div>

      {/* Videos tab */}
      {tab === 'videos' && (
        <div className="px-4">
          {loading && videos.length === 0 ? <VideoSkeleton /> : videos.length === 0 ? (
            <EmptyState
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>}
              title="No videos shared yet"
              description="Game videos will appear here when your coach shares them."
            />
          ) : (
            <div className="space-y-3">
              {videos.map(v => <VideoCard key={v.id} video={v} onTap={() => setSelectedVideo(v)} />)}
            </div>
          )}
        </div>
      )}

      {/* Reports tab */}
      {tab === 'reports' && (
        <div>
          {loading && reports.length === 0 && recaps.length === 0 ? <ListSkeleton /> : (reports.length === 0 && recaps.length === 0) ? (
            <EmptyState
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
              title="No reports shared yet"
              description="Player reports and game recaps will appear here."
            />
          ) : (
            <>
              {reports.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider px-4 mb-2">Player Reports</p>
                  <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden">
                    {reports.map(r => <ReportRow key={r.id} report={r} onTap={() => setSelectedReport(r)} />)}
                  </div>
                </div>
              )}
              {recaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider px-4 mb-2">Game Recaps</p>
                  <div className="bg-[var(--bg-card)] rounded-xl mx-4 overflow-hidden">
                    {recaps.map(r => <RecapRow key={r.id} recap={r} onTap={() => setSelectedRecap(r)} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
