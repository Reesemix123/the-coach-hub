/**
 * All DB Stats Section
 *
 * Shows statistics for ALL defensive backs on the team in a table format.
 * Available at Player level (Tier 3).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface DBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Coverage
  defensiveSnaps: number;
  coverageSnaps: number;
  targets: number;
  completionsAllowed: number;
  yardsAllowed: number;
  yardsAllowedPerTarget: number;
  coverageSuccessRate: number;

  // Ball Production
  interceptions: number;
  pbus: number;
  ballProductionRate: number;

  // Tackles
  primaryTackles: number;
  assistTackles: number;
  totalTackles: number;
  missedTackles: number;
}

interface AllDBStatsSectionProps {
  data: DBStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllDBStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllDBStatsSectionProps) {
  const title = level === 'game'
    ? `Defensive Back Stats - ${gameName || 'Game'}`
    : 'Defensive Back Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="defense-all-db-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No DB data available. Tag defensive plays with DB attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-all-db-stats"
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tgts</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Comp</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yds</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yds/Tgt</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cov %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">PBU</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Ball %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tackles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((db) => (
                <tr key={db.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{db.jerseyNumber} {db.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {db.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.defensiveSnaps}
                    <span className="text-gray-500 text-xs ml-1">
                      ({db.coverageSnaps} cov)
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.targets}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.completionsAllowed}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.yardsAllowed}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {(db.yardsAllowedPerTarget || 0).toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(db.coverageSuccessRate || 0) >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {(db.coverageSuccessRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{db.interceptions || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.pbus || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(db.ballProductionRate || 0) >= 15 ? 'text-green-600 font-semibold' : ''}>
                      {(db.ballProductionRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {db.totalTackles}
                    <span className="text-gray-500 text-xs ml-1">
                      ({db.primaryTackles}-{db.assistTackles})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Tgts:</strong> Times targeted in coverage.
        {' '}<strong>Cov %:</strong> Coverage success rate (target didn't get expected yards).
        {' '}<strong>PBU:</strong> Pass breakups.
        {' '}<strong>Ball %:</strong> Ball production rate (INT + PBU per coverage snap).
      </p>
    </CollapsibleSection>
  );
}
