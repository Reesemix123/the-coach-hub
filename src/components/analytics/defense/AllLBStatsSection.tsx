/**
 * All LB Stats Section
 *
 * Shows statistics for ALL linebackers on the team in a table format.
 * Available at Player level (Tier 3).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface LBStats {
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

  // Coverage
  coverageSnaps: number;
  targets: number;
  completionsAllowed: number;
  yardsAllowed: number;
  coverageSuccessRate: number;

  // Pass Rush
  blitzSnaps: number;
  pressures: number;
  sacks: number;
  pressureRate: number;

  // Havoc
  tfls: number;
  forcedFumbles: number;
  interceptions: number;
  pbus: number;
  havocRate: number;
}

interface AllLBStatsSectionProps {
  data: LBStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllLBStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllLBStatsSectionProps) {
  const title = level === 'game'
    ? `Linebacker Stats - ${gameName || 'Game'}`
    : 'Linebacker Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="defense-all-lb-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No LB data available. Tag defensive plays with LB attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-all-lb-stats"
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Press</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tgts</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cov %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Havoc %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((lb) => (
                <tr key={lb.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{lb.jerseyNumber} {lb.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {lb.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {lb.defensiveSnaps}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {lb.totalTackles}
                    <span className="text-gray-500 text-xs ml-1">
                      ({lb.primaryTackles}-{lb.assistTackles})
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{lb.tfls}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{lb.sacks}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {lb.pressures}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {lb.targets}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(lb.coverageSuccessRate || 0) >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {(lb.coverageSuccessRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{lb.interceptions || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={(lb.havocRate || 0) >= 10 ? 'text-green-600 font-semibold' : ''}>
                      {(lb.havocRate || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>TFL:</strong> Tackles for loss.
        {' '}<strong>Press:</strong> QB pressures on blitzes.
        {' '}<strong>Tgts:</strong> Times targeted in coverage.
        {' '}<strong>Cov %:</strong> Coverage success rate (target didn't get expected yards).
        {' '}<strong>Havoc %:</strong> Percentage of snaps with TFL, sack, INT, PBU, or forced fumble.
      </p>
    </CollapsibleSection>
  );
}
