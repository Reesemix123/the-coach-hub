/**
 * RB Stats Section
 *
 * Shows RB-specific statistics (Tier 2+).
 * Only shown at Player level when position is RB.
 *
 * RB stats:
 * - Rushing: Att-Yards (Avg), TDs, Success Rate, Explosive Runs
 * - Receiving: Rec-Yards (Avg), TDs, Catch Rate
 * - Total: Touches, Yards, TDs, YPT
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface RBStatsProps {
  data: {
    playerName: string;
    jerseyNumber: string;
    position: string;

    // Rushing
    carries: number;
    rushYards: number;
    rushAvg: number;
    rushTDs: number;
    rushSuccess: number;
    rushSuccessRate: number;
    explosiveRuns: number;
    explosiveRate: number;

    // Receiving
    targets: number;
    receptions: number;
    recYards: number;
    recAvg: number;
    recTDs: number;
    catchRate: number;

    // Combined
    totalTouches: number;
    totalYards: number;
    totalTDs: number;
    yardsPerTouch: number;

    // Situational
    thirdDownRushes: number;
    thirdDownConversions: number;
    thirdDownPct: number;
  } | null;
  gameName?: string;
}

export default function RBStatsSection({ data, gameName }: RBStatsProps) {
  const title = gameName
    ? `RB Stats - ${gameName}`
    : 'RB Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="offense-rb-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No RB data available. Tag plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-rb-stats"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
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
        {/* Rushing Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Rushing</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Carries</div>
              <div className="text-2xl font-bold text-gray-900">{data.carries}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Yards</div>
              <div className="text-2xl font-bold text-gray-900">{data.rushYards}</div>
              <div className="text-sm text-gray-600">{data.rushAvg.toFixed(1)} YPC</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">TDs</div>
              <div className="text-2xl font-bold text-gray-900">{data.rushTDs}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-gray-900">{data.rushSuccessRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">{data.rushSuccess} successful</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Explosive Runs</div>
              <div className="text-2xl font-bold text-gray-900">{data.explosiveRuns}</div>
              <div className="text-sm text-gray-600">{data.explosiveRate.toFixed(1)}% (10+ yds)</div>
            </div>
          </div>
        </div>

        {/* Receiving Stats */}
        {data.targets > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Receiving</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Targets</div>
                <div className="text-2xl font-bold text-gray-900">{data.targets}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Receptions</div>
                <div className="text-2xl font-bold text-gray-900">{data.receptions}</div>
                <div className="text-sm text-gray-600">{data.catchRate.toFixed(1)}% catch rate</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Rec Yards</div>
                <div className="text-2xl font-bold text-gray-900">{data.recYards}</div>
                <div className="text-sm text-gray-600">{data.recAvg.toFixed(1)} YPR</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Rec TDs</div>
                <div className="text-2xl font-bold text-gray-900">{data.recTDs}</div>
              </div>
            </div>
          </div>
        )}

        {/* Total Production */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Total Production</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Total Touches</div>
              <div className="text-2xl font-bold text-gray-900">{data.totalTouches}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Total Yards</div>
              <div className="text-2xl font-bold text-gray-900">{data.totalYards}</div>
              <div className="text-sm text-gray-600">{data.yardsPerTouch.toFixed(1)} YPT</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Total TDs</div>
              <div className="text-2xl font-bold text-gray-900">{data.totalTDs}</div>
            </div>
          </div>
        </div>

        {/* Situational */}
        {data.thirdDownRushes > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Situational</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">3rd Down Rushes</div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.thirdDownConversions}/{data.thirdDownRushes}
                </div>
                <div className="text-sm text-gray-600">{data.thirdDownPct.toFixed(1)}% converted</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
