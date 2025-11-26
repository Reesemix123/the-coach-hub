/**
 * Situational Report
 *
 * Performance analysis by down, distance, field position, and game context.
 */

'use client';

import { ReportProps } from '@/types/reports';

export default function SituationalReport({ teamId, gameId, filters }: ReportProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Analyze performance by down, distance, and field position
        </p>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Situational Analytics Coming Soon
          </h3>
          <p className="text-gray-600 mb-4">
            We're building detailed situational analysis including:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 text-left bg-white rounded-lg p-4">
            <li>• Down & distance performance breakdown</li>
            <li>• Field position analysis</li>
            <li>• Score differential performance</li>
            <li>• Quarter and time situation trends</li>
            <li>• Red zone and goal line efficiency</li>
          </ul>
          <p className="text-sm text-gray-500 mt-4">
            For now, you can view some of these metrics in the Offensive and Defensive Reports.
          </p>
        </div>
      </div>
    </div>
  );
}
