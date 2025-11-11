/**
 * DB Stats Section
 *
 * Shows defensive back statistics (Tier 3).
 * Only shown at Player level when position is DB (CB/S).
 *
 * DB stats:
 * - Coverage: Snaps, Targets, Completions Allowed, Yards, Success Rate
 * - Ball Production: INTs, PBUs
 * - Tackles: Primary, Assists, Total, Missed
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface DBStatsProps {
  data: {
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
    coverageWins: number;
    coverageSuccessRate: number;

    // Ball Production
    interceptions: number;
    pbus: number;
    ballProduction: number;
    ballProductionRate: number;

    // Tackles
    primaryTackles: number;
    assistTackles: number;
    totalTackles: number;
    missedTackles: number;
    tackleParticipation: number;
  } | null;
  gameName?: string;
}

export default function DBStatsSection({ data, gameName }: DBStatsProps) {
  const title = gameName
    ? `DB Stats - ${gameName}`
    : 'DB Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="defense-db-stats"
        title={title}
        badge="Tier 3"
        badgeColor="purple"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No DB data available. Tag defensive plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="defense-db-stats"
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
        {/* Coverage */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Coverage</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Snaps</div>
              <div className="text-2xl font-bold text-gray-900">{data.defensiveSnaps}</div>
              <div className="text-sm text-gray-600">{data.coverageSnaps} in coverage</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Targets</div>
              <div className="text-2xl font-bold text-gray-900">{data.targets}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Comp Allowed</div>
              <div className="text-2xl font-bold text-gray-900">{data.completionsAllowed}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-gray-900">{data.coverageSuccessRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{data.coverageWins} wins</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Yards Allowed</div>
              <div className="text-2xl font-bold text-gray-900">{data.yardsAllowed}</div>
              <div className="text-sm text-gray-600">{data.yardsAllowedPerTarget.toFixed(1)} per target</div>
            </div>
          </div>
        </div>

        {/* Ball Production */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Ball Production</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border-2 border-blue-200">
              <div className="text-xs text-gray-600 mb-1">Ball Production Rate</div>
              <div className="text-3xl font-bold text-blue-600">{data.ballProductionRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{data.ballProduction} plays</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Interceptions</div>
              <div className="text-2xl font-bold text-gray-900">{data.interceptions}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Pass Breakups</div>
              <div className="text-2xl font-bold text-gray-900">{data.pbus}</div>
            </div>
          </div>
        </div>

        {/* Tackles */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Tackles</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>
    </CollapsibleSection>
  );
}
