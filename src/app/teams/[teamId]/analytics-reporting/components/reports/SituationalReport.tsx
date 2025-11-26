/**
 * Situational Report
 *
 * Performance analysis by down, distance, field position, and game context.
 * Includes:
 * - Offensive down & distance breakdown
 * - Defensive down & distance breakdown
 * - Situational performance metrics
 */

'use client';

import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

// Import existing down breakdown components
import DownBreakdownSection from '@/components/analytics/offense/DownBreakdownSection';
import DefensiveDownBreakdownSection from '@/components/analytics/defense/DefensiveDownBreakdownSection';

export default function SituationalReport({ teamId, gameId, filters }: ReportProps) {
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
          Analyze performance by down, distance, and field position
        </p>
      </div>

      {/* Offensive Down & Distance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('offensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Down & Distance</span>
          {expandedSections.offensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.offensive && (
          <DownBreakdownSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* Defensive Down & Distance */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('defensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Down & Distance</span>
          {expandedSections.defensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.defensive && (
          <DefensiveDownBreakdownSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>
    </div>
  );
}
