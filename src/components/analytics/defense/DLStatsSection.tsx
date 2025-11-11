/**
 * DL Stats Section
 *
 * Shows defensive line statistics (Tier 3).
 * Only shown at Player level when position is DL.
 *
 * DL stats:
 * - Tackles: Primary, Assists, Total, Missed
 * - Pass Rush: Pressures, Sacks, Rates
 * - Run Defense: Stops, Stop Rate
 * - Havoc: TFLs, Forced Fumbles
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface DLStatsProps {
  data: {
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
    missedTackleRate: number;

    // Pass Rush
    passRushSnaps: number;
    pressures: number;
    sacks: number;
    pressureRate: number;
    sackRate: number;

    // Run Defense
    runDefenseSnaps: number;
    runStops: number;
    runStopRate: number;

    // Havoc
    tfls: number;
    forcedFumbles: number;
    havocPlays: number;
    havocRate: number;
  } | null;
  gameName?: string;
}

export default function DLStatsSection({ data, gameName }: DLStatsProps) {
  const title = gameName
    ? `DL Stats - ${gameName}`
    : 'DL Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="defense-dl-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No DL data available. Tag defensive plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-dl-stats"
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
        {/* Tackles */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Tackles</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Snaps</div>
              <div className="text-2xl font-bold text-gray-900">{data.defensiveSnaps}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Total Tackles</div>
              <div className="text-2xl font-bold text-gray-900">{data.totalTackles}</div>
              <div className="text-sm text-gray-600">{data.primaryTackles} solo</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Participation</div>
              <div className="text-2xl font-bold text-gray-900">{data.tackleParticipation.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Missed Tackles</div>
              <div className="text-2xl font-bold text-gray-900">{data.missedTackles}</div>
              <div className="text-sm text-gray-600">{data.missedTackleRate.toFixed(1)}% miss rate</div>
            </div>
          </div>
        </div>

        {/* Pass Rush */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Pass Rush</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Pass Rush Snaps</div>
              <div className="text-2xl font-bold text-gray-900">{data.passRushSnaps}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Pressures</div>
              <div className="text-2xl font-bold text-gray-900">{data.pressures}</div>
              <div className="text-sm text-gray-600">{data.pressureRate.toFixed(1)}% rate</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Sacks</div>
              <div className="text-2xl font-bold text-gray-900">{data.sacks}</div>
              <div className="text-sm text-gray-600">{data.sackRate.toFixed(1)}% rate</div>
            </div>
          </div>
        </div>

        {/* Run Defense */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Run Defense</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Run Defense Snaps</div>
              <div className="text-2xl font-bold text-gray-900">{data.runDefenseSnaps}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Run Stops</div>
              <div className="text-2xl font-bold text-gray-900">{data.runStops}</div>
              <div className="text-sm text-gray-600">{data.runStopRate.toFixed(1)}% stop rate</div>
            </div>
          </div>
        </div>

        {/* Havoc */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Havoc</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border-2 border-red-200">
              <div className="text-xs text-gray-600 mb-1">Havoc Rate</div>
              <div className="text-3xl font-bold text-red-600">{data.havocRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{data.havocPlays} plays</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">TFLs</div>
              <div className="text-2xl font-bold text-gray-900">{data.tfls}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Sacks</div>
              <div className="text-2xl font-bold text-gray-900">{data.sacks}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Forced Fumbles</div>
              <div className="text-2xl font-bold text-gray-900">{data.forcedFumbles}</div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
