/**
 * OL Stats Section
 *
 * Shows offensive line statistics (Tier 3 only).
 * Only shown at Player level when position is OL.
 *
 * OL stats:
 * - Block Win Rate
 * - Total Assignments
 * - Wins/Losses/Neutral
 * - Penalties
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface OLStatsProps {
  data: {
    playerName: string;
    jerseyNumber: string;
    position: string;
    totalAssignments: number;
    blockWins: number;
    blockLosses: number;
    blockNeutral: number;
    blockWinRate: number;
    penalties: number;
  } | null;
  gameName?: string;
}

export default function OLStatsSection({ data, gameName }: OLStatsProps) {
  const title = gameName
    ? `OL Stats - ${gameName}`
    : 'OL Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="offense-ol-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No OL data available. Tag plays with OL grades in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  // Determine color for block win rate
  const getWinRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <CollapsibleSection
      id="offense-ol-stats"
      title={title}
      badge="Tier 3"
      badgeColor="purple"
      defaultExpanded={true}
    >
      {/* Player Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-gray-900">#{data.jerseyNumber}</div>
          <div>
            <div className="text-xl font-semibold text-gray-900">{data.playerName}</div>
            <div className="text-sm text-gray-600">{data.position}</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Block Win Rate */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Blocking Performance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
              <div className="text-xs text-gray-600 mb-2">Block Win Rate</div>
              <div className={`text-4xl font-bold ${getWinRateColor(data.blockWinRate)}`}>
                {data.blockWinRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {data.blockWins} wins / {data.totalAssignments} snaps
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="text-xs text-gray-600 mb-2">Total Assignments</div>
              <div className="text-4xl font-bold text-gray-900">{data.totalAssignments}</div>
            </div>
          </div>
        </div>

        {/* Block Breakdown */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Block Breakdown</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-xs text-green-700 mb-1">Wins</div>
              <div className="text-2xl font-bold text-green-700">{data.blockWins}</div>
              <div className="text-sm text-green-600">
                {((data.blockWins / data.totalAssignments) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-700 mb-1">Neutral</div>
              <div className="text-2xl font-bold text-gray-700">{data.blockNeutral}</div>
              <div className="text-sm text-gray-600">
                {((data.blockNeutral / data.totalAssignments) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-xs text-red-700 mb-1">Losses</div>
              <div className="text-2xl font-bold text-red-700">{data.blockLosses}</div>
              <div className="text-sm text-red-600">
                {((data.blockLosses / data.totalAssignments) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Penalties */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Discipline</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Penalties</div>
              <div className="text-2xl font-bold text-gray-900">{data.penalties}</div>
              <div className="text-sm text-gray-600">
                {((data.penalties / data.totalAssignments) * 100).toFixed(1)}% penalty rate
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
