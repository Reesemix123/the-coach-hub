/**
 * Drive Analytics Section (Offense)
 *
 * Shows drive-level efficiency metrics (Tier 2+).
 * Available at Season and Game levels.
 *
 * Metrics:
 * - Points Per Drive
 * - 3-and-Out Rate
 * - Scoring Drive Rate
 * - Red Zone TD Rate
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import StatCard from '../StatCard';
import StatList from '../StatList';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface DriveAnalyticsSectionProps {
  data: {
    pointsPerDrive: number;
    threeAndOutRate: number;
    scoringDriveRate: number;
    redZoneTouchdownRate: number;
  };
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function DriveAnalyticsSection({
  data,
  viewMode,
  level,
  gameName,
}: DriveAnalyticsSectionProps) {
  const title = level === 'game'
    ? `Drive Analytics - ${gameName || 'Game'}`
    : 'Drive Analytics - Season';

  return (
    <CollapsibleSection
      id="offense-drive-analytics"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
      defaultExpanded={false}
    >
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Points Per Drive"
            value={data.pointsPerDrive.toFixed(2)}
            color="blue"
            tooltip={METRIC_DEFINITIONS.pointsPerDrive}
          />
          <StatCard
            label="3-and-Out Rate"
            value={`${data.threeAndOutRate.toFixed(1)}%`}
            color="blue"
            tooltip={METRIC_DEFINITIONS.threeAndOutRate}
          />
          <StatCard
            label="Scoring Drives"
            value={`${data.scoringDriveRate.toFixed(0)}%`}
            color="blue"
            tooltip={METRIC_DEFINITIONS.scoringDriveRate}
          />
          <StatCard
            label="RZ TD Rate"
            value={`${data.redZoneTouchdownRate.toFixed(0)}%`}
            color="blue"
            tooltip={METRIC_DEFINITIONS.redZoneTD}
          />
        </div>
      ) : (
        <StatList
          stats={[
            { label: 'Points Per Drive', value: data.pointsPerDrive.toFixed(2), tooltip: METRIC_DEFINITIONS.pointsPerDrive },
            { label: '3-and-Out Rate', value: `${data.threeAndOutRate.toFixed(1)}%`, tooltip: METRIC_DEFINITIONS.threeAndOutRate },
            { label: 'Scoring Drives', value: `${data.scoringDriveRate.toFixed(0)}%`, tooltip: METRIC_DEFINITIONS.scoringDriveRate },
            { label: 'RZ TD Rate', value: `${data.redZoneTouchdownRate.toFixed(0)}%`, tooltip: METRIC_DEFINITIONS.redZoneTD },
          ]}
          columns={4}
        />
      )}

      <p className="text-sm text-gray-600 mt-6">
        {level === 'season'
          ? 'Season-long drive efficiency metrics. Switch to Game level to see specific game performance.'
          : 'Drive efficiency for this game. Drives are managed in the Film Room when tagging plays.'}
      </p>
    </CollapsibleSection>
  );
}
