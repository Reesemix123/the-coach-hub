/**
 * All RB Stats Section
 *
 * Shows statistics for ALL running backs on the team in a table format.
 * Available at Player level (Tier 2+).
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';

interface RBStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;

  // Rushing
  carries: number;
  rushingYards: number;
  yardsPerCarry: number;
  rushingTouchdowns: number;
  longRun: number;
  rushingSuccessRate: number;
  runsOf10Plus: number;

  // Receiving
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  yardsPerReception: number;

  // Combined
  totalTouches: number;
  totalYards: number;
  totalTouchdowns: number;
  yardsPerTouch: number;
}

interface AllRBStatsSectionProps {
  data: RBStats[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function AllRBStatsSection({
  data,
  viewMode,
  level,
  gameName,
}: AllRBStatsSectionProps) {
  const title = level === 'game'
    ? `RB Stats - ${gameName || 'Game'}`
    : 'RB Stats - Season';

  if (!data || data.length === 0) {
    return (
      <CollapsibleSection
        id="offense-all-rb-stats"
        title={title}
        badge="Tier 2+"
        badgeColor="blue"
        defaultExpanded={true}
      >
        <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No RB data available. Tag plays with ball carrier attribution in Film Room to see stats.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="offense-all-rb-stats"
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Car</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rush Yds</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">YPC</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rush TD</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Success %</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rec Yds</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Yds</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total TD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((rb) => (
                <tr key={rb.playerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{rb.jerseyNumber} {rb.playerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {rb.carries}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {rb.rushingYards}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {rb.yardsPerCarry.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{rb.rushingTouchdowns}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={rb.rushingSuccessRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {rb.rushingSuccessRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {rb.receptions}/{rb.targets}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {rb.receivingYards}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="font-semibold">{rb.totalYards}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className="text-green-600 font-semibold">{rb.totalTouchdowns}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Success Rate:</strong> Carries that gained expected yards based on down and distance (1st: 40%+, 2nd: 60%+, 3rd/4th: conversion).
        {' '}<strong>Total Yards:</strong> Combined rushing and receiving yards.
      </p>
    </CollapsibleSection>
  );
}
