/**
 * WR/TE Stats Section
 *
 * Shows WR/TE-specific statistics (Tier 2+).
 * Only shown at Player level when position is WR/TE.
 *
 * WR/TE stats:
 * - Receiving: Targets, Rec, Yards, YPR, TDs, Catch Rate, Explosive Catches
 * - Drops: Count and Rate
 * - Situational: 3rd Down, Red Zone
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface WRTEStatsProps {
  data: {
    playerName: string;
    jerseyNumber: string;
    position: string;

    // Receiving
    targets: number;
    receptions: number;
    recYards: number;
    recAvg: number;
    yardsPerTarget: number;
    recTDs: number;
    catchRate: number;
    explosiveCatches: number;
    explosiveRate: number;

    // Drops
    drops: number;
    dropRate: number;

    // Situational
    thirdDownTargets: number;
    thirdDownConversions: number;
    thirdDownPct: number;
    redZoneTargets: number;
    redZoneTDs: number;
    redZoneTDPct: number;
  } | null;
  gameName?: string;
}

export default function WRTEStatsSection({ data, gameName }: WRTEStatsProps) {
  const title = gameName
    ? `WR/TE Stats - ${gameName}`
    : 'WR/TE Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="offense-wrte-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No WR/TE data available. Tag plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-wrte-stats"
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
        {/* Receiving Stats */}
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
              <div className="text-xs text-gray-600 mb-1">Yards</div>
              <div className="text-2xl font-bold text-gray-900">{data.recYards}</div>
              <div className="text-sm text-gray-600">{data.recAvg.toFixed(1)} YPR</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">TDs</div>
              <div className="text-2xl font-bold text-gray-900">{data.recTDs}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Yards/Target</div>
              <div className="text-2xl font-bold text-gray-900">{data.yardsPerTarget.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Explosive Catches</div>
              <div className="text-2xl font-bold text-gray-900">{data.explosiveCatches}</div>
              <div className="text-sm text-gray-600">{data.explosiveRate.toFixed(1)}% (15+ yds)</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Drops</div>
              <div className="text-2xl font-bold text-gray-900">{data.drops}</div>
              <div className="text-sm text-gray-600">{data.dropRate.toFixed(1)}% drop rate</div>
            </div>
          </div>
        </div>

        {/* Situational Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Situational</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">3rd Down</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.thirdDownConversions}/{data.thirdDownTargets}
              </div>
              <div className="text-sm text-gray-600">{data.thirdDownPct.toFixed(1)}% converted</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Red Zone</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.redZoneTDs}/{data.redZoneTargets}
              </div>
              <div className="text-sm text-gray-600">{data.redZoneTDPct.toFixed(1)}% TD rate</div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
