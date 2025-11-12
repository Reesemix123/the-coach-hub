/**
 * All OL Stats Section
 *
 * Shows statistics for ALL offensive linemen on the team in a table format.
 * Available at Player level (Tier 3).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface OLStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Blocking
  totalAssignments: number;
  blockWins: number;
  blockLosses: number;
  blockNeutral: number;
  blockWinRate: number;

  // Penalties
  penalties: number;
}

interface AllOLStatsSectionProps {
  data: OLStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllOLStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllOLStatsSectionProps) {
  const title = level === 'game'
    ? `Offensive Line Stats - ${gameName || 'Game'}`
    : 'Offensive Line Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="offense-all-ol-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No OL data available. Tag plays with OL block results in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-all-ol-stats"
      title={title}
      badge="Tier 3"
      badgeColor="purple"
      defaultExpanded={true}
    >
      {/* Stats Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Assignments</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Wins</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Losses</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Neutral</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Win Rate</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Penalties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((ol) => (
                <tr key={ol.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{ol.jerseyNumber} {ol.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {ol.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {ol.totalAssignments}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{ol.blockWins}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{ol.blockLosses}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {ol.blockNeutral}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={ol.blockWinRate >= 70 ? 'text-green-600 font-semibold' : ol.blockWinRate < 50 ? 'text-red-600' : ''}>
                      {ol.blockWinRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={ol.penalties > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                      {ol.penalties}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Block Win:</strong> Successfully blocked assignment (no pressure, run gain).
        {' '}<strong>Block Loss:</strong> Failed assignment (pressure allowed, TFL).
        {' '}<strong>Neutral:</strong> Assignment completed but minimal impact.
        {' '}<strong>Win Rate:</strong> Percentage of assignments graded as wins.
      </p>
    </CollapsibleSection>
  );
}
