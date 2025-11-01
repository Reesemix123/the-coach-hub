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
  level: 'season' | 'game';
  gameName?: string;
}

export default function DownBreakdownSection({
  data,
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
    </CollapsibleSection>
  );
}
