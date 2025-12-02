import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import { StationData } from '@/lib/services/game-week.service';

interface StationProps {
  station: StationData;
  large?: boolean;
}

export default function Station({ station, large = false }: StationProps) {
  const { name, status, metrics, primaryAction, secondaryActions, comingSoon, badge } = station;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow ${large ? 'p-8' : 'p-6'}`}>
      {/* Header with status and badge */}
      <div className={`flex items-center justify-between ${large ? 'mb-6' : 'mb-4'}`}>
        <div className="flex items-center gap-3">
          <h3 className={`font-semibold text-gray-900 ${large ? 'text-2xl' : 'text-xl'}`}>{name}</h3>
          {badge && badge > 0 && (
            <span className={`px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded-full ${large ? 'text-sm' : 'text-xs'}`}>
              {badge}
            </span>
          )}
        </div>
        <StatusIndicator status={status} large={large} />
      </div>

      {/* Coming Soon Badge */}
      {comingSoon && (
        <div className={`px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg ${large ? 'mb-6' : 'mb-4'}`}>
          <span className="text-sm text-amber-800">{comingSoon}</span>
        </div>
      )}

      {/* Metrics */}
      <div className={`${large ? 'space-y-4 mb-8' : 'space-y-3 mb-6'}`}>
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className={`text-gray-600 ${large ? 'text-base' : 'text-sm'}`}>{metric.label}</span>
            <span className={`font-semibold text-gray-900 ${large ? 'text-base' : 'text-sm'}`}>{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className={`${large ? 'space-y-4' : 'space-y-3'}`}>
        {/* Primary Action */}
        <Link
          href={primaryAction.href}
          className={`block w-full bg-black text-white text-center rounded-lg hover:bg-gray-800 transition-colors font-medium ${large ? 'px-6 py-4 text-lg' : 'px-4 py-3'}`}
        >
          {primaryAction.label}
        </Link>

        {/* Secondary Actions */}
        {secondaryActions.length > 0 && (
          <details className="group">
            <summary className={`cursor-pointer text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 list-none ${large ? 'text-base' : 'text-sm'}`}>
              More Actions
              <ChevronDown className={`group-open:rotate-180 transition-transform ${large ? 'w-5 h-5' : 'w-4 h-4'}`} />
            </summary>

            <div className={`mt-3 space-y-1 border-t pt-3`}>
              {secondaryActions.map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className={`block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded ${large ? 'text-base' : 'text-sm'}`}
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
