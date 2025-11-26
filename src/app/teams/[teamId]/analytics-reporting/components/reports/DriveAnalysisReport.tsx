/**
 * Drive Analysis Report
 *
 * Drive-level performance metrics and efficiency for both offense and defense.
 */

'use client';

import { ReportProps } from '@/types/reports';

export default function DriveAnalysisReport({ teamId, gameId, filters }: ReportProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Analyze drive-level performance for both offensive and defensive units
        </p>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🏈</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Drive Analytics Coming Soon
          </h3>
          <p className="text-gray-600 mb-4">
            We're building comprehensive drive-level analysis including:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 text-left bg-white rounded-lg p-4">
            <li>• Points per drive</li>
            <li>• Average yards per drive</li>
            <li>• 3-and-out rate</li>
            <li>• Scoring drive percentage</li>
            <li>• Red zone touchdown rate</li>
            <li>• Drive efficiency by field position</li>
            <li>• Defensive drive stop rate</li>
          </ul>
          <p className="text-sm text-gray-500 mt-4">
            Drive analytics require drive grouping in the Film Room. We're working on making
            this feature available soon.
          </p>
        </div>
      </div>
    </div>
  );
}
