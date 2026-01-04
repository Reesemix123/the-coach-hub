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
  hint?: string; // Brief hover explanation (few words)
}

export default function StatCard({
  label,
  value,
  subtitle,
  color = 'default',
  tooltip,
  hint,
}: StatCardProps) {
  const colorClasses = {
    default: 'bg-gray-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-6 print:bg-white print:border print:border-gray-200`}>
      <div className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-1 break-words relative group/hint">
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span>{label}</span>
          </Tooltip>
        ) : hint ? (
          <span className="cursor-help">{label}</span>
        ) : (
          <span>{label}</span>
        )}
        {hint && !tooltip && (
          <>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Hint tooltip - positioned just above the label */}
            <div className="absolute left-0 bottom-full mb-1 opacity-0 group-hover/hint:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-white text-gray-600 text-xs rounded-md px-3 py-1.5 shadow-md border border-gray-200 whitespace-nowrap">
                {hint}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="text-4xl font-semibold text-gray-900 break-words overflow-hidden">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-2 break-words">{subtitle}</div>
      )}
    </div>
  );
}
