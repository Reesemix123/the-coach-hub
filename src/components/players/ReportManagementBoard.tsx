'use client';

import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ReportData {
  id: string;
  athleteProfileId: string;
  seasonId: string;
  gameId: string | null;
  opponent: string;
  gameDate: string | null;
  reportType: string;
  statsSnapshot: Record<string, unknown> | null;
  aiNarrativeCoach: string | null;
  aiNarrativeParent: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  coachEdited: boolean;
  createdAt: string;
  playerFirstName: string;
  playerLastName: string;
  jerseyNumber: string | null;
  position: string | null;
}

export interface GameOption {
  id: string;
  opponent: string;
  date: string | null;
}

export interface PlayerOption {
  id: string;
  name: string;
  jerseyNumber: string | null;
}

interface ReportManagementBoardProps {
  reports: ReportData[];
  games: GameOption[];
  players: PlayerOption[];
}

// ============================================================================
// Helpers
// ============================================================================

function gradeColor(grade: number): string {
  if (grade >= 7) return 'bg-green-100 text-green-800';
  if (grade >= 5) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================================
// StatsGrid
// ============================================================================

function StatsGrid({ statsSnapshot }: { statsSnapshot: Record<string, unknown> | null }) {
  if (!statsSnapshot) return <p className="text-sm text-gray-400">No stats available</p>;

  const unit = statsSnapshot.unit as string | undefined;
  const items: { label: string; value: string }[] = [];

  const snaps = statsSnapshot.snaps_played as number | undefined;
  if (snaps != null) items.push({ label: 'Snaps', value: String(snaps) });

  const posGrade = statsSnapshot.position_grade as number | undefined;
  if (posGrade != null) items.push({ label: 'Position Grade', value: posGrade.toFixed(1) });

  const effGrade = statsSnapshot.effort_grade as number | undefined;
  if (effGrade != null) items.push({ label: 'Effort Grade', value: effGrade.toFixed(1) });

  const growth = statsSnapshot.growth_area as string | undefined;

  if (unit === 'offense') {
    const bc = statsSnapshot.as_ball_carrier as { carries?: number; yards?: number; touchdowns?: number } | undefined;
    if (bc?.carries) items.push({ label: 'Carries', value: `${bc.carries} for ${bc.yards ?? 0} yds` });
    const rec = statsSnapshot.as_receiver as { receptions?: number; targets?: number; yards?: number } | undefined;
    if (rec?.targets) items.push({ label: 'Receiving', value: `${rec.receptions ?? 0}/${rec.targets} for ${rec.yards ?? 0} yds` });
    const pass = statsSnapshot.as_passer as { completions?: number; attempts?: number; yards?: number; touchdowns?: number } | undefined;
    if (pass?.attempts) items.push({ label: 'Passing', value: `${pass.completions ?? 0}/${pass.attempts} for ${pass.yards ?? 0} yds` });
  } else if (unit === 'offense_oline') {
    const br = statsSnapshot.block_results as { held?: number; beaten?: number } | undefined;
    if (br) {
      const total = (br.held ?? 0) + (br.beaten ?? 0);
      items.push({ label: 'Block Grade', value: total > 0 ? `${(((br.held ?? 0) / total) * 100).toFixed(0)}%` : 'N/A' });
    }
    const pressures = statsSnapshot.pressures_allowed as number | undefined;
    if (pressures != null) items.push({ label: 'Pressures Allowed', value: String(pressures) });
  } else if (unit === 'defense') {
    const t = statsSnapshot.tackles as { primary?: number; assist?: number; for_loss?: number } | undefined;
    if (t) items.push({ label: 'Tackles', value: `${(t.primary ?? 0) + (t.assist ?? 0)} (${t.for_loss ?? 0} TFL)` });
    const pr = statsSnapshot.pass_rush as { pressures?: number; sacks?: number } | undefined;
    if (pr?.pressures) items.push({ label: 'Pass Rush', value: `${pr.pressures} pres, ${pr.sacks ?? 0} sacks` });
    const turnovers = statsSnapshot.turnovers_created as number | undefined;
    if (turnovers) items.push({ label: 'Turnovers', value: String(turnovers) });
  } else if (unit === 'special_teams') {
    const k = statsSnapshot.as_kicker as { made?: number; attempts?: number } | undefined;
    if (k) items.push({ label: 'FG', value: `${k.made ?? 0}/${k.attempts ?? 0}` });
    const r = statsSnapshot.as_returner as { returns?: number; total_yards?: number; average?: number } | undefined;
    if (r) items.push({ label: 'Returns', value: `${r.returns ?? 0} for ${r.total_yards ?? 0} yds (${(r.average ?? 0).toFixed(1)} avg)` });
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.slice(0, 6).map((item) => (
          <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[11px] text-gray-400 uppercase">{item.label}</p>
            <p className="text-sm font-semibold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>
      {growth && (
        <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2">
          <p className="text-[11px] text-amber-600 uppercase">Growth Area</p>
          <p className="text-sm text-amber-900">{growth}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ReportCard
// ============================================================================

interface ReportCardProps {
  report: ReportData;
  isExpanded: boolean;
  editNarrative: string;
  saving: boolean;
  onToggleExpand: (id: string) => void;
  onEditNarrativeChange: (value: string) => void;
  onSave: (id: string) => Promise<void>;
  onPublish: (id: string) => Promise<void>;
  onUnpublish: (id: string) => Promise<void>;
}

function ReportCard({
  report,
  isExpanded,
  editNarrative,
  saving,
  onToggleExpand,
  onEditNarrativeChange,
  onSave,
  onPublish,
  onUnpublish,
}: ReportCardProps) {
  const positionGrade = report.statsSnapshot?.position_grade as number | null | undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Collapsed row — always visible */}
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Player avatar + info */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">
            {report.jerseyNumber ? `#${report.jerseyNumber}` : '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {report.playerFirstName} {report.playerLastName}
            </p>
            <p className="text-xs text-gray-500">{report.position ?? 'No position'}</p>
          </div>
        </div>

        {/* Game info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 truncate">vs {report.opponent}</p>
          <p className="text-xs text-gray-400">{formatDate(report.gameDate)}</p>
        </div>

        {/* Grade pill */}
        {positionGrade != null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${gradeColor(positionGrade)}`}>
            {positionGrade.toFixed(1)}
          </span>
        )}

        {/* Published/draft badge */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
            report.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {report.isPublished ? 'Published' : 'Draft'}
        </span>

        {/* Action buttons */}
        <button
          onClick={() => onToggleExpand(report.id)}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1 border border-gray-300 rounded-lg flex-shrink-0"
        >
          {isExpanded ? 'Close' : 'Edit & Publish'}
        </button>

        {report.isPublished && !isExpanded && (
          <button
            onClick={() => onUnpublish(report.id)}
            disabled={saving}
            className="text-sm font-medium text-red-600 hover:text-red-800 flex-shrink-0 disabled:opacity-50"
          >
            Unpublish
          </button>
        )}
      </div>

      {/* Expanded edit panel */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Coach narrative — read-only */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              AI Generated · Coach View Only
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {report.aiNarrativeCoach ?? 'No coach narrative generated.'}
            </div>
          </div>

          {/* Parent narrative — editable */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              What parents will see
            </p>
            <textarea
              value={editNarrative}
              onChange={(e) => onEditNarrativeChange(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
              placeholder="Edit the parent-facing narrative..."
            />
            <p className="text-xs text-gray-400 mt-1">Keep it encouraging and specific</p>
          </div>

          {/* Stats summary */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              Performance Summary
            </p>
            <StatsGrid statsSnapshot={report.statsSnapshot} />
          </div>

          {/* Action row */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onSave(report.id)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              onClick={() => onPublish(report.id)}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 disabled:opacity-50"
            >
              Publish to parents
            </button>
            {report.isPublished && (
              <button
                onClick={() => onUnpublish(report.id)}
                disabled={saving}
                className="ml-auto text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Unpublish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ReportManagementBoard (main export)
// ============================================================================

export function ReportManagementBoard({ reports, games, players }: ReportManagementBoardProps) {
  const [reportMap, setReportMap] = useState<Map<string, ReportData>>(() => {
    const map = new Map<string, ReportData>();
    for (const r of reports) map.set(r.id, r);
    return map;
  });

  const [gameFilter, setGameFilter] = useState<string>('all');
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [editNarrative, setEditNarrative] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredReports = useMemo(() => {
    let result = Array.from(reportMap.values());
    if (gameFilter !== 'all') result = result.filter((r) => r.gameId === gameFilter);
    if (playerFilter !== 'all') result = result.filter((r) => r.athleteProfileId === playerFilter);
    return result;
  }, [reportMap, gameFilter, playerFilter]);

  function toggleExpand(reportId: string) {
    if (expandedReportId === reportId) {
      setExpandedReportId(null);
    } else {
      setExpandedReportId(reportId);
      const report = reportMap.get(reportId);
      setEditNarrative(report?.aiNarrativeParent ?? '');
    }
  }

  async function handleSave(reportId: string) {
    setSaving(true);
    const res = await fetch(`/api/player-profiles/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_narrative_parent: editNarrative, action: 'save' }),
    });
    if (res.ok) {
      setReportMap((prev) => {
        const next = new Map(prev);
        const r = next.get(reportId);
        if (r) next.set(reportId, { ...r, aiNarrativeParent: editNarrative, coachEdited: true });
        return next;
      });
    }
    setSaving(false);
  }

  async function handlePublish(reportId: string) {
    setSaving(true);
    const res = await fetch(`/api/player-profiles/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_narrative_parent: editNarrative, action: 'publish' }),
    });
    if (res.ok) {
      setReportMap((prev) => {
        const next = new Map(prev);
        const r = next.get(reportId);
        if (r)
          next.set(reportId, {
            ...r,
            aiNarrativeParent: editNarrative,
            isPublished: true,
            publishedAt: new Date().toISOString(),
            coachEdited: true,
          });
        return next;
      });
      setExpandedReportId(null);
    }
    setSaving(false);
  }

  async function handleUnpublish(reportId: string) {
    setSaving(true);
    const res = await fetch(`/api/player-profiles/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    });
    if (res.ok) {
      setReportMap((prev) => {
        const next = new Map(prev);
        const r = next.get(reportId);
        if (r) next.set(reportId, { ...r, isPublished: false, publishedAt: null });
        return next;
      });
    }
    setSaving(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Player Reports</h2>

      {/* Filter bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">All Games</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              vs {g.opponent}{g.date ? ` — ${formatDate(g.date)}` : ''}
            </option>
          ))}
        </select>
        <select
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">All Players</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.jerseyNumber ? `#${p.jerseyNumber} ` : ''}
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Report list */}
      {filteredReports.length > 0 ? (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isExpanded={expandedReportId === report.id}
              editNarrative={expandedReportId === report.id ? editNarrative : ''}
              saving={saving}
              onToggleExpand={toggleExpand}
              onEditNarrativeChange={setEditNarrative}
              onSave={handleSave}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No reports yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Reports are generated automatically after film analysis.
          </p>
        </div>
      )}
    </div>
  );
}
