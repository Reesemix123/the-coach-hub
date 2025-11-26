/**
 * LB Stats Section
 *
 * Shows linebacker statistics (Tier 3).
 * Only shown at Player level when position is LB.
 *
 * LB stats:
 * - Tackles: Primary, Assists, Total, Missed
 * - Coverage: Snaps, Success Rate
 * - Blitz: Snaps, Pressures, Sacks
 * - Havoc: TFLs, Forced Fumbles, INTs, PBUs
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface LBStatsProps {
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

    // Coverage
    coverageSnaps: number;
    coverageWins: number;
    coverageSuccessRate: number;

    // Blitz
    blitzSnaps: number;
    pressures: number;
    sacks: number;
    pressureRate: number;

    // Havoc
    tfls: number;
    forcedFumbles: number;
    interceptions: number;
    pbus: number;
    havocPlays: number;
    havocRate: number;
  } | null;
  gameName?: string;
}

export default function LBStatsSection({ data, gameName }: LBStatsProps) {
  const title = gameName
    ? `LB Stats - ${gameName}`
    : 'LB Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="defense-lb-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No LB data available. Tag defensive plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-lb-stats"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Snaps</div>
              <div className="text-2xl font-bold text-gray-900">{data.defensiveSnaps}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Total Tackles</div>
              <div className="text-2xl font-bold text-gray-900">{data.totalTackles}</div>
              <div className="text-sm text-gray-600">
                {data.primaryTackles} solo, {data.assistTackles} ast
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Participation</div>
              <div className="text-2xl font-bold text-gray-900">{data.tackleParticipation.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Missed</div>
              <div className="text-2xl font-bold text-gray-900">{data.missedTackles}</div>
            </div>
          </div>
        </div>

        {/* Coverage */}
        {data.coverageSnaps > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Coverage</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Coverage Snaps</div>
                <div className="text-2xl font-bold text-gray-900">{data.coverageSnaps}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Coverage Wins</div>
                <div className="text-2xl font-bold text-gray-900">{data.coverageWins}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900">{data.coverageSuccessRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Blitz */}
        {data.blitzSnaps > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Blitz</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Blitz Snaps</div>
                <div className="text-2xl font-bold text-gray-900">{data.blitzSnaps}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Pressures</div>
                <div className="text-2xl font-bold text-gray-900">{data.pressures}</div>
                <div className="text-sm text-gray-600">{data.pressureRate.toFixed(1)}% rate</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Sacks</div>
                <div className="text-2xl font-bold text-gray-900">{data.sacks}</div>
              </div>
            </div>
          </div>
        )}

        {/* Havoc */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Havoc</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <div className="text-xs text-gray-600 mb-1">FFs</div>
              <div className="text-2xl font-bold text-gray-900">{data.forcedFumbles}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">INTs</div>
              <div className="text-2xl font-bold text-gray-900">{data.interceptions}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">PBUs</div>
              <div className="text-2xl font-bold text-gray-900">{data.pbus}</div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
