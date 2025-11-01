/**
 * StatCard Component
 *
 * Large stat display card for "cards" view mode.
 * Shows single metric prominently with optional subtitle and tooltip.
 *
 * @example
 * <StatCard
 *   label="Yards Per Play"
 *   value="5.2"
 *   subtitle="456 total plays"
 *   color="blue"
 *   tooltip={METRIC_DEFINITIONS.yardsPerPlay}
 * />
 */

import Tooltip from './Tooltip';
import type { MetricDefinition } from '@/lib/analytics/metricDefinitions';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'default' | 'blue' | 'green' | 'red';
  tooltip?: MetricDefinition;
}

export default function StatCard({
  label,
  value,
  subtitle,
  color = 'default',
  tooltip,
}: StatCardProps) {
  const colorClasses = {
    default: 'bg-gray-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-6 print:bg-white print:border print:border-gray-200`}>
      <div className="text-4xl font-semibold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-2 flex items-center gap-1">
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span>{label}</span>
          </Tooltip>
        ) : (
          <span>{label}</span>
        )}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
