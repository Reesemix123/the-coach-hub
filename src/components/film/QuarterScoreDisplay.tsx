'use client';

import { useEffect, useState } from 'react';
import { GameScoreBreakdown, QuarterScores } from '@/types/football';
import { gameScoreService, EMPTY_QUARTER_SCORES } from '@/lib/services/game-score.service';

interface QuarterScoreDisplayProps {
  gameId: string;
  teamName?: string;
  opponentName?: string;
  quarterScores?: GameScoreBreakdown | null;
  compact?: boolean;
  onScoresUpdated?: (scores: GameScoreBreakdown) => void;
}

export function QuarterScoreDisplay({
  gameId,
  teamName = 'Your Team',
  opponentName = 'Opponent',
  quarterScores: initialScores,
  compact = false,
  onScoresUpdated
}: QuarterScoreDisplayProps) {
  const [scores, setScores] = useState<GameScoreBreakdown | null>(initialScores || null);
  const [isLoading, setIsLoading] = useState(!initialScores);

  useEffect(() => {
    if (!initialScores) {
      loadScores();
    }
  }, [gameId, initialScores]);

  const loadScores = async () => {
    try {
      setIsLoading(true);
      const data = await gameScoreService.getQuarterScores(gameId);
      setScores(data);
      if (data && onScoresUpdated) {
        onScoresUpdated(data);
      }
    } catch (error) {
      console.error('Error loading scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get display data
  const displayData = gameScoreService.formatScoresForDisplay(scores);
  const source = scores?.source || 'calculated';
  const hasOT = scores?.calculated?.team?.ot && scores.calculated.team.ot > 0 ||
                scores?.calculated?.opponent?.ot && scores.calculated.opponent.ot > 0;

  // Filter out OT column if no overtime
  const headers = hasOT ? displayData.headers : displayData.headers.filter(h => h !== 'OT');
  const teamScores = hasOT ? displayData.team : displayData.team.filter((_, i) => i !== 4);
  const oppScores = hasOT ? displayData.opponent : displayData.opponent.filter((_, i) => i !== 4);

  if (isLoading) {
    return (
      <div className={`bg-gray-50 rounded-lg ${compact ? 'p-2' : 'p-4'} animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-8 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  if (compact) {
    // Compact inline display for headers/sidebars
    const teamTotal = scores?.calculated?.team?.total ?? scores?.manual?.team?.total ?? '-';
    const oppTotal = scores?.calculated?.opponent?.total ?? scores?.manual?.opponent?.total ?? '-';

    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{teamTotal}</span>
        <span className="text-gray-400">-</span>
        <span className="font-semibold">{oppTotal}</span>
        {source === 'manual' && (
          <span className="text-xs text-gray-500">(manual)</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Score by Quarter</h4>
        {source === 'manual' && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
            Manual Entry
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-600 w-32">Team</th>
              {headers.map((header, i) => (
                <th
                  key={header}
                  className={`py-2 px-2 font-medium text-gray-600 text-center ${
                    i === headers.length - 1 ? 'bg-gray-100 font-semibold' : ''
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-900 truncate max-w-32" title={teamName}>
                {teamName}
              </td>
              {teamScores.map((score, i) => (
                <td
                  key={i}
                  className={`py-2 px-2 text-center ${
                    i === teamScores.length - 1
                      ? 'bg-gray-100 font-bold text-gray-900'
                      : 'text-gray-700'
                  }`}
                >
                  {score}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium text-gray-900 truncate max-w-32" title={opponentName}>
                {opponentName}
              </td>
              {oppScores.map((score, i) => (
                <td
                  key={i}
                  className={`py-2 px-2 text-center ${
                    i === oppScores.length - 1
                      ? 'bg-gray-100 font-bold text-gray-900'
                      : 'text-gray-700'
                  }`}
                >
                  {score}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {scores?.last_calculated_at && (
        <p className="text-xs text-gray-500 mt-2">
          Last calculated: {new Date(scores.last_calculated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
