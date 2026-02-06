'use client';

import type { FilmAnalysisStatus } from '@/types/football';

// ============================================
// TYPES
// ============================================

interface TaggingCompleteModalProps {
  isOpen: boolean;
  filmAnalysisStatus: FilmAnalysisStatus;
  finalScoreInputs: { teamScore: string; opponentScore: string };
  onFinalScoreChange: (updater: (prev: { teamScore: string; opponentScore: string }) => { teamScore: string; opponentScore: string }) => void;
  playsTaggedCount: number;
  videosOnTimelineCount: number;
  opponentName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function TaggingCompleteModal({
  isOpen,
  filmAnalysisStatus,
  finalScoreInputs,
  onFinalScoreChange,
  playsTaggedCount,
  videosOnTimelineCount,
  opponentName,
  onClose,
  onConfirm,
}: TaggingCompleteModalProps) {
  if (!isOpen) return null;

  const isComplete = filmAnalysisStatus === 'complete';
  const isMissingScores = finalScoreInputs.teamScore === '' || finalScoreInputs.opponentScore === '';
  const isDisabled = !isComplete && isMissingScores;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          {isComplete ? 'Edit Film Tagging?' : 'Mark Film Tagging Complete?'}
        </h3>

        {!isComplete && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> By marking film tagging complete, you are confirming this game is ready for analytics.
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Current Status:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• {playsTaggedCount} plays tagged</li>
            <li>• {videosOnTimelineCount} video{videosOnTimelineCount !== 1 ? 's' : ''} on timeline</li>
          </ul>
        </div>

        {/* Final Score Input - only show when marking complete */}
        {!isComplete && (
          <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Final Score <span className="text-red-500">*</span>
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Your Team</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={finalScoreInputs.teamScore}
                  onChange={(e) => onFinalScoreChange(prev => ({ ...prev, teamScore: e.target.value }))}
                  placeholder="0"
                  className={`w-full px-3 py-2 text-center text-lg font-semibold border rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 ${
                    finalScoreInputs.teamScore === '' ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              <span className="text-gray-400 text-lg font-medium pt-5">—</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{opponentName || 'Opponent'}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={finalScoreInputs.opponentScore}
                  onChange={(e) => onFinalScoreChange(prev => ({ ...prev, opponentScore: e.target.value }))}
                  placeholder="0"
                  className={`w-full px-3 py-2 text-center text-lg font-semibold border rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 ${
                    finalScoreInputs.opponentScore === '' ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
            {isMissingScores && (
              <p className="mt-2 text-xs text-red-600">Please enter the final score for both teams</p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          {isComplete
            ? 'This will allow you to continue tagging plays. While editing, analytics for this game will be hidden until you mark it complete again.'
            : 'Game analytics and season totals will only include games marked as complete. You can edit later if you need to make changes.'}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDisabled}
            className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${
              isComplete
                ? 'bg-blue-600 hover:bg-blue-700'
                : isDisabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isComplete ? 'Resume Editing' : 'Mark Tagging Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
