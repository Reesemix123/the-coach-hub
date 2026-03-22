'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, Plus, X, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { NotificationChannelPicker } from '@/components/communication/shared/NotificationChannelPicker';
import type { NotificationChannel, PlayerHighlight } from '@/types/communication';

export interface GameOption {
  id: string;
  name: string;
  opponent: string | null;
  date: string | null;
  team_score: number | null;
  opponent_score: number | null;
  game_result: string | null;
}

interface GameSummaryEditorProps {
  teamId: string;
  summaryId: string | null;
  initialData?: {
    coachRawNotes: string;
    aiDraft: string;
    publishedText: string;
    opponent: string;
    scoreUs: number | null;
    scoreThem: number | null;
    gameDate: string;
    playerHighlights: PlayerHighlight[];
    notificationChannel: NotificationChannel;
  };
  games: GameOption[];
  players: Array<{ id: string; name: string; jersey_number: number | null }>;
  onSave: (data: GameSummaryFormData) => Promise<string | void>;
  onPublish: (summaryId: string) => Promise<void>;
  onCancel: () => void;
}

export interface GameSummaryFormData {
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

/**
 * Formats a game option for display in the dropdown.
 * Shows "vs {opponent} — {date}" or "{name} — {date}" if no opponent.
 */
function formatGameOption(game: GameOption): string {
  const label = game.opponent ? `vs ${game.opponent}` : game.name;
  const date = game.date
    ? new Date(game.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';
  return date ? `${label} — ${date}` : label;
}

// ============================================================================
// Game stats types (mirrors the API response shape)
// ============================================================================

interface GameStatsOverview {
  totalPlays: number;
  totalYards: number;
  yardsPerPlay: number;
  passingYards: number;
  rushingYards: number;
  passAttempts: number;
  passCompletions: number;
  completionPct: number;
  rushAttempts: number;
  touchdowns: number;
  turnovers: number;
  penalties: number;
  penaltyYards: number;
  firstDowns: number;
  thirdDownConversions: number;
  thirdDownAttempts: number;
}

interface TopPlayer {
  id: string;
  name: string;
  jerseyNumber: string;
  role: string;
  statLine: string;
}

interface GameStats {
  overview: GameStatsOverview | null;
  topPlayers: TopPlayer[];
}

// ============================================================================
// Role badge color map
// ============================================================================

const ROLE_BADGE_CLASSES: Record<string, string> = {
  Passing: 'bg-blue-100 text-blue-700',
  Rushing: 'bg-green-100 text-green-700',
  Receiving: 'bg-purple-100 text-purple-700',
  Defense: 'bg-orange-100 text-orange-700',
  Player: 'bg-gray-100 text-gray-600',
};

// ============================================================================
// GameStatsPanel — collapsible film data preview
// ============================================================================

interface GameStatsPanelProps {
  stats: GameStats;
  isCollapsed: boolean;
  onToggle: () => void;
}

function GameStatsPanel({ stats, isCollapsed, onToggle }: GameStatsPanelProps) {
  const { overview, topPlayers } = stats;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-100 transition-colors"
      >
        <span className="text-sm font-semibold text-blue-900">
          Film Analysis Preview
        </span>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
        )}
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4">
          {overview === null ? (
            <p className="text-xs text-blue-700">
              No film analysis data available for this game.
            </p>
          ) : (
            <>
              {/* Team overview grid */}
              <div>
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
                  Team Overview
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {/* Row 1 */}
                  <StatCell label="Total Plays" value={String(overview.totalPlays)} />
                  <StatCell label="Total Yards" value={String(overview.totalYards)} />
                  <StatCell label="Yds / Play" value={overview.yardsPerPlay.toFixed(1)} />

                  {/* Row 2 */}
                  <StatCell
                    label="Pass"
                    value={`${overview.passCompletions}/${overview.passAttempts} (${overview.completionPct.toFixed(0)}%)`}
                  />
                  <StatCell
                    label="Rush"
                    value={`${overview.rushAttempts} att, ${overview.rushingYards} yds`}
                  />
                  <StatCell label="TDs" value={String(overview.touchdowns)} />

                  {/* Row 3 */}
                  <StatCell label="Turnovers" value={String(overview.turnovers)} />
                  <StatCell
                    label="Penalties"
                    value={`${overview.penalties} (${overview.penaltyYards} yds)`}
                  />
                  <StatCell label="1st Downs" value={String(overview.firstDowns)} />

                  {/* Row 4 — 3rd down spans full width so the label fits */}
                  <div className="col-span-3">
                    <StatCell
                      label="3rd Down"
                      value={`${overview.thirdDownConversions}/${overview.thirdDownAttempts}`}
                    />
                  </div>
                </div>
              </div>

              {/* Top players list */}
              {topPlayers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
                    Top Players
                  </p>
                  <ul className="space-y-1.5">
                    {topPlayers.map(player => {
                      const badgeClass =
                        ROLE_BADGE_CLASSES[player.role] ?? ROLE_BADGE_CLASSES['Player'];
                      return (
                        <li key={player.id} className="flex items-start gap-2">
                          {player.jerseyNumber && (
                            <span className="text-xs font-bold text-blue-800 w-6 flex-shrink-0">
                              #{player.jerseyNumber}
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-900 whitespace-nowrap">
                            {player.name}
                          </span>
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${badgeClass}`}
                          >
                            {player.role}
                          </span>
                          <span className="text-xs text-gray-600">{player.statLine}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A single labeled stat cell for the overview grid.
 */
function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border border-blue-100 px-2 py-1.5">
      <p className="text-xs text-blue-600 leading-none mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900 leading-tight">{value}</p>
    </div>
  );
}

// ============================================================================
// GameSummaryEditor
// ============================================================================

export function GameSummaryEditor({
  teamId,
  summaryId,
  initialData,
  games,
  players,
  onSave,
  onPublish,
  onCancel,
}: GameSummaryEditorProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [opponent, setOpponent] = useState(initialData?.opponent ?? '');
  const [scoreUs, setScoreUs] = useState(initialData?.scoreUs?.toString() ?? '');
  const [scoreThem, setScoreThem] = useState(initialData?.scoreThem?.toString() ?? '');
  const [gameDate, setGameDate] = useState(initialData?.gameDate ?? '');
  const [coachNotes, setCoachNotes] = useState(initialData?.coachRawNotes ?? '');
  const [aiDraft, setAiDraft] = useState(initialData?.aiDraft ?? '');
  const [publishedText, setPublishedText] = useState(initialData?.publishedText ?? '');
  const [highlights, setHighlights] = useState<PlayerHighlight[]>(initialData?.playerHighlights ?? []);
  const [channel, setChannel] = useState<NotificationChannel>(initialData?.notificationChannel ?? 'email');

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newHighlightPlayerId, setNewHighlightPlayerId] = useState('');
  const [newHighlightText, setNewHighlightText] = useState('');

  // Game stats preview state
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);

  /**
   * Fetch film analysis stats whenever a game is selected.
   * Clears prior stats immediately so stale data is never shown.
   */
  const fetchGameStats = useCallback(
    async (gameId: string) => {
      setGameStats(null);
      setStatsLoading(true);

      try {
        const url =
          `/api/communication/game-stats?teamId=${encodeURIComponent(teamId)}&gameId=${encodeURIComponent(gameId)}`;
        const response = await fetch(url);

        if (!response.ok) {
          // Non-fatal — stats panel simply won't render
          setStatsLoading(false);
          return;
        }

        const data = await response.json() as GameStats;
        setGameStats(data);
        setStatsCollapsed(false);
      } catch {
        // Silently suppress — stats are a preview, not required
      } finally {
        setStatsLoading(false);
      }
    },
    [teamId]
  );

  useEffect(() => {
    if (!selectedGameId) {
      setGameStats(null);
      return;
    }
    void fetchGameStats(selectedGameId);
  }, [selectedGameId, fetchGameStats]);

  /**
   * When a game is selected from the dropdown, auto-fill the game detail
   * fields. Selecting the blank option (manual entry) clears the selection
   * but does NOT wipe the manually entered values.
   */
  function handleGameSelect(gameId: string) {
    setSelectedGameId(gameId);

    if (!gameId) return;

    const game = games.find(g => g.id === gameId);
    if (!game) return;

    if (game.opponent) setOpponent(game.opponent);
    if (game.date) setGameDate(game.date);
    if (game.team_score !== null) setScoreUs(game.team_score.toString());
    if (game.opponent_score !== null) setScoreThem(game.opponent_score.toString());
  }

  function buildFormData(): GameSummaryFormData {
    return {
      coachRawNotes: coachNotes,
      aiDraft,
      publishedText,
      opponent,
      scoreUs: scoreUs !== '' ? parseInt(scoreUs, 10) : null,
      scoreThem: scoreThem !== '' ? parseInt(scoreThem, 10) : null,
      gameDate,
      playerHighlights: highlights,
      notificationChannel: channel,
      gameId: selectedGameId || undefined,
    };
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      await onSave(buildFormData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true);
      setError(null);

      // Auto-save first — if no summaryId, onSave will create one and return the ID
      const returnedId = await onSave(buildFormData());
      const idToUse = returnedId || summaryId;

      if (!idToUse) {
        setError('Failed to save summary before generating');
        setGenerating(false);
        return;
      }

      const response = await fetch(`/api/communication/game-summaries/${idToUse}/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to generate draft');
      }

      const data = await response.json() as { aiDraft: string };
      setAiDraft(data.aiDraft);
      // Pre-populate the editable published text so coach only needs minor edits
      setPublishedText(data.aiDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!summaryId || !publishedText.trim()) {
      setError('A published summary text is required before publishing');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      await onSave(buildFormData());
      await onPublish(summaryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  function addHighlight() {
    if (!newHighlightPlayerId || !newHighlightText.trim()) return;
    setHighlights(prev => [
      ...prev,
      { player_id: newHighlightPlayerId, highlight_text: newHighlightText.trim() },
    ]);
    setNewHighlightPlayerId('');
    setNewHighlightText('');
  }

  function removeHighlight(index: number) {
    setHighlights(prev => prev.filter((_, i) => i !== index));
  }

  const wordCount = publishedText.trim() ? publishedText.split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      {/* Game selector — pulls data from existing film-tagged games */}
      {games.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Game{' '}
            <span className="text-gray-400 font-normal">(auto-fills details below)</span>
          </label>
          <select
            value={selectedGameId}
            onChange={e => handleGameSelect(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">— Enter manually —</option>
            {games.map(game => (
              <option key={game.id} value={game.id}>
                {formatGameOption(game)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Film analysis stats preview — shown when a game is selected */}
      {selectedGameId && (
        <>
          {statsLoading ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              <span className="text-sm text-blue-700">Loading film analysis data...</span>
            </div>
          ) : gameStats !== null ? (
            <GameStatsPanel
              stats={gameStats}
              isCollapsed={statsCollapsed}
              onToggle={() => setStatsCollapsed(prev => !prev)}
            />
          ) : null}
        </>
      )}

      {/* Game details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
          <input
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g., Lions"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Game Date</label>
          <input
            type="date"
            value={gameDate}
            onChange={e => setGameDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Our Score</label>
          <input
            type="number"
            value={scoreUs}
            onChange={e => setScoreUs(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0"
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Their Score</label>
          <input
            type="number"
            value={scoreThem}
            onChange={e => setScoreThem(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0"
            min={0}
          />
        </div>
      </div>

      {/* Coach raw notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Notes</label>
        <p className="text-xs text-gray-500 mb-2">
          Bullet points, observations, highlights — the AI will polish these into a parent-friendly summary.
        </p>
        <textarea
          value={coachNotes}
          onChange={e => setCoachNotes(e.target.value)}
          rows={5}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder={
            '- Great defensive effort in the first half\n' +
            '- Tommy had two big runs\n' +
            '- Need to work on pass protection\n' +
            '- Team showed resilience after early deficit'
          }
        />
      </div>

      {/* Generate AI draft */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium transition-all disabled:opacity-50"
      >
        {generating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        {generating ? 'Generating...' : 'Generate AI Draft'}
      </button>

      {/* AI draft — read-only reference */}
      {aiDraft && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI Draft</label>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
            {aiDraft}
          </div>
        </div>
      )}

      {/* Editable final summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Final Summary{' '}
          <span className="text-gray-400 font-normal">(edit the AI draft or write your own)</span>
        </label>
        <textarea
          value={publishedText}
          onChange={e => setPublishedText(e.target.value)}
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder="The final text that parents will see..."
        />
        {wordCount > 0 && (
          <p className="text-xs text-gray-400 mt-1">{wordCount} words</p>
        )}
      </div>

      {/* Player highlights */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Player Highlights</label>

        {highlights.length > 0 && (
          <ul className="space-y-2 mb-3">
            {highlights.map((h, i) => {
              const player = players.find(p => p.id === h.player_id);
              return (
                <li key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                    {player ? `#${player.jersey_number} ${player.name}` : 'Unknown player'}
                  </span>
                  <span className="text-sm text-gray-600 flex-1">{h.highlight_text}</span>
                  <button
                    type="button"
                    onClick={() => removeHighlight(i)}
                    className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    aria-label="Remove highlight"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-2">
          <select
            value={newHighlightPlayerId}
            onChange={e => setNewHighlightPlayerId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Select player</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>
                #{p.jersey_number} {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newHighlightText}
            onChange={e => setNewHighlightText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addHighlight();
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g., Two key defensive stops"
          />
          <button
            type="button"
            onClick={addHighlight}
            disabled={!newHighlightPlayerId || !newHighlightText.trim()}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            aria-label="Add highlight"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification channel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notify Parents Via</label>
        <NotificationChannelPicker value={channel} onChange={setChannel} showLabel={false} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || !publishedText.trim()}
          className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {publishing ? 'Publishing...' : 'Publish & Notify'}
        </button>
      </div>
    </div>
  );
}
