/**
 * Down Breakdown Section (Offense)
 *
 * Shows success rates by down and red zone performance.
 * Available at Season and Game levels.
 *
 * Metrics (all tiers):
 * - 1st Down Success Rate
 * - 2nd Down Success Rate
 * - 3rd Down Conversion Rate
 * - Red Zone TD Rate
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import Tooltip from '../Tooltip';
import StatList from '../StatList';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface DownBreakdownSectionProps {
  data: {
    firstDownStats: {
      plays: number;
      successRate: number;
    };
    secondDownStats: {
      plays: number;
      successRate: number;
    };
    thirdDownStats: {
      plays: number;
      conversions: number;
      successRate: number;
    };
    redZoneSuccessRate: number;
    redZoneTouchdowns: number;
  };
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function DownBreakdownSection({
  data,
  viewMode,
  level,
  gameName,
}: DownBreakdownSectionProps) {
  const title = level === 'game'
    ? `Down Breakdown - ${gameName || 'Game'}`
    : 'Down Breakdown - Season';

  return (
    <CollapsibleSection
      id="offense-down-breakdown"
      title={title}
      defaultExpanded={false}
    >
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Tooltip content={METRIC_DEFINITIONS.firstDownSuccess}>
                <span>1st Down</span>
              </Tooltip>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{data.firstDownStats.successRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-1">{data.firstDownStats.plays} plays</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Tooltip content={METRIC_DEFINITIONS.secondDownSuccess}>
                <span>2nd Down</span>
              </Tooltip>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{data.secondDownStats.successRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-1">{data.secondDownStats.plays} plays</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Tooltip content={METRIC_DEFINITIONS.thirdDownConversion}>
                <span>3rd Down</span>
              </Tooltip>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{data.thirdDownStats.successRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-1">{data.thirdDownStats.conversions} conversions</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 print-keep-together">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Tooltip content={METRIC_DEFINITIONS.redZoneTD}>
                <span>Red Zone</span>
              </Tooltip>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{data.redZoneSuccessRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-1">{data.redZoneTouchdowns} TDs</div>
          </div>
        </div>
      ) : (
        <StatList
          stats={[
            {
              label: '1st Down Success',
              value: `${data.firstDownStats.successRate.toFixed(0)}% (${data.firstDownStats.plays} plays)`,
              tooltip: METRIC_DEFINITIONS.firstDownSuccess,
            },
            {
              label: '2nd Down Success',
              value: `${data.secondDownStats.successRate.toFixed(0)}% (${data.secondDownStats.plays} plays)`,
              tooltip: METRIC_DEFINITIONS.secondDownSuccess,
            },
            {
              label: '3rd Down Conv',
              value: `${data.thirdDownStats.successRate.toFixed(0)}% (${data.thirdDownStats.conversions} conv)`,
              tooltip: METRIC_DEFINITIONS.thirdDownConversion,
            },
            {
              label: 'Red Zone TD',
              value: `${data.redZoneSuccessRate.toFixed(0)}% (${data.redZoneTouchdowns} TDs)`,
              tooltip: METRIC_DEFINITIONS.redZoneTD,
            },
          ]}
          columns={2}
        />
      )}
    </CollapsibleSection>
  );
}
