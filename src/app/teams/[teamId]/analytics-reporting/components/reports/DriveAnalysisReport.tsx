/**
 * Drive Analysis Report
 *
 * Drive-level performance metrics and efficiency for both offense and defense.
 * Includes:
 * - Offensive drive analytics
 * - Defensive drive analytics
 * - Drive-level metrics and trends
 */

'use client';

import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

// Import existing drive components
import DriveAnalyticsSection from '@/components/analytics/offense/DriveAnalyticsSection';
import DefensiveDriveAnalyticsSection from '@/components/analytics/defense/DefensiveDriveAnalyticsSection';

export default function DriveAnalysisReport({ teamId, gameId, filters }: ReportProps) {
  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    offensive: true,
    defensive: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Analyze drive-level performance for both offensive and defensive units
        </p>
      </div>

      {/* Offensive Drive Analytics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('offensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Drive Analytics</span>
          {expandedSections.offensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.offensive && (
          <DriveAnalyticsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* Defensive Drive Analytics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('defensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Drive Analytics</span>
          {expandedSections.defensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.defensive && (
          <DefensiveDriveAnalyticsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>
    </div>
  );
}
