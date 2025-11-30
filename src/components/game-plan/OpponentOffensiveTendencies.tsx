'use client';

import { useState } from 'react';
import { AlertCircle, TrendingUp, BarChart3, ChevronDown, ChevronUp, Info, Footprints, Target } from 'lucide-react';
import type { OpponentOffensiveProfile } from '@/types/football';

interface OpponentOffensiveTendenciesProps {
  opponentProfile: OpponentOffensiveProfile;
  opponentName: string;
}

export default function OpponentOffensiveTendencies({
  opponentProfile,
  opponentName
}: OpponentOffensiveTendenciesProps) {
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

  // Format down label
  const formatDown = (downKey: string) => {
    const labels: Record<string, string> = {
      'down_1': '1st Down',
      'down_2': '2nd Down',
      'down_3': '3rd Down',
      'down_4': '4th Down'
    };
    return labels[downKey] || downKey;
  };

  // Get top run concepts
  const topRunConcepts = Object.entries(opponentProfile.runConceptDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Get top pass concepts
  const topPassConcepts = Object.entries(opponentProfile.passConceptDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">No Opponent Offensive Data</h3>
            <p className="text-sm text-gray-600 mt-1">
              Tag opponent offensive plays in the Film section (with &quot;Opponent Play&quot; checked) to see {opponentName}&apos;s offensive tendencies.
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
          <h2 className="text-lg font-semibold text-gray-900">Opponent Offensive Tendencies</h2>
          <p className="text-sm text-gray-600">{opponentName} offensive analysis</p>
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
          {/* Run/Pass Split */}
          <div className="p-4 grid grid-cols-2 gap-4">
            {/* Run Percentage */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Footprints className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">Run Rate</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${
                  opponentProfile.runPercentage >= 55 ? 'text-amber-600' :
                  opponentProfile.runPercentage >= 45 ? 'text-gray-900' :
                  'text-blue-600'
                }`}>
                  {opponentProfile.runPercentage}%
                </span>
                <span className="text-sm text-gray-500">
                  {opponentProfile.avgYardsPerRun.toFixed(1)} YPC
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {opponentProfile.runPercentage >= 55 ? 'Run-Heavy' :
                 opponentProfile.runPercentage >= 45 ? 'Balanced' :
                 'Pass-Heavy'}
              </p>
            </div>

            {/* Pass Percentage */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">Pass Rate</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${
                  opponentProfile.passPercentage >= 55 ? 'text-blue-600' :
                  opponentProfile.passPercentage >= 45 ? 'text-gray-900' :
                  'text-amber-600'
                }`}>
                  {opponentProfile.passPercentage}%
                </span>
                <span className="text-sm text-gray-500">
                  {opponentProfile.avgYardsPerPass.toFixed(1)} YPA
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Avg {opponentProfile.avgYardsPerPlay.toFixed(1)} YPP overall
              </p>
            </div>

            {/* 3rd Down Conversion */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">3rd Down Conv.</span>
              </div>
              <span className={`text-2xl font-bold ${
                opponentProfile.thirdDownConversionRate >= 45 ? 'text-red-600' :
                opponentProfile.thirdDownConversionRate >= 35 ? 'text-amber-600' :
                'text-green-600'
              }`}>
                {opponentProfile.thirdDownConversionRate}%
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {opponentProfile.thirdDownConversionRate >= 45 ? 'Dangerous' :
                 opponentProfile.thirdDownConversionRate >= 35 ? 'Average' :
                 'Struggle'}
              </p>
            </div>

            {/* Red Zone Run Rate */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">Red Zone Run %</span>
              </div>
              <span className={`text-2xl font-bold ${
                opponentProfile.redZoneRunPercentage >= 60 ? 'text-amber-600' :
                opponentProfile.redZoneRunPercentage >= 40 ? 'text-gray-900' :
                'text-blue-600'
              }`}>
                {opponentProfile.redZoneRunPercentage}%
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {opponentProfile.redZoneRunPercentage >= 60 ? 'Ground & Pound' :
                 opponentProfile.redZoneRunPercentage >= 40 ? 'Balanced RZ' :
                 'Pass-Heavy RZ'}
              </p>
            </div>
          </div>

          {/* Top Formations */}
          {opponentProfile.topFormations.length > 0 && (
            <div className="px-4 pb-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Formation Tendencies</h4>
              <div className="space-y-2">
                {opponentProfile.topFormations.map(({ formation, percentage, runRate }) => (
                  <div key={formation} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-700 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 w-36 text-right">
                      {formation} ({percentage}%) - {runRate}% run
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run Concepts */}
          {topRunConcepts.length > 0 && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-amber-600 uppercase mb-2 flex items-center gap-1">
                <Footprints className="w-3 h-3" />
                Top Run Concepts
              </h4>
              <div className="flex flex-wrap gap-2">
                {topRunConcepts.map(([concept, percentage]) => (
                  <span
                    key={concept}
                    className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium"
                  >
                    {concept}: {percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pass Concepts */}
          {topPassConcepts.length > 0 && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-blue-600 uppercase mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" />
                Top Pass Concepts
              </h4>
              <div className="flex flex-wrap gap-2">
                {topPassConcepts.map(([concept, percentage]) => (
                  <span
                    key={concept}
                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                  >
                    {concept}: {percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Down-by-Down Analysis */}
          {Object.keys(opponentProfile.tendenciesByDown).length > 0 && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">By Down</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(opponentProfile.tendenciesByDown)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([down, tendency]) => (
                    <div key={down} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium text-gray-700">{formatDown(down)}</span>
                      <div className="text-gray-500 mt-1">
                        Run: {tendency.runPercentage}% | Pass: {tendency.passPercentage}%
                      </div>
                      <div className="text-gray-400">
                        Avg: {tendency.avgYards.toFixed(1)} yds
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Defensive Recommendations */}
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Defensive Recommendations</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {opponentProfile.runPercentage >= 55 && (
                <li>• Load the box - opponent is run-heavy ({opponentProfile.runPercentage}%)</li>
              )}
              {opponentProfile.passPercentage >= 55 && (
                <li>• Play coverage - opponent is pass-first ({opponentProfile.passPercentage}%)</li>
              )}
              {opponentProfile.thirdDownConversionRate >= 45 && (
                <li>• Be aggressive on 3rd down - they convert {opponentProfile.thirdDownConversionRate}%</li>
              )}
              {opponentProfile.passingDownRunRate >= 30 && (
                <li>• Stay honest on passing downs - they run {opponentProfile.passingDownRunRate}% on obvious passing situations</li>
              )}
              {opponentProfile.topFormations[0]?.percentage >= 40 && (
                <li>• Prepare for {opponentProfile.topFormations[0].formation} ({opponentProfile.topFormations[0].percentage}% usage)</li>
              )}
              {opponentProfile.redZoneRunPercentage >= 60 && (
                <li>• Stack the box in red zone - they run {opponentProfile.redZoneRunPercentage}%</li>
              )}
              {topRunConcepts[0] && (
                <li>• Key on {topRunConcepts[0][0]} - their top run concept ({topRunConcepts[0][1]}%)</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
