/**
 * Overall Performance Section (Offense)
 *
 * Shows offensive performance metrics at Season or Game level.
 * Not shown at Player level (use Player Performance section instead).
 *
 * Metrics (all tiers):
 * - Total Plays
 * - Yards Per Play
 * - Success Rate
 * - First Downs
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import StatCard from '../StatCard';
import StatList from '../StatList';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface OverallPerformanceSectionProps {
  data: {
    totalPlays: number;
    avgYardsPerPlay: number;
    successRate: number;
    firstDowns: number;
  };
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string; // For display when game level
}

export default function OverallPerformanceSection({
  data,
  viewMode,
  level,
  gameName,
}: OverallPerformanceSectionProps) {
  const title = level === 'game'
    ? `Overall Performance - ${gameName || 'Game'}`
    : 'Overall Performance - Season';

  return (
    <CollapsibleSection
      id="offense-overall-performance"
      title={title}
      defaultExpanded={true}
    >
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Plays"
            value={data.totalPlays}
            tooltip={METRIC_DEFINITIONS.totalPlays}
          />
          <StatCard
            label="Yards Per Play"
            value={data.avgYardsPerPlay.toFixed(1)}
            tooltip={METRIC_DEFINITIONS.yardsPerPlay}
          />
          <StatCard
            label="Success Rate"
            value={`${data.successRate.toFixed(1)}%`}
            tooltip={METRIC_DEFINITIONS.successRate}
          />
          <StatCard
            label="First Downs"
            value={data.firstDowns}
            tooltip={METRIC_DEFINITIONS.firstDowns}
          />
        </div>
      ) : (
        <StatList
          stats={[
            { label: 'Total Plays', value: data.totalPlays, tooltip: METRIC_DEFINITIONS.totalPlays },
            { label: 'Yards Per Play', value: data.avgYardsPerPlay.toFixed(1), tooltip: METRIC_DEFINITIONS.yardsPerPlay },
            { label: 'Success Rate', value: `${data.successRate.toFixed(1)}%`, tooltip: METRIC_DEFINITIONS.successRate },
            { label: 'First Downs', value: data.firstDowns, tooltip: METRIC_DEFINITIONS.firstDowns },
          ]}
          columns={4}
        />
      )}
    </CollapsibleSection>
  );
}
