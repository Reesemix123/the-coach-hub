'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';

interface ReportCardProps {
  opponent: string;
  gameDate: string | null;
  positionGrade: number | null;
  parentNarrative: string | null;
  locked: boolean;
}

function gradeColor(grade: number | null): string {
  if (grade == null) return 'bg-gray-100 text-gray-500';
  if (grade >= 7) return 'bg-green-100 text-green-800';
  if (grade >= 5) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReportCard({
  opponent,
  gameDate,
  positionGrade,
  parentNarrative,
  locked,
}: ReportCardProps) {
  const [expanded, setExpanded] = useState(false);

  const excerpt =
    parentNarrative && parentNarrative.length > 140
      ? parentNarrative.slice(0, 140).trimEnd() + '…'
      : parentNarrative;

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        onClick={() => !locked && setExpanded(!expanded)}
        disabled={locked}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        {/* Left: game info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a1a1a] truncate">
            vs {opponent}
          </p>
          {gameDate && (
            <p className="text-xs text-[#6b7280] mt-0.5">{formatDate(gameDate)}</p>
          )}
        </div>

        {/* Grade pill */}
        {positionGrade != null && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gradeColor(positionGrade)}`}
          >
            {positionGrade.toFixed(1)}
          </span>
        )}

        {/* Expand/lock icon */}
        {locked ? (
          <Lock className="w-4 h-4 text-[#6b7280] flex-shrink-0" />
        ) : expanded ? (
          <ChevronUp className="w-4 h-4 text-[#6b7280] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6b7280] flex-shrink-0" />
        )}
      </button>

      {/* Locked overlay */}
      {locked && (
        <div className="px-4 pb-3">
          <div className="bg-[rgba(0,0,0,0.04)] rounded-lg p-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#6b7280]" />
            <p className="text-xs text-[#6b7280]">
              Your coach hasn&apos;t shared this report yet
            </p>
          </div>
        </div>
      )}

      {/* Collapsed excerpt */}
      {!locked && !expanded && excerpt && (
        <div className="px-4 pb-3">
          <p className="text-sm text-[#6b7280] leading-relaxed">{excerpt}</p>
        </div>
      )}

      {/* Expanded full narrative */}
      {!locked && expanded && parentNarrative && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
            {parentNarrative}
          </p>
        </div>
      )}
    </div>
  );
}
