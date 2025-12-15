'use client';

import { useState } from 'react';
import { AlertTriangle, X, Check, Edit3, RefreshCw } from 'lucide-react';
import { gameScoreService, ScoreMismatchResult } from '@/lib/services/game-score.service';

interface ScoreMismatchWarningProps {
  gameId: string;
  mismatchResult: ScoreMismatchResult;
  onResolve?: (action: 'use_calculated' | 'use_manual' | 'review') => void;
  onDismiss?: () => void;
  context?: 'film_tagging' | 'schedule' | 'film_upload';
}

export function ScoreMismatchWarning({
  gameId,
  mismatchResult,
  onResolve,
  onDismiss,
  context = 'film_tagging'
}: ScoreMismatchWarningProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !mismatchResult.has_mismatch || mismatchResult.mismatch_acknowledged) {
    return null;
  }

  const handleUseCalculated = async () => {
    try {
      setIsResolving(true);
      await gameScoreService.setScoreSource(gameId, 'calculated');
      onResolve?.('use_calculated');
    } catch (error) {
      console.error('Error setting score source:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleUseManual = async () => {
    try {
      setIsResolving(true);
      await gameScoreService.setScoreSource(gameId, 'manual');
      onResolve?.('use_manual');
    } catch (error) {
      console.error('Error setting score source:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await gameScoreService.acknowledgeMismatch(gameId);
      setIsDismissed(true);
      onDismiss?.();
    } catch (error) {
      console.error('Error dismissing mismatch:', error);
    }
  };

  const getContextMessage = () => {
    switch (context) {
      case 'film_tagging':
        return 'The score calculated from your tagged plays differs from the manually entered score.';
      case 'schedule':
        return 'Film tagging shows a different score than what you entered.';
      case 'film_upload':
        return 'The calculated score from film tagging differs from the game score.';
      default:
        return 'Score mismatch detected.';
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-amber-900">
              Score Mismatch
            </h4>
            <button
              onClick={handleDismiss}
              className="text-amber-600 hover:text-amber-800 p-1"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-amber-800 mt-1">
            {getContextMessage()}
          </p>

          {/* Score comparison */}
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded p-3 border border-amber-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                From Film Tagging
              </p>
              <p className="text-lg font-bold text-gray-900">
                {mismatchResult.calculated_team_total ?? 0} - {mismatchResult.calculated_opponent_total ?? 0}
              </p>
            </div>
            <div className="bg-white rounded p-3 border border-amber-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Manual Entry
              </p>
              <p className="text-lg font-bold text-gray-900">
                {mismatchResult.manual_team_total ?? 0} - {mismatchResult.manual_opponent_total ?? 0}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleUseCalculated}
              disabled={isResolving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Use Film Score
            </button>
            <button
              onClick={handleUseManual}
              disabled={isResolving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Keep Manual Score
            </button>
            {context === 'schedule' || context === 'film_upload' ? (
              <button
                onClick={() => onResolve?.('review')}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Review Tagging
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
