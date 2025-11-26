/**
 * Overall Defense Section
 *
 * Shows defensive performance metrics at Season or Game level.
 * Available at all tiers.
 *
 * Metrics:
 * - Total Plays (opponent)
 * - Yards Allowed Per Play
 * - Defensive Success Rate (% of plays stopped)
 * - Turnovers Forced
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import StatCard from '../StatCard';
import StatList from '../StatList';
import { METRIC_DEFINITIONS } from '@/lib/analytics/metricDefinitions';

interface OverallDefenseSectionProps {
  data: {
    totalPlays: number;
    yardsAllowedPerPlay: number;
    defensiveSuccessRate: number; // % of plays where defense succeeded
    turnoversForced: number;
  };
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function OverallDefenseSection({
  data,
  viewMode,
  level,
  gameName,
}: OverallDefenseSectionProps) {
  const title = level === 'game'
    ? `Overall Defense - ${gameName || 'Game'}`
    : 'Overall Defense - Season';

  return (
    <CollapsibleSection
      id="defense-overall-performance"
      title={title}
      defaultExpanded={true}
    >
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Plays Against"
            value={data.totalPlays}
            tooltip={{
              title: 'Plays Against',
              description: 'Total number of plays run by opponents',
              useful: 'Shows defensive workload. More plays typically means more opportunities to force stops.',
              calculation: 'Count of all opponent play instances',
            }}
          />
          <StatCard
            label="Yards Allowed Per Play"
            value={data.yardsAllowedPerPlay.toFixed(1)}
            color="red"
            tooltip={{
              title: 'Yards Allowed Per Play',
              description: 'Average yards allowed on each defensive play',
              useful: 'Key defensive efficiency metric. Lower is better. Elite defenses: under 4.5 yards.',
              calculation: 'Total yards allowed ÷ Total plays',
            }}
          />
          <StatCard
            label="Defensive Success Rate"
            value={`${data.defensiveSuccessRate.toFixed(1)}%`}
            color="green"
            tooltip={{
              title: 'Defensive Success Rate',
              description: 'Percentage of plays where defense prevented expected yardage',
              useful: 'Shows how often defense wins. Higher is better. Target: 55%+',
              calculation: 'Same success formula as offense but inverted (defense wins when offense fails)',
            }}
          />
          <StatCard
            label="Turnovers Forced"
            value={data.turnoversForced}
            color="green"
            tooltip={{
              title: 'Turnovers Forced',
              description: 'Total fumbles and interceptions forced',
              useful: 'Game-changing plays that create extra possessions. Elite: 2+ per game',
              calculation: 'Count of plays marked as turnovers',
            }}
          />
        </div>
      ) : (
        <StatList
          stats={[
            {
              label: 'Plays Against',
              value: data.totalPlays,
              tooltip: {
                title: 'Plays Against',
                description: 'Total number of plays run by opponents',
                useful: 'Shows defensive workload',
                calculation: 'Count of all opponent play instances',
              }
            },
            {
              label: 'Yards Allowed Per Play',
              value: data.yardsAllowedPerPlay.toFixed(1),
              tooltip: {
                title: 'Yards Allowed Per Play',
                description: 'Average yards allowed per play',
                useful: 'Lower is better. Elite: under 4.5',
                calculation: 'Yards allowed ÷ Plays',
              }
            },
            {
              label: 'Defensive Success Rate',
              value: `${data.defensiveSuccessRate.toFixed(1)}%`,
              tooltip: {
                title: 'Defensive Success Rate',
                description: '% of plays where defense won',
                useful: 'Higher is better. Target: 55%+',
                calculation: 'Defense wins ÷ Total plays',
              }
            },
            {
              label: 'Turnovers Forced',
              value: data.turnoversForced,
              tooltip: {
                title: 'Turnovers Forced',
                description: 'Fumbles and interceptions',
                useful: 'Game-changers. Elite: 2+ per game',
                calculation: 'Count of turnovers',
              }
            },
          ]}
          columns={4}
        />
      )}
    </CollapsibleSection>
  );
}
