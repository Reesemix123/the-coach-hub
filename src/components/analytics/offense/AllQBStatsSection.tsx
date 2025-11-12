/**
 * All QB Stats Section
 *
 * Shows statistics for ALL quarterbacks on the team in a table format.
 * Available at Player level (Tier 2+).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface QBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Passing
  attempts: number;
  completions: number;
  completionPct: number;
  passingYards: number;
  yardsPerAttempt: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  successRate: number;

  // Decision Quality (Tier 3)
  excellentDecisions?: number;
  goodDecisions?: number;
  poorDecisions?: number;
  decisionGrade?: number;

  // Pressure (Tier 3)
  pressuredDropbacks?: number;
  pressureRate?: number;
  yardsUnderPressure?: number;
}

interface AllQBStatsSectionProps {
  data: QBStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
  tier3Enabled: boolean;
}

export default function AllQBStatsSection({
  data,
  viewMode,
  level,
  gameName,
  tier3Enabled,
}: AllQBStatsSectionProps) {
  const title = level === 'game'
    ? `QB Stats - ${gameName || 'Game'}`
    : 'QB Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="offense-all-qb-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No QB data available. Tag plays with QB attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-all-qb-stats"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
      defaultExpanded={true}
    >
      {/* Stats Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Comp/Att</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">%</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yards</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPA</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">TD</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">INT</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Sacks</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Success %</th>
                {tier3Enabled && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Decision</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Pressure %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((qb) => (
                <tr key={qb.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{qb.jerseyNumber} {qb.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {qb.completions}/{qb.attempts}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {qb.completionPct.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {qb.passingYards}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {qb.yardsPerAttempt.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{qb.touchdowns}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-red-600 font-semibold">{qb.interceptions}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {qb.sacks}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={qb.successRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {qb.successRate.toFixed(1)}%
                    </span>
                  </td>
                  {tier3Enabled && (
                    <>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.decisionGrade !== undefined ? qb.decisionGrade.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {qb.pressureRate !== undefined ? `${qb.pressureRate.toFixed(1)}%` : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Success Rate:</strong> Passes that gained expected yards based on down and distance (1st: 40%+, 2nd: 60%+, 3rd/4th: conversion).
        {tier3Enabled && (
          <>
            {' '}<strong>Decision Grade:</strong> Average of decision quality (0=poor, 1=good, 2=excellent).
            {' '}<strong>Pressure %:</strong> Percentage of dropbacks where QB was pressured.
          </>
        )}
      </p>
    </CollapsibleSection>
  );
}
