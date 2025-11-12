/**
 * All DL Stats Section
 *
 * Shows statistics for ALL defensive linemen on the team in a table format.
 * Available at Player level (Tier 3).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface DLStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Tackles
  defensiveSnaps: number;
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;
  tackleParticipation: number;

  // Pass Rush
  passRushSnaps: number;
  pressures: number;
  sacks: number;
  pressureRate: number;

  // Run Defense
  runStops: number;
  runStopRate: number;

  // Havoc
  tfls: number;
  forcedFumbles: number;
  havocRate: number;
}

interface AllDLStatsSectionProps {
  data: DLStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllDLStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllDLStatsSectionProps) {
  const title = level === 'game'
    ? `Defensive Line Stats - ${gameName || 'Game'}`
    : 'Defensive Line Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="defense-all-dl-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No DL data available. Tag defensive plays with DL attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-all-dl-stats"
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Snaps</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tackles</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TFL</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sacks</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Pressures</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Press %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Havoc %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">FF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((dl) => (
                <tr key={dl.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{dl.jerseyNumber} {dl.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dl.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {dl.defensiveSnaps}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {dl.totalTackles}
                    <span className="text-gray-500 text-xs ml-1">
                      ({dl.primaryTackles}-{dl.assistTackles})
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{dl.tfls}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{dl.sacks}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {dl.pressures}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(dl.pressureRate || 0) >= 10 ? 'text-green-600 font-semibold' : ''}>
                      {(dl.pressureRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(dl.havocRate || 0) >= 10 ? 'text-green-600 font-semibold' : ''}>
                      {(dl.havocRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {dl.forcedFumbles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>TFL:</strong> Tackles for loss.
        {' '}<strong>Press %:</strong> Percentage of pass rush snaps with a pressure.
        {' '}<strong>Havoc %:</strong> Percentage of snaps with TFL, sack, forced fumble, or PBU.
        {' '}<strong>FF:</strong> Forced fumbles.
      </p>
    </CollapsibleSection>
  );
}
