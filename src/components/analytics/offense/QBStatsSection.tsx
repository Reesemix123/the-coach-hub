/**
 * QB Stats Section
 *
 * Shows QB-specific statistics (Tier 2+).
 * Only shown at Player level when position is QB.
 *
 * QB stats:
 * - Passing: Comp/Att (Pct%), Yards, YPA, TDs, INTs, Sacks
 * - Rushing: Att-Yards (Avg), TDs
 * - Situational: 3rd Down%, Red Zone TD%, Under Pressure%
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface QBStatsProps {
  data: {
    playerName: string;
    jerseyNumber: string;
    position: string;

    // Passing
    dropbacks: number;
    completions: number;
    attempts: number;
    completionPct: number;
    passYards: number;
    yardsPerAttempt: number;
    passTDs: number;
    interceptions: number;
    sacks: number;

    // Rushing
    rushAttempts: number;
    rushYards: number;
    rushAvg: number;
    rushTDs: number;

    // Situational
    thirdDownAttempts: number;
    thirdDownConversions: number;
    thirdDownPct: number;
    redZoneAttempts: number;
    redZoneTDs: number;
    redZoneTDPct: number;
    pressuredDropbacks: number;
    completionsUnderPressure: number;
    pressureCompletionPct: number;
  } | null;
  gameName?: string;
}

export default function QBStatsSection({ data, gameName }: QBStatsProps) {
  const title = gameName
    ? `QB Stats - ${gameName}`
    : 'QB Stats - Season';

  if (!data) {
    return (
      <CollapsibleSection
        id="offense-qb-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No QB data available. Tag plays in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-qb-stats"
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
        {/* Passing Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Passing</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Comp/Att</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.completions}/{data.attempts}
              </div>
              <div className="text-sm text-gray-600">{data.completionPct.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Yards</div>
              <div className="text-2xl font-bold text-gray-900">{data.passYards}</div>
              <div className="text-sm text-gray-600">{data.yardsPerAttempt.toFixed(1)} YPA</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">TDs</div>
              <div className="text-2xl font-bold text-gray-900">{data.passTDs}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">INTs</div>
              <div className="text-2xl font-bold text-gray-900">{data.interceptions}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Sacks</div>
              <div className="text-2xl font-bold text-gray-900">{data.sacks}</div>
            </div>
          </div>
        </div>

        {/* Rushing Stats */}
        {data.rushAttempts > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Rushing</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Attempts</div>
                <div className="text-2xl font-bold text-gray-900">{data.rushAttempts}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Yards</div>
                <div className="text-2xl font-bold text-gray-900">{data.rushYards}</div>
                <div className="text-sm text-gray-600">{data.rushAvg.toFixed(1)} YPC</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Rush TDs</div>
                <div className="text-2xl font-bold text-gray-900">{data.rushTDs}</div>
              </div>
            </div>
          </div>
        )}

        {/* Situational Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Situational</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">3rd Down</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.thirdDownConversions}/{data.thirdDownAttempts}
              </div>
              <div className="text-sm text-gray-600">{data.thirdDownPct.toFixed(1)}% converted</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Red Zone</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.redZoneTDs}/{data.redZoneAttempts}
              </div>
              <div className="text-sm text-gray-600">{data.redZoneTDPct.toFixed(1)}% TD rate</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Under Pressure</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.completionsUnderPressure}/{data.pressuredDropbacks}
              </div>
              <div className="text-sm text-gray-600">{data.pressureCompletionPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
