/**
 * ReportSelector Component
 *
 * Sidebar navigation for selecting different report types.
 * Organized by category: Team Reports, Unit Reports, Analysis.
 */

'use client';

import { REPORT_REGISTRY, getReportsByCategory } from '@/config/reportRegistry';
import { ReportType } from '@/types/reports';

interface ReportSelectorProps {
  selectedReport: ReportType;
  onSelectReport: (reportType: ReportType) => void;
}

export default function ReportSelector({
  selectedReport,
  onSelectReport,
}: ReportSelectorProps) {
  const teamReports = getReportsByCategory('team');
  const unitReports = getReportsByCategory('unit');
  const analysisReports = getReportsByCategory('analysis');

  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-full overflow-y-auto">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Reports</h2>

        {/* Team Reports */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Team Reports
          </h3>
          <nav className="space-y-1">
            {teamReports.map((report) => (
              <button
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedReport === report.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{report.name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedReport === report.id ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {report.description}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Unit Reports */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Unit Reports
          </h3>
          <nav className="space-y-1">
            {unitReports.map((report) => (
              <button
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedReport === report.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{report.name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedReport === report.id ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {report.description}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Analysis Reports */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Analysis
          </h3>
          <nav className="space-y-1">
            {analysisReports.map((report) => (
              <button
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedReport === report.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{report.name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedReport === report.id ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {report.description}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
