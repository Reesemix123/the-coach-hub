import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import { StationData } from '@/lib/services/game-week.service';

interface StationProps {
  station: StationData;
}

export default function Station({ station }: StationProps) {
  const { name, status, metrics, primaryAction, secondaryActions } = station;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{name}</h3>
        <StatusIndicator status={status} />
      </div>

      {/* Metrics */}
      <div className="space-y-3 mb-6">
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{metric.label}</span>
            <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Primary Action */}
        <Link
          href={primaryAction.href}
          className="block w-full px-4 py-3 bg-black text-white text-center rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          {primaryAction.label}
        </Link>

        {/* Secondary Actions */}
        {secondaryActions.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 list-none">
              More Actions
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </summary>

            <div className="mt-2 space-y-1 border-t pt-2">
              {secondaryActions.map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
