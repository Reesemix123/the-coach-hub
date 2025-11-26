/**
 * PlaceholderReport Component
 *
 * Temporary component shown for reports that haven't been implemented yet.
 */

'use client';

import { ReportProps } from '@/types/reports';

interface PlaceholderReportProps extends ReportProps {
  reportName: string;
}

export default function PlaceholderReport({
  reportName,
  teamId,
  filters,
}: PlaceholderReportProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {reportName}
        </h3>
        <p className="text-gray-600 mb-6">
          This report is coming soon. We're working on building out comprehensive analytics
          for your team.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-left">
          <p className="text-sm font-medium text-gray-700 mb-2">Current Filters:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>Team ID: {teamId}</li>
            {filters.gameId && <li>Game: {filters.gameId}</li>}
            {filters.opponent && <li>Opponent: {filters.opponent}</li>}
            {filters.playerId && <li>Player: {filters.playerId}</li>}
            {!filters.gameId && !filters.opponent && !filters.playerId && (
              <li className="text-gray-400 italic">No filters applied</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
