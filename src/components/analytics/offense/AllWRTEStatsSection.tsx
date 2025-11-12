/**
 * All WR/TE Stats Section
 *
 * Shows statistics for ALL wide receivers and tight ends on the team in a table format.
 * Available at Player level (Tier 2+).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface WRTEStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;

  // Receiving
  targets: number;
  receptions: number;
  catchRate: number;
  receivingYards: number;
  yardsPerReception: number;
  yardsPerTarget: number;
  touchdowns: number;
  longReception: number;
  firstDowns: number;
  receptionsOf15Plus: number;

  // Efficiency
  successRate: number;
  dropRate: number;
}

interface AllWRTEStatsSectionProps {
  data: WRTEStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllWRTEStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllWRTEStatsSectionProps) {
  const title = level === 'game'
    ? `WR/TE Stats - ${gameName || 'Game'}`
    : 'WR/TE Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="offense-all-wrte-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No WR/TE data available. Tag plays with target attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-all-wrte-stats"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tgt</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Catch %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yards</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPR</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPT</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TD</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">1st Downs</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Success %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((wr) => (
                <tr key={wr.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{wr.jerseyNumber} {wr.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {wr.position}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.targets}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.receptions}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.catchRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.receivingYards}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.yardsPerReception.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.yardsPerTarget.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{wr.touchdowns}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {wr.firstDowns}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={wr.successRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {wr.successRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Catch Rate:</strong> Percentage of targets that resulted in a reception.
        {' '}<strong>YPR:</strong> Yards per reception.
        {' '}<strong>YPT:</strong> Yards per target (includes incompletions).
        {' '}<strong>Success Rate:</strong> Receptions that gained expected yards based on down and distance.
      </p>
    </CollapsibleSection>
  );
}
