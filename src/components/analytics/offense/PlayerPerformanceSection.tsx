/**
 * Player Performance Section (Offense)
 *
 * Shows individual player statistics (Tier 2+).
 * Only shown at Player level.
 *
 * Player stats:
 * - Rushing: Carries-Yards (Avg)
 * - Passing: Comp/Att (Pct%)
 * - Receiving: Rec-Yards (Catch%)
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import Tooltip from '../Tooltip';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface PlayerStat {
  playerId: string;
  jerseyNumber: string;
  playerName: string;
  position: string;
  carries: number;
  rushYards: number;
  rushAvg: number;
  passAttempts: number;
  completions: number;
  completionPct: number;
  targets: number;
  receptions: number;
  recYards: number;
  catchRate: number;
}

interface PlayerPerformanceSectionProps {
  data: PlayerStat[];
  gameName?: string; // If filtering to specific game
}

export default function PlayerPerformanceSection({
  data,
  gameName,
}: PlayerPerformanceSectionProps) {
  const title = gameName
    ? `Player Performance - ${gameName}`
    : 'Player Performance - Season';

  return (
    <CollapsibleSection
      id="offense-player-performance"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
      defaultExpanded={true}
    >
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                <Tooltip content={METRIC_DEFINITIONS.rushingYards}>
                  <span>Rush</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                <Tooltip content={METRIC_DEFINITIONS.passingStats}>
                  <span>Pass</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                <Tooltip content={METRIC_DEFINITIONS.receivingStats}>
                  <span>Rec</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No player data available. Tag plays in Film Room to see player stats.
                </td>
              </tr>
            ) : (
              data.slice(0, 15).map((player) => (
                <tr key={player.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{player.jerseyNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{player.playerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{player.position}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {player.carries > 0 && `${player.carries}-${player.rushYards} (${player.rushAvg.toFixed(1)})`}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {player.passAttempts > 0 && `${player.completions}/${player.passAttempts} (${player.completionPct.toFixed(0)}%)`}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {player.targets > 0 && `${player.receptions}-${player.recYards} (${player.catchRate.toFixed(0)}%)`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
