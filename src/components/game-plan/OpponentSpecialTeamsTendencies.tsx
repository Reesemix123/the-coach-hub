'use client';

import { useState } from 'react';
import { AlertCircle, TrendingUp, Target, ChevronDown, ChevronUp, Info, Zap, CircleDot } from 'lucide-react';
import type { OpponentSpecialTeamsProfile } from '@/types/football';

interface OpponentSpecialTeamsTendenciesProps {
  opponentProfile: OpponentSpecialTeamsProfile;
  opponentName: string;
}

export default function OpponentSpecialTeamsTendencies({
  opponentProfile,
  opponentName
}: OpponentSpecialTeamsTendenciesProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'kicking' | 'returning' | 'scoring'>('kicking');

  const hasData = opponentProfile.totalPlaysAnalyzed > 0;

  // Get confidence label based on sample size
  const getConfidenceLabel = () => {
    const plays = opponentProfile.totalPlaysAnalyzed;
    if (plays >= 30) return 'High confidence';
    if (plays >= 15) return 'Medium confidence';
    return 'Low confidence';
  };

  const getConfidenceTooltip = () => {
    const plays = opponentProfile.totalPlaysAnalyzed;
    return `Based on ${plays} opponent ST plays analyzed. ${
      plays >= 30 ? 'High confidence - strong sample size.' :
      plays >= 15 ? 'Medium confidence - reasonable sample size.' :
      'Low confidence - limited data, use with caution.'
    }`;
  };

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">No Opponent Special Teams Data</h3>
            <p className="text-sm text-gray-600 mt-1">
              Tag opponent special teams plays in the Film section (with &quot;Opponent Play&quot; checked and a special teams unit selected) to see tendencies for {opponentName}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatPercent = (value: number) => `${Math.round(value)}%`;
  const formatNumber = (value: number, decimals: number = 1) =>
    value.toFixed(decimals).replace(/\.0$/, '');

  // Get direction tendencies (for kickoff/punt)
  const getDirectionLabel = (distribution: Record<string, number>) => {
    const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return 'N/A';
    const [direction, count] = entries[0];
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `${direction} (${pct}%)`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900">Opponent Special Teams Tendencies</h2>
          <p className="text-sm text-gray-600">{opponentName} special teams analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 cursor-help"
            title={getConfidenceTooltip()}
          >
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">
              {opponentProfile.totalPlaysAnalyzed} ST plays analyzed ({getConfidenceLabel()})
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
          {/* Tab buttons */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('kicking')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'kicking'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kickoff & Punt
            </button>
            <button
              onClick={() => setActiveTab('returning')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'returning'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kick Return & Punt Return
            </button>
            <button
              onClick={() => setActiveTab('scoring')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'scoring'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              FG/PAT
            </button>
          </div>

          {/* Kicking Tab */}
          {activeTab === 'kicking' && (
            <div className="p-4">
              {/* Kickoff Section */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Kickoffs ({opponentProfile.kickoff.plays} plays)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Distance</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNumber(opponentProfile.kickoff.avgDistance, 0)} yds
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Touchback Rate</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatPercent(opponentProfile.kickoff.touchbackRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Onside Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.kickoff.onsideAttemptRate > 5 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.kickoff.onsideAttemptRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Primary Direction</div>
                    <div className="text-lg font-bold text-gray-900">
                      {getDirectionLabel(opponentProfile.kickoff.directionDistribution)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Punt Section */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Punts ({opponentProfile.punt.plays} plays)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Distance</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNumber(opponentProfile.punt.avgDistance, 0)} yds
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Hang Time</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNumber(opponentProfile.punt.avgHangTime, 1)}s
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Inside 20 Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.punt.insideThe20Rate > 40 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.punt.insideThe20Rate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Fake Attempt Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.punt.fakeAttemptRate > 5 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.punt.fakeAttemptRate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Returning Tab */}
          {activeTab === 'returning' && (
            <div className="p-4">
              {/* Kick Return Section */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Kick Returns ({opponentProfile.kickReturn.plays} plays)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Return</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNumber(opponentProfile.kickReturn.avgReturnYards, 0)} yds
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Touchback Rate</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatPercent(opponentProfile.kickReturn.touchbackRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Return TD Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.kickReturn.returnTDRate > 5 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.kickReturn.returnTDRate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Punt Return Section */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Punt Returns ({opponentProfile.puntReturn.plays} plays)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Return</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNumber(opponentProfile.puntReturn.avgReturnYards, 0)} yds
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Fair Catch Rate</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatPercent(opponentProfile.puntReturn.fairCatchRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Block Attempt Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.puntReturn.blockAttemptRate > 10 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.puntReturn.blockAttemptRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Return TD Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.puntReturn.returnTDRate > 5 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.puntReturn.returnTDRate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FG/PAT Tab */}
          {activeTab === 'scoring' && (
            <div className="p-4">
              {/* Field Goal Section */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Field Goals ({opponentProfile.fieldGoal.plays} attempts)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Overall Accuracy</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.fieldGoal.overallAccuracy >= 80 ? 'text-red-600' :
                      opponentProfile.fieldGoal.overallAccuracy >= 60 ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {formatPercent(opponentProfile.fieldGoal.overallAccuracy)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Block Rate (Against)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatPercent(opponentProfile.fieldGoal.blockRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Fake FG Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.fieldGoal.fakeAttemptRate > 5 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.fieldGoal.fakeAttemptRate)}
                    </div>
                  </div>
                </div>

                {/* FG Accuracy by Range */}
                {Object.keys(opponentProfile.fieldGoal.accuracyByRange).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">Accuracy by Range</div>
                    <div className="space-y-1">
                      {Object.entries(opponentProfile.fieldGoal.accuracyByRange)
                        .sort((a, b) => {
                          // Sort by range: 0-29, 30-39, 40-49, 50+
                          const rangeOrder: Record<string, number> = { '0-29': 1, '30-39': 2, '40-49': 3, '50+': 4 };
                          return (rangeOrder[a[0]] || 99) - (rangeOrder[b[0]] || 99);
                        })
                        .map(([range, accuracy]) => {
                          const attempts = opponentProfile.fieldGoal.attemptsByRange[range] || 0;
                          return (
                            <div key={range} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-12">{range}</span>
                              <div className="flex-1">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      accuracy >= 80 ? 'bg-red-500' :
                                      accuracy >= 60 ? 'bg-amber-500' :
                                      'bg-green-500'
                                    }`}
                                    style={{ width: `${accuracy}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 w-16 text-right">
                                {formatPercent(accuracy)} ({attempts})
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* PAT Section */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <CircleDot className="w-3 h-3" />
                  PAT/2-Point ({opponentProfile.pat.plays} plays)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">PAT Accuracy</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.pat.accuracy >= 95 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.pat.accuracy)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">2-Point Attempt Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.pat.twoPointAttemptRate > 15 ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.pat.twoPointAttemptRate)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                    <div className="text-xs text-gray-500 mb-1">2-Point Conversion Rate</div>
                    <div className={`text-xl font-bold ${
                      opponentProfile.pat.twoPointConversionRate >= 50 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatPercent(opponentProfile.pat.twoPointConversionRate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab-specific Key Insights */}
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Key Insights</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {/* Kickoff & Punt Tab Insights */}
              {activeTab === 'kicking' && (
                <>
                  {/* Kickoff insights */}
                  {opponentProfile.kickoff.avgDistance >= 60 ? (
                    <li className="text-red-700">• Strong-legged kicker (avg {formatNumber(opponentProfile.kickoff.avgDistance, 0)} yds) - expect deep kicks and touchbacks</li>
                  ) : opponentProfile.kickoff.avgDistance < 55 ? (
                    <li className="text-green-700">• Short kickoffs (avg {formatNumber(opponentProfile.kickoff.avgDistance, 0)} yds) - good return opportunities</li>
                  ) : (
                    <li>• Average kickoff distance ({formatNumber(opponentProfile.kickoff.avgDistance, 0)} yds)</li>
                  )}
                  {opponentProfile.kickoff.touchbackRate >= 50 && (
                    <li>• High touchback rate ({formatPercent(opponentProfile.kickoff.touchbackRate)}) - limited return chances</li>
                  )}
                  {opponentProfile.kickoff.touchbackRate < 30 && (
                    <li className="text-green-700">• Low touchback rate ({formatPercent(opponentProfile.kickoff.touchbackRate)}) - prepare return schemes</li>
                  )}
                  {opponentProfile.kickoff.onsideAttemptRate > 5 && (
                    <li className="text-amber-700">• Watch for surprise onside kicks ({formatPercent(opponentProfile.kickoff.onsideAttemptRate)} attempt rate)</li>
                  )}
                  {/* Punt insights */}
                  {opponentProfile.punt.avgDistance >= 42 ? (
                    <li className="text-red-700">• Strong punter (avg {formatNumber(opponentProfile.punt.avgDistance, 0)} yds) - field position battle</li>
                  ) : opponentProfile.punt.avgDistance < 35 ? (
                    <li className="text-green-700">• Weak punter (avg {formatNumber(opponentProfile.punt.avgDistance, 0)} yds) - good field position</li>
                  ) : null}
                  {opponentProfile.punt.avgHangTime >= 4.2 && (
                    <li className="text-amber-700">• Good hang time ({formatNumber(opponentProfile.punt.avgHangTime, 1)}s) - coverage arrives quickly</li>
                  )}
                  {opponentProfile.punt.avgHangTime > 0 && opponentProfile.punt.avgHangTime < 3.8 && (
                    <li className="text-green-700">• Low hang time ({formatNumber(opponentProfile.punt.avgHangTime, 1)}s) - return opportunities before coverage</li>
                  )}
                  {opponentProfile.punt.insideThe20Rate >= 40 && (
                    <li className="text-red-700">• Effective at pinning inside 20 ({formatPercent(opponentProfile.punt.insideThe20Rate)}) - consider fair catches</li>
                  )}
                  {opponentProfile.punt.fakeAttemptRate > 5 && (
                    <li className="text-amber-700">• Be alert for fake punts ({formatPercent(opponentProfile.punt.fakeAttemptRate)} attempt rate)</li>
                  )}
                </>
              )}

              {/* Kick Return & Punt Return Tab Insights */}
              {activeTab === 'returning' && (
                <>
                  {/* Kick return insights */}
                  {opponentProfile.kickReturn.avgReturnYards >= 25 ? (
                    <li className="text-red-700">• Dangerous kick returner (avg {formatNumber(opponentProfile.kickReturn.avgReturnYards, 0)} yds) - directional kick away from returner</li>
                  ) : opponentProfile.kickReturn.avgReturnYards < 18 ? (
                    <li className="text-green-700">• Limited kick return threat (avg {formatNumber(opponentProfile.kickReturn.avgReturnYards, 0)} yds) - kick it deep</li>
                  ) : (
                    <li>• Average kick return game ({formatNumber(opponentProfile.kickReturn.avgReturnYards, 0)} yds per return)</li>
                  )}
                  {opponentProfile.kickReturn.touchbackRate >= 50 && (
                    <li>• Often takes touchbacks ({formatPercent(opponentProfile.kickReturn.touchbackRate)}) - kick deep for free touchbacks</li>
                  )}
                  {opponentProfile.kickReturn.touchbackRate < 25 && (
                    <li className="text-amber-700">• Aggressive returner ({formatPercent(opponentProfile.kickReturn.touchbackRate)} TB rate) - they bring it out often</li>
                  )}
                  {opponentProfile.kickReturn.returnTDRate > 3 && (
                    <li className="text-red-700">• Return TD threat ({formatPercent(opponentProfile.kickReturn.returnTDRate)}) - contain lanes and tackle</li>
                  )}
                  {/* Punt return insights */}
                  {opponentProfile.puntReturn.avgReturnYards >= 12 ? (
                    <li className="text-red-700">• Dangerous punt returner (avg {formatNumber(opponentProfile.puntReturn.avgReturnYards, 0)} yds) - coverage lanes critical</li>
                  ) : opponentProfile.puntReturn.avgReturnYards < 6 ? (
                    <li className="text-green-700">• Limited punt return threat (avg {formatNumber(opponentProfile.puntReturn.avgReturnYards, 0)} yds)</li>
                  ) : (
                    <li>• Average punt return game ({formatNumber(opponentProfile.puntReturn.avgReturnYards, 0)} yds per return)</li>
                  )}
                  {opponentProfile.puntReturn.fairCatchRate >= 50 && (
                    <li className="text-green-700">• Often fair catches ({formatPercent(opponentProfile.puntReturn.fairCatchRate)}) - hang time is working</li>
                  )}
                  {opponentProfile.puntReturn.fairCatchRate < 25 && (
                    <li className="text-amber-700">• Rarely fair catches ({formatPercent(opponentProfile.puntReturn.fairCatchRate)}) - aggressive returner</li>
                  )}
                  {opponentProfile.puntReturn.blockAttemptRate > 10 && (
                    <li className="text-amber-700">• Aggressive punt rush ({formatPercent(opponentProfile.puntReturn.blockAttemptRate)} block attempts) - protect the punter</li>
                  )}
                  {opponentProfile.puntReturn.returnTDRate > 3 && (
                    <li className="text-red-700">• Punt return TD threat ({formatPercent(opponentProfile.puntReturn.returnTDRate)}) - force fair catches</li>
                  )}
                </>
              )}

              {/* FG/PAT Tab Insights */}
              {activeTab === 'scoring' && (
                <>
                  {/* Field goal insights */}
                  {opponentProfile.fieldGoal.overallAccuracy >= 80 ? (
                    <li className="text-red-700">• Accurate FG kicker ({formatPercent(opponentProfile.fieldGoal.overallAccuracy)}) - keep them out of FG range</li>
                  ) : opponentProfile.fieldGoal.overallAccuracy >= 60 ? (
                    <li className="text-amber-700">• Average FG kicker ({formatPercent(opponentProfile.fieldGoal.overallAccuracy)}) - pressure on long attempts</li>
                  ) : (
                    <li className="text-green-700">• Inconsistent FG kicker ({formatPercent(opponentProfile.fieldGoal.overallAccuracy)}) - make them kick</li>
                  )}
                  {/* Check for weak ranges */}
                  {Object.entries(opponentProfile.fieldGoal.accuracyByRange).map(([range, accuracy]) => {
                    if (accuracy < 50 && (opponentProfile.fieldGoal.attemptsByRange[range] || 0) >= 2) {
                      return <li key={range} className="text-green-700">• Struggles from {range} yards ({formatPercent(accuracy)}) - force kicks from this range</li>;
                    }
                    if (accuracy >= 90 && (opponentProfile.fieldGoal.attemptsByRange[range] || 0) >= 2) {
                      return <li key={range} className="text-red-700">• Automatic from {range} yards ({formatPercent(accuracy)}) - keep them out of this range</li>;
                    }
                    return null;
                  })}
                  {opponentProfile.fieldGoal.blockRate > 5 && (
                    <li className="text-green-700">• Gets blocked ({formatPercent(opponentProfile.fieldGoal.blockRate)}) - attack the block</li>
                  )}
                  {opponentProfile.fieldGoal.fakeAttemptRate > 5 && (
                    <li className="text-amber-700">• Watch for fake FGs ({formatPercent(opponentProfile.fieldGoal.fakeAttemptRate)} attempt rate)</li>
                  )}
                  {/* PAT insights */}
                  {opponentProfile.pat.accuracy >= 95 ? (
                    <li>• Reliable PAT kicker ({formatPercent(opponentProfile.pat.accuracy)})</li>
                  ) : opponentProfile.pat.accuracy < 85 ? (
                    <li className="text-green-700">• Shaky PAT kicker ({formatPercent(opponentProfile.pat.accuracy)}) - pressure opportunity</li>
                  ) : null}
                  {opponentProfile.pat.twoPointAttemptRate >= 20 && (
                    <li className="text-amber-700">• Frequently goes for 2 ({formatPercent(opponentProfile.pat.twoPointAttemptRate)}) - prepare 2-pt defense</li>
                  )}
                  {opponentProfile.pat.twoPointConversionRate >= 60 && opponentProfile.pat.twoPointAttemptRate > 10 && (
                    <li className="text-red-700">• Effective on 2-pt conversions ({formatPercent(opponentProfile.pat.twoPointConversionRate)}) - must stop their 2-pt plays</li>
                  )}
                  {opponentProfile.pat.twoPointConversionRate < 40 && opponentProfile.pat.twoPointAttemptRate > 10 && (
                    <li className="text-green-700">• Struggles on 2-pt conversions ({formatPercent(opponentProfile.pat.twoPointConversionRate)}) - force them to go for 2</li>
                  )}
                </>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
