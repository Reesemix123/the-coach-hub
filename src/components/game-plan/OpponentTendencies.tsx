'use client';

import { useState } from 'react';
import { AlertCircle, TrendingUp, Shield, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { OpponentProfile } from '@/types/football';

interface OpponentTendenciesProps {
  opponentProfile: OpponentProfile;
  opponentName: string;
}

export default function OpponentTendencies({
  opponentProfile,
  opponentName
}: OpponentTendenciesProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasData = opponentProfile.totalPlaysAnalyzed > 0;

  // Get confidence label based on sample size
  const getConfidenceLabel = () => {
    const plays = opponentProfile.totalPlaysAnalyzed;
    if (plays >= 60) return 'High confidence';
    if (plays >= 30) return 'Medium confidence';
    return 'Low confidence';
  };

  const getConfidenceTooltip = () => {
    const plays = opponentProfile.totalPlaysAnalyzed;
    return `Based on ${plays} opponent plays analyzed. ${
      plays >= 60 ? 'High confidence - strong sample size.' :
      plays >= 30 ? 'Medium confidence - reasonable sample size.' :
      'Low confidence - limited data, use with caution.'
    }`;
  };

  // Get top coverages
  const topCoverages = Object.entries(opponentProfile.coverageDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([coverage, count]) => ({
      coverage,
      percentage: Math.round((count / opponentProfile.totalPlaysAnalyzed) * 100)
    }));

  // Get high blitz situations
  const highBlitzSituations = Object.entries(opponentProfile.blitzRateBySituation)
    .filter(([_, rate]) => rate >= 40)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Format situation label
  const formatSituation = (situationId: string) => {
    const labels: Record<string, string> = {
      '1st_down': '1st Down',
      '2nd_short': '2nd & Short',
      '2nd_medium': '2nd & Medium',
      '2nd_long': '2nd & Long',
      '3rd_short': '3rd & Short',
      '3rd_medium': '3rd & Medium',
      '3rd_long': '3rd & Long',
      '4th_short': '4th & Short',
      'red_zone': 'Red Zone',
      'goal_line': 'Goal Line'
    };
    return labels[situationId] || situationId;
  };

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">No Opponent Film Data</h3>
            <p className="text-sm text-gray-600 mt-1">
              Tag opponent plays in the Film section (with &quot;Opponent Play&quot; checked) to see tendencies for {opponentName}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900">Opponent Tendencies</h2>
          <p className="text-sm text-gray-600">{opponentName} defensive analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 cursor-help"
            title={getConfidenceTooltip()}
          >
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">
              {opponentProfile.totalPlaysAnalyzed} opponent plays analyzed ({getConfidenceLabel()})
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <>
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Blitz Rate */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Overall Blitz Rate</span>
          </div>
          <span className={`text-2xl font-bold ${
            opponentProfile.blitzRate >= 40 ? 'text-red-600' :
            opponentProfile.blitzRate >= 25 ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {opponentProfile.blitzRate}%
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {opponentProfile.blitzRate >= 40 ? 'Aggressive' :
             opponentProfile.blitzRate >= 25 ? 'Moderate' :
             'Conservative'}
          </p>
        </div>

        {/* Run Stop Rate */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Run Stop Rate</span>
          </div>
          <span className={`text-2xl font-bold ${
            opponentProfile.runStopRate >= 60 ? 'text-red-600' :
            opponentProfile.runStopRate >= 40 ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {opponentProfile.runStopRate}%
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {opponentProfile.runStopRate >= 60 ? 'Strong vs Run' :
             opponentProfile.runStopRate >= 40 ? 'Average vs Run' :
             'Weak vs Run'}
          </p>
        </div>

        {/* Pass Defense Rate */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Pass Defense</span>
          </div>
          <span className={`text-2xl font-bold ${
            opponentProfile.passDefenseRate >= 60 ? 'text-red-600' :
            opponentProfile.passDefenseRate >= 40 ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {opponentProfile.passDefenseRate}%
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {opponentProfile.passDefenseRate >= 60 ? 'Strong vs Pass' :
             opponentProfile.passDefenseRate >= 40 ? 'Average vs Pass' :
             'Weak vs Pass'}
          </p>
        </div>

        {/* Top Coverage */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase">Primary Coverage</span>
          </div>
          {topCoverages.length > 0 ? (
            <div>
              <span className="text-lg font-bold text-gray-900">
                {topCoverages[0].coverage}
              </span>
              <span className="text-sm text-gray-500 ml-2">
                ({topCoverages[0].percentage}%)
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-gray-400">Unknown</span>
          )}
        </div>
      </div>

      {/* Coverage Distribution */}
      {topCoverages.length > 0 && (
        <div className="px-4 pb-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Coverage Distribution</h4>
          <div className="space-y-2">
            {topCoverages.map(({ coverage, percentage }) => (
              <div key={coverage} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-700 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-600 w-24 text-right">
                  {coverage} ({percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Blitz Situations */}
      {highBlitzSituations.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <h4 className="text-xs font-medium text-red-600 uppercase mb-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            High Blitz Situations
          </h4>
          <div className="flex flex-wrap gap-2">
            {highBlitzSituations.map(([situation, rate]) => (
              <span
                key={situation}
                className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium"
              >
                {formatSituation(situation)}: {rate}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Recommendations</h4>
        <ul className="space-y-1 text-sm text-gray-600">
          {opponentProfile.blitzRate >= 40 && (
            <li>• Use quick passes and screens to exploit blitz-heavy approach</li>
          )}
          {opponentProfile.blitzRate < 25 && (
            <li>• Take shots downfield - opponent rarely brings extra pressure</li>
          )}
          {opponentProfile.runStopRate < 40 && (
            <li>• Establish the run - opponent struggles to stop ground game</li>
          )}
          {opponentProfile.runStopRate >= 60 && (
            <li>• Mix in play-action and misdirection - opponent is aggressive vs run</li>
          )}
          {opponentProfile.passDefenseRate < 40 && (
            <li>• Attack through the air - opponent vulnerable in coverage</li>
          )}
          {opponentProfile.passDefenseRate >= 60 && (
            <li>• Establish the run to open up play-action opportunities</li>
          )}
          {topCoverages[0]?.coverage?.toLowerCase().includes('3') && (
            <li>• Target the seams and deep posts against Cover 3</li>
          )}
          {topCoverages[0]?.coverage?.toLowerCase().includes('2') && (
            <li>• Attack the middle of the field against Cover 2</li>
          )}
          {topCoverages[0]?.coverage?.toLowerCase().includes('man') && (
            <li>• Use pick plays and crossing routes against man coverage</li>
          )}
          {topCoverages[0]?.coverage?.toLowerCase().includes('1') && !topCoverages[0]?.coverage?.toLowerCase().includes('man') && (
            <li>• Use motion to identify man coverage and create mismatches</li>
          )}
          {highBlitzSituations.length > 0 && (
            <li>• Have hot routes ready in {highBlitzSituations.map(([s]) => formatSituation(s)).join(', ')}</li>
          )}
        </ul>
      </div>
      </>
      )}
    </div>
  );
}
