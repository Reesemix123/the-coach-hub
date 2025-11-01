/**
 * StatList Component
 *
 * Compact stat display for "list" view mode.
 * Shows multiple stats in a dense, easy-to-scan format with optional tooltips.
 *
 * @example
 * <StatList
 *   stats={[
 *     { label: 'Total Plays', value: '456', tooltip: METRIC_DEFINITIONS.totalPlays },
 *     { label: 'YPP', value: '5.2', tooltip: METRIC_DEFINITIONS.yardsPerPlay },
 *     { label: 'Success Rate', value: '48%', tooltip: METRIC_DEFINITIONS.successRate },
 *   ]}
 *   columns={3}
 * />
 */

import Tooltip from './Tooltip';
import type { MetricDefinition } from '@/lib/analytics/metricDefinitions';

interface Stat {
  label: string;
  value: string | number;
  tooltip?: MetricDefinition;
}

interface StatListProps {
  stats: Stat[];
  columns?: 2 | 3 | 4;
}

export default function StatList({
  stats,
  columns = 3,
}: StatListProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-x-12 gap-y-3`}>
      {stats.map((stat, index) => (
        <div key={index} className="flex items-baseline gap-2 border-b border-gray-200 pb-2">
          {stat.tooltip ? (
            <Tooltip content={stat.tooltip}>
              <span className="text-sm text-gray-600 whitespace-nowrap">{stat.label}:</span>
            </Tooltip>
          ) : (
            <span className="text-sm text-gray-600 whitespace-nowrap">{stat.label}:</span>
          )}
          <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
