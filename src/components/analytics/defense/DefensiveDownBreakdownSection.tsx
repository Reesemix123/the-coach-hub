/**
 * Defensive Down Breakdown Section
 *
 * Shows defensive success rates by down (opponent failure rates).
 * Available at Season and Game levels.
 *
 * Metrics (all tiers):
 * - 1st Down Defensive Success Rate
 * - 2nd Down Defensive Success Rate
 * - 3rd Down Stop Rate
 * - 4th Down Stop Rate
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import StatList from '../StatList';

interface DownStat {
  down: number;
  plays: number;
  yardsAllowed: number;
  yardsAllowedPerPlay: number;
  defensiveSuccessRate: number;
  stopRate: number;
  turnovers: number;
  turnoverRate: number;
}

interface DefensiveDownBreakdownSectionProps {
  data: DownStat[];
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function DefensiveDownBreakdownSection({
  data,
  viewMode,
  level,
  gameName,
}: DefensiveDownBreakdownSectionProps) {
  const title = level === 'game'
    ? `Defensive Down Breakdown - ${gameName || 'Game'}`
    : 'Defensive Down Breakdown - Season';

  // Find stats for each down
  const first = data.find(d => d.down === 1);
  const second = data.find(d => d.down === 2);
  const third = data.find(d => d.down === 3);
  const fourth = data.find(d => d.down === 4);

  return (
    <CollapsibleSection
      id="defense-down-breakdown"
      title={title}
      defaultExpanded={false}
    >
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1st Down */}
          {first && (
            <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
              <div className="text-sm font-medium text-gray-700 mb-2">1st Down</div>
              <div className="text-2xl font-semibold text-gray-900">
                {first.defensiveSuccessRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">{first.plays} plays</div>
              <div className="text-xs text-gray-600 mt-2">
                {first.yardsAllowedPerPlay.toFixed(1)} yds/play
              </div>
            </div>
          )}

          {/* 2nd Down */}
          {second && (
            <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
              <div className="text-sm font-medium text-gray-700 mb-2">2nd Down</div>
              <div className="text-2xl font-semibold text-gray-900">
                {second.defensiveSuccessRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">{second.plays} plays</div>
              <div className="text-xs text-gray-600 mt-2">
                {second.yardsAllowedPerPlay.toFixed(1)} yds/play
              </div>
            </div>
          )}

          {/* 3rd Down */}
          {third && (
            <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
              <div className="text-sm font-medium text-gray-700 mb-2">3rd Down</div>
              <div className="text-2xl font-semibold text-gray-900">
                {third.stopRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">{third.plays} plays</div>
              <div className="text-xs text-gray-600 mt-2">
                Stop rate (prevented 1st)
              </div>
            </div>
          )}

          {/* 4th Down */}
          {fourth && (
            <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
              <div className="text-sm font-medium text-gray-700 mb-2">4th Down</div>
              <div className="text-2xl font-semibold text-gray-900">
                {fourth.stopRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">{fourth.plays} plays</div>
              <div className="text-xs text-gray-600 mt-2">
                Stop rate
              </div>
            </div>
          )}
        </div>
      ) : (
        <StatList
          stats={[
            first && {
              label: '1st Down Success',
              value: `${first.defensiveSuccessRate.toFixed(0)}% (${first.plays} plays, ${first.yardsAllowedPerPlay.toFixed(1)} yds/play)`,
            },
            second && {
              label: '2nd Down Success',
              value: `${second.defensiveSuccessRate.toFixed(0)}% (${second.plays} plays, ${second.yardsAllowedPerPlay.toFixed(1)} yds/play)`,
            },
            third && {
              label: '3rd Down Stop',
              value: `${third.stopRate.toFixed(0)}% (${third.plays} plays)`,
            },
            fourth && {
              label: '4th Down Stop',
              value: `${fourth.stopRate.toFixed(0)}% (${fourth.plays} plays)`,
            },
          ].filter(Boolean) as Array<{ label: string; value: string }>}
          columns={2}
        />
      )}

      {/* Detailed Table */}
      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Down</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Plays</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yds Allowed</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Yds/Play</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Def Success %</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Stop %</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Turnovers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No defensive down data available. Tag opponent plays in Film Room to see stats.
                </td>
              </tr>
            ) : (
              data.map((stat) => (
                <tr key={stat.down} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {stat.down === 1 ? '1st' : stat.down === 2 ? '2nd' : stat.down === 3 ? '3rd' : '4th'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{stat.plays}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{stat.yardsAllowed}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{stat.yardsAllowedPerPlay.toFixed(1)}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={stat.defensiveSuccessRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {stat.defensiveSuccessRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    <span className={stat.stopRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                      {stat.stopRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {stat.turnovers} ({stat.turnoverRate.toFixed(1)}%)
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-600 mt-6">
        <strong>Defensive Success Rate:</strong> Opponent failed to gain expected yards (1st: &lt;40%, 2nd: &lt;60%, 3rd/4th: failed to convert).
        {' '}<strong>Stop Rate:</strong> Opponent did not get a first down on this play.
      </p>
    </CollapsibleSection>
  );
}
