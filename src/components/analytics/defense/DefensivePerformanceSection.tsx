/**
 * Defensive Performance Section (Defense)
 *
 * Shows individual defensive player statistics (Tier 3).
 * Only shown at Player level.
 *
 * Player stats:
 * - Tackles (solo + assisted)
 * - Pressures
 * - TFL (Tackles for Loss)
 * - Sacks
 * - PBU (Pass Breakups)
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import Tooltip from '../Tooltip';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface DefensivePlayerStat {
  playerId: string;
  jerseyNumber: string;
  playerName: string;
  totalTackles: number;
  pressures: number;
  tfls: number;
  sacks: number;
  pbus: number;
}

interface DefensivePerformanceSectionProps {
  data: DefensivePlayerStat[];
  gameName?: string;
}

export default function DefensivePerformanceSection({
  data,
  gameName,
}: DefensivePerformanceSectionProps) {
  const title = gameName
    ? `Defensive Performance - ${gameName}`
    : 'Defensive Performance - Season';

  return (
    <CollapsibleSection
      id="defense-player-performance"
      title={title}
      badge="Tier 3"
      badgeColor="green"
      defaultExpanded={true}
    >
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Player</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                <Tooltip content={METRIC_DEFINITIONS.tackles}>
                  <span>Tkl</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                <Tooltip content={METRIC_DEFINITIONS.pressures}>
                  <span>Press</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                <Tooltip content={METRIC_DEFINITIONS.tfl}>
                  <span>TFL</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                <Tooltip content={METRIC_DEFINITIONS.sacks}>
                  <span>Sacks</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                <Tooltip content={METRIC_DEFINITIONS.pbu}>
                  <span>PBU</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No defensive data available. Tier 3 tracking required.
                </td>
              </tr>
            ) : (
              data.slice(0, 15).map((player) => (
                <tr key={player.playerId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{player.jerseyNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{player.playerName}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{player.totalTackles}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{player.pressures}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{player.tfls}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{player.sacks}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{player.pbus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
