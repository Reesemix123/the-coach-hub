'use client';

import React, { memo } from 'react';
import type { FilmAnalysisStatus, GameScoreBreakdown } from '@/types/football';
import type { ScoreMismatchResult } from '@/lib/services/game-score.service';
import { ResumeTaggingButton } from '@/components/film/ResumeTaggingButton';
import { ScoreMismatchWarning } from '@/components/film/ScoreMismatchWarning';
import StorageUsageCard from '@/components/StorageUsageCard';

// ============================================
// TYPES
// ============================================

interface StatusBarProps {
  gameId: string;
  teamId: string;
  currentVideoId?: string;
  currentPositionMs: number;
  onResume: (videoId: string, positionMs: number) => void;
  scoreMismatch: ScoreMismatchResult | null;
  onScoreMismatchResolve: (action: 'use_calculated' | 'use_manual' | 'review') => void;
  onDismissScoreMismatch: () => void;
  quarterScores: GameScoreBreakdown | null;
  playsTaggedCount: number;
  filmAnalysisStatus: FilmAnalysisStatus;
  onOpenCompleteModal: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const StatusBar = memo(function StatusBar({
  gameId,
  teamId,
  currentVideoId,
  currentPositionMs,
  onResume,
  scoreMismatch,
  onScoreMismatchResolve,
  onDismissScoreMismatch,
  quarterScores,
  playsTaggedCount,
  filmAnalysisStatus,
  onOpenCompleteModal,
}: StatusBarProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* Resume Button */}
      <ResumeTaggingButton
        gameId={gameId}
        currentVideoId={currentVideoId}
        currentPositionMs={currentPositionMs}
        onResume={onResume}
      />

      {/* Score Mismatch Warning */}
      {scoreMismatch && scoreMismatch.has_mismatch && !scoreMismatch.mismatch_acknowledged && (
        <ScoreMismatchWarning
          gameId={gameId}
          mismatchResult={scoreMismatch}
          onResolve={onScoreMismatchResolve}
          onDismiss={onDismissScoreMismatch}
          context="film_tagging"
        />
      )}

      {/* Compact Score & Analysis Status Bar */}
      <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Score Summary */}
        <div className="flex items-center gap-4">
          {(() => {
            const teamScore = quarterScores?.calculated?.team?.total ?? quarterScores?.manual?.team?.total;
            const oppScore = quarterScores?.calculated?.opponent?.total ?? quarterScores?.manual?.opponent?.total;
            const hasScore = teamScore !== undefined && teamScore !== null;

            return hasScore ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Score:</span>
                <span className="font-semibold text-gray-900">{teamScore}</span>
                <span className="text-gray-400">-</span>
                <span className="font-semibold text-gray-900">{oppScore ?? 0}</span>
                {quarterScores?.source === 'manual' && (
                  <span className="text-xs text-gray-500">(manual)</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500">No score yet</span>
            );
          })()}
          <div className="h-4 w-px bg-gray-300" />
          <span className="text-sm text-gray-600">{playsTaggedCount} {playsTaggedCount === 1 ? 'play' : 'plays'} tagged</span>
          <div className="h-4 w-px bg-gray-300" />
          {/* Storage Usage Indicator */}
          <div className="w-48">
            <StorageUsageCard teamId={teamId} compact />
          </div>
        </div>

        {/* Film Tagging Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              filmAnalysisStatus === 'complete' ? 'bg-green-500' :
              filmAnalysisStatus === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-300'
            }`} />
            <span className="text-sm text-gray-700">
              {filmAnalysisStatus === 'complete' ? 'Tagging Complete' :
               filmAnalysisStatus === 'in_progress' ? 'Tagging In Progress' : 'Not Started'}
            </span>
          </div>
          <button
            onClick={onOpenCompleteModal}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filmAnalysisStatus === 'complete'
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {filmAnalysisStatus === 'complete' ? 'Tagging Complete ✓' : 'Mark Tagging Complete'}
          </button>
        </div>
      </div>
    </div>
  );
});
