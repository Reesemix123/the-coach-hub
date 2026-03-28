'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Loader2, ChevronLeft, BarChart3, Newspaper, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { ReportCard } from '@/components/communication/reports/ReportCard';
import { GameSummaryEditor } from '@/components/communication/reports/GameSummaryEditor';
import type { GameOption } from '@/components/communication/reports/GameSummaryEditor';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';
import type {
  SharedReport,
  GameSummary,
  NotificationChannel,
  ReportType,
  PlayerHighlight,
} from '@/types/communication';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type ViewMode = 'reports' | 'summaries';

interface RosterPlayer {
  id: string;
  name: string;
  jersey_number: number | null;
}

interface GameSummaryFormData {
  coachRawNotes: string;
  aiDraft: string;
  publishedText: string;
  opponent: string;
  scoreUs: number | null;
  scoreThem: number | null;
  gameDate: string;
  playerHighlights: PlayerHighlight[];
  notificationChannel: NotificationChannel;
  gameId?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CoachReportsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);

  const [viewMode, setViewMode] = useState<ViewMode>('reports');
  const [reports, setReports] = useState<SharedReport[]>([]);
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-report form state
  const [showCreateReport, setShowCreateReport] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('player_summary');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [reportGameId, setReportGameId] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [creating, setCreating] = useState(false);

  // Game-summary editor state
  const [showSummaryEditor, setShowSummaryEditor] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<GameSummary | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      const [reportsRes, summariesRes, playersRes, gamesResult] = await Promise.all([
        fetch(`/api/communication/reports?teamId=${teamId}`),
        fetch(`/api/communication/game-summaries?teamId=${teamId}`),
        fetch(`/api/communication/parents/roster?teamId=${teamId}`).catch(() => null),
        supabase
          .from('games')
          .select('id, name, opponent, date, team_score, opponent_score, game_result')
          .eq('team_id', teamId)
          .eq('game_type', 'team')
          .order('date', { ascending: false }),
      ]);

      if (reportsRes.ok) {
        const d = await reportsRes.json() as { reports?: SharedReport[] };
        setReports(d.reports ?? []);
      }

      if (summariesRes.ok) {
        const d = await summariesRes.json() as { summaries?: GameSummary[] };
        setSummaries(d.summaries ?? []);
      }

      if (playersRes?.ok) {
        const d = await playersRes.json() as unknown;
        const raw = Array.isArray(d) ? d : ((d as Record<string, unknown>).roster ?? (d as Record<string, unknown>).players ?? []) as unknown[];
        const normalized: RosterPlayer[] = (raw as Array<Record<string, unknown>>)
          .map(p => ({
            id: (p.id ?? p.player_id) as string,
            name: typeof p.name === 'string'
              ? p.name
              : `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
            jersey_number: (p.jersey_number as number | null) ?? null,
          }))
          .filter(p => Boolean(p.id));
        setPlayers(normalized);
      }

      if (!gamesResult.error && gamesResult.data) {
        const normalized: GameOption[] = (gamesResult.data as Array<{
          id: string;
          name: string;
          opponent: string | null;
          date: string | null;
          team_score: number | null;
          opponent_score: number | null;
          game_result: string | null;
        }>).map(g => ({
          id: g.id,
          name: g.name,
          opponent: g.opponent,
          date: g.date,
          team_score: g.team_score,
          opponent_score: g.opponent_score,
          game_result: g.game_result,
        }));
        setGames(normalized);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Report actions
  // ---------------------------------------------------------------------------

  async function handleCreateReport() {
    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/communication/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          reportType,
          playerId: selectedPlayerId || undefined,
          gameId: reportGameId || undefined,
          coachNotes: coachNotes.trim() || undefined,
          notificationChannel: channel,
          visibility: 'parents',
        }),
      });

      if (!response.ok) {
        const d = await response.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to create report');
      }

      setShowCreateReport(false);
      setCoachNotes('');
      setSelectedPlayerId('');
      setReportGameId('');
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Game summary actions
  // ---------------------------------------------------------------------------

  async function handleNewSummary() {
    try {
      setError(null);
      const response = await fetch('/api/communication/game-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, notificationChannel: 'email' }),
      });

      if (!response.ok) throw new Error('Failed to create summary');

      const { summary } = await response.json() as { summary: GameSummary };
      setEditingSummaryId(summary.id);
      setEditingSummary(summary);
      setShowSummaryEditor(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create summary');
    }
  }

  async function handleSaveSummary(data: GameSummaryFormData): Promise<string | void> {
    // If we don't yet have an ID, create first then update
    if (!editingSummaryId) {
      const createRes = await fetch('/api/communication/game-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          notificationChannel: data.notificationChannel,
          gameId: data.gameId,
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create summary');
      const { summary } = await createRes.json() as { summary: GameSummary };
      setEditingSummaryId(summary.id);
      // Fall through to patch with the full form data
      const patchRes = await fetch(`/api/communication/game-summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!patchRes.ok) throw new Error('Failed to save summary');
      return summary.id;
    }

    const response = await fetch(`/api/communication/game-summaries/${editingSummaryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to save summary');
  }

  async function handlePublishSummary(summaryId: string) {
    const response = await fetch(`/api/communication/game-summaries/${summaryId}/publish`, {
      method: 'POST',
    });
    if (!response.ok) {
      const d = await response.json() as { error?: string };
      throw new Error(d.error ?? 'Failed to publish summary');
    }
    closeSummaryEditor();
    void fetchData();
  }

  function handleEditSummary(summary: GameSummary) {
    setEditingSummaryId(summary.id);
    setEditingSummary(summary);
    setShowSummaryEditor(true);
  }

  function closeSummaryEditor() {
    setShowSummaryEditor(false);
    setEditingSummaryId(null);
    setEditingSummary(null);
  }

  async function handleDeleteSummary(summaryId: string) {
    if (!confirm('Delete this game summary? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/communication/game-summaries/${summaryId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete summary');
    }
  }

  async function handleDeleteReport(reportId: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/communication/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  }

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------

  const requiresPlayer = reportType !== 'game_recap';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/football/teams/${teamId}/communication/announcements`}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to announcements"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports &amp; Recaps</h1>
              <p className="text-gray-600 mt-1">Share player reports and game summaries with parents</p>
            </div>
          </div>
        </div>

        {/* Tab bar + action button */}
        <div className="flex items-center gap-4 mb-6">
          <div className="inline-flex p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setViewMode('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'reports' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Player Reports
            </button>
            <button
              onClick={() => setViewMode('summaries')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'summaries' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Newspaper className="w-4 h-4" />
              Game Summaries
            </button>
          </div>

          <div className="flex-1" />

          {viewMode === 'reports' ? (
            <button
              onClick={() => setShowCreateReport(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Report
            </button>
          ) : (
            <button
              onClick={() => void handleNewSummary()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Game Summary
            </button>
          )}
        </div>

        {/* Global error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Create Report inline form                                           */}
        {/* ------------------------------------------------------------------ */}
        {showCreateReport && viewMode === 'reports' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Report</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <select
                  value={reportType}
                  onChange={e => {
                    setReportType(e.target.value as ReportType);
                    setSelectedPlayerId('');
                    setReportGameId('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="player_summary">Player Summary Card</option>
                  <option value="season_progress">Season Progress</option>
                  <option value="individual">Individual Player Report</option>
                  <option value="game_recap">Game Recap</option>
                </select>
              </div>

              {/* Game selector — only shown for game_recap type */}
              {!requiresPlayer && games.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game{' '}
                    <span className="text-gray-400 font-normal">(optional — links AI stats)</span>
                  </label>
                  <select
                    value={reportGameId}
                    onChange={e => setReportGameId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">— No specific game —</option>
                    {games.map(game => {
                      const label = game.opponent ? `vs ${game.opponent}` : game.name;
                      const date = game.date
                        ? new Date(game.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })
                        : '';
                      return (
                        <option key={game.id} value={game.id}>
                          {date ? `${label} — ${date}` : label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {requiresPlayer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Player</label>
                  <select
                    value={selectedPlayerId}
                    onChange={e => setSelectedPlayerId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Select a player...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.jersey_number} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coach Notes{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={coachNotes}
                  onChange={e => setCoachNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Add personal observations..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notify Via</label>
                <NotificationChannelPicker value={channel} onChange={setChannel} showLabel={false} />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateReport(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateReport()}
                  disabled={creating || (requiresPlayer && !selectedPlayerId)}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Share Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Game Summary Editor                                                 */}
        {/* ------------------------------------------------------------------ */}
        {showSummaryEditor && viewMode === 'summaries' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSummary?.status === 'published' ? 'View Game Summary' : 'Game Summary Editor'}
            </h2>
            <GameSummaryEditor
              teamId={teamId}
              summaryId={editingSummaryId}
              initialData={
                editingSummary
                  ? {
                      coachRawNotes: editingSummary.coach_raw_notes ?? '',
                      aiDraft: editingSummary.ai_draft ?? '',
                      publishedText: editingSummary.published_text ?? '',
                      opponent: editingSummary.opponent ?? '',
                      scoreUs: editingSummary.score_us,
                      scoreThem: editingSummary.score_them,
                      gameDate: editingSummary.game_date ?? '',
                      playerHighlights: editingSummary.player_highlights ?? [],
                      notificationChannel: (editingSummary.notification_channel ?? 'email') as NotificationChannel,
                    }
                  : undefined
              }
              games={games}
              players={players}
              onSave={handleSaveSummary}
              onPublish={handlePublishSummary}
              onCancel={closeSummaryEditor}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Content lists                                                       */}
        {/* ------------------------------------------------------------------ */}
        {viewMode === 'reports' ? (
          reports.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
              <p className="text-gray-600">Create your first player report to share with parents.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(report => {
                const player = players.find(p => p.id === report.player_id);
                return (
                  <div key={report.id} className="relative group">
                    <ReportCard
                      report={report}
                      playerName={player?.name}
                      isCoachView
                    />
                    <button
                      onClick={() => void handleDeleteReport(report.id)}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 bg-white rounded-lg shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : summaries.length === 0 && !showSummaryEditor ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Game Summaries Yet</h3>
            <p className="text-gray-600">Create a game summary to share a recap with parents.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map(summary => (
              <div
                key={summary.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEditSummary(summary)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">
                      vs {summary.opponent ?? 'Unknown'}
                      {summary.score_us !== null && summary.score_them !== null && (
                        <span className="ml-2 text-gray-500 font-normal">
                          ({summary.score_us}–{summary.score_them})
                        </span>
                      )}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        summary.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {summary.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {summary.game_date
                        ? new Date(summary.game_date.length === 10 ? `${summary.game_date}T12:00:00` : summary.game_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDeleteSummary(summary.id); }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete summary"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {summary.published_text && (
                  <p className="text-sm text-gray-600 line-clamp-2">{summary.published_text}</p>
                )}
                {!summary.published_text && summary.coach_raw_notes && (
                  <p className="text-sm text-gray-500 italic line-clamp-2">{summary.coach_raw_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
