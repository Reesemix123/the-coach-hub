'use client';

import React, { memo } from 'react';
import { User, Clock, Eye } from 'lucide-react';
import type { ReportType } from '@/types/communication';

interface ReportCardProps {
  report: {
    id: string;
    report_type: ReportType;
    player_id: string | null;
    coach_notes: string | null;
    report_data: Record<string, unknown>;
    visibility: string;
    shared_at: string;
    viewed_at?: string | null;
  };
  playerName?: string;
  isCoachView?: boolean;
  onClick?: () => void;
}

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; color: string; bgColor: string }> = {
  player_summary: { label: 'Player Summary', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  game_recap: { label: 'Game Recap', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  season_progress: { label: 'Season Progress', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  individual: { label: 'Individual Report', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
};

export const ReportCard = memo(function ReportCard({
  report,
  playerName,
  isCoachView = false,
  onClick,
}: ReportCardProps) {
  const typeConfig = REPORT_TYPE_CONFIG[report.report_type] ?? REPORT_TYPE_CONFIG.individual;
  const reportData = report.report_data as Record<string, unknown>;
  const highlights = Array.isArray(reportData.highlights) ? reportData.highlights as string[] : [];
  const opponent = typeof reportData.opponent === 'string' ? reportData.opponent : null;
  const teamEffortSummary = typeof reportData.teamEffortSummary === 'string' ? reportData.teamEffortSummary : null;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${typeConfig.bgColor} ${typeConfig.color}`}
          >
            {typeConfig.label}
          </span>
          {report.visibility === 'specific_parent' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <User className="w-3 h-3" />
              Individual
            </span>
          )}
        </div>

        {/* Unread indicator — parent view only */}
        {!isCoachView && report.viewed_at === null && (
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-1">
        {playerName
          ? `${playerName}'s ${typeConfig.label}`
          : opponent
            ? `vs ${opponent}`
            : typeConfig.label}
      </h3>

      {/* Content preview */}
      {highlights.length > 0 && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{highlights[0]}</p>
      )}

      {!highlights.length && teamEffortSummary && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{teamEffortSummary}</p>
      )}

      {report.coach_notes && (
        <p className="text-sm text-gray-500 italic line-clamp-1 mb-3">
          Coach: &quot;{report.coach_notes}&quot;
        </p>
      )}

      {/* Footer metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTimestamp(report.shared_at)}
        </div>
        {isCoachView && (
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {report.visibility === 'parents' ? 'All parents' : 'Specific parent'}
          </div>
        )}
      </div>
    </div>
  );
});

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
