'use client';

import { Eye, EyeOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreboardOverlayProps {
  /** Home team name (from game record) */
  teamName: string;
  /** Opponent name (from game record) */
  opponentName: string;
  /** Running team score at this play — null shows dash */
  teamScore: number | null;
  /** Running opponent score at this play — null shows dash */
  opponentScore: number | null;
  /** Quarter (1-5, where 5 = OT) — null shows dash */
  quarter: number | null;
  /** Game clock in MM:SS format — null shows dash */
  clock: string | null;
  /** Down (1-4) — null hides down & distance line */
  down: number | null;
  /** Distance to first down — null hides down & distance line */
  distance: number | null;
  /** Yard line (0-100) — null hides yard line */
  yardLine: number | null;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Show toggle button — true for coaches, false for parents */
  showToggle?: boolean;
  /** Callback when toggle is clicked */
  onToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format quarter number for display */
function formatQuarter(q: number | null): string {
  if (q == null) return '—';
  if (q === 5) return 'OT';
  return `Q${q}`;
}

/** Format a score value with dash fallback */
function formatScore(s: number | null): string {
  return s != null ? String(s) : '—';
}

/** Format down with ordinal suffix */
function formatDown(down: number | null, distance: number | null): string | null {
  if (down == null || distance == null) return null;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = suffixes[down] ?? 'th';
  return `${down}${suffix} & ${distance}`;
}

/** Format yard line for display */
function formatYardLine(yl: number | null): string | null {
  if (yl == null) return null;
  if (yl === 50) return 'at 50';
  if (yl > 50) return `at OPP ${100 - yl}`;
  return `at OWN ${yl}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Scoreboard overlay for the film room and parent clip player.
 *
 * Renders game context (quarter, clock, score, down & distance) as an
 * HTML/CSS layer positioned over the video player. The video file is
 * never modified — this is purely a UI overlay.
 *
 * Design: Apple-like minimal aesthetic. Semi-transparent dark background,
 * white text, lime-green #B8CA6E accent for the team score.
 */
export function ScoreboardOverlay({
  teamName,
  opponentName,
  teamScore,
  opponentScore,
  quarter,
  clock,
  down,
  distance,
  yardLine,
  visible,
  showToggle = false,
  onToggle,
}: ScoreboardOverlayProps) {
  const downText = formatDown(down, distance);
  const yardText = formatYardLine(yardLine);
  const situationText = [downText, yardText].filter(Boolean).join(' ');

  return (
    <>
      {/* Toggle button — always visible when showToggle is true */}
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          aria-label={visible ? 'Hide scoreboard' : 'Show scoreboard'}
          title={visible ? 'Hide scoreboard' : 'Show scoreboard'}
        >
          {visible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Overlay content */}
      {visible && (
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none select-none">
          <div className="mx-auto max-w-md px-3 pt-2">
            <div className="bg-black/75 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
              {/* Top row: Quarter/Clock + Scores */}
              <div className="flex items-center justify-between">
                {/* Quarter & Clock */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                    {formatQuarter(quarter)}
                  </span>
                  <span className="text-[11px] font-mono text-white/80">
                    {clock ?? '—'}
                  </span>
                </div>

                {/* Scores */}
                <div className="flex items-center gap-3">
                  {/* Team */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide max-w-[80px] truncate">
                      {teamName}
                    </span>
                    <span className="text-sm font-bold text-[#B8CA6E] tabular-nums min-w-[18px] text-right">
                      {formatScore(teamScore)}
                    </span>
                  </div>

                  {/* Divider */}
                  <span className="text-[10px] text-white/30">|</span>

                  {/* Opponent */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white/90 tabular-nums min-w-[18px]">
                      {formatScore(opponentScore)}
                    </span>
                    <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide max-w-[80px] truncate">
                      {opponentName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom row: Down & Distance + Yard Line */}
              {situationText && (
                <div className="mt-0.5 text-center">
                  <span className="text-[10px] font-medium text-white/60 tracking-wide">
                    {situationText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
