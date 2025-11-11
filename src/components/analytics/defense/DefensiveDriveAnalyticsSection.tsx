/**
 * Defensive Drive Analytics Section
 *
 * Shows defensive drive-level metrics (Tier 2+).
 * Available at Season and Game levels.
 *
 * Metrics:
 * - Points Allowed Per Drive
 * - 3-and-Out Rate (forced)
 * - Red Zone Stop Rate
 * - Turnovers Forced
 */

'use client';

import CollapsibleSection from '../CollapsibleSection';
import StatCard from '../StatCard';
import StatList from '../StatList';

interface DefensiveDriveAnalyticsSectionProps {
  data: {
    totalDrives: number;
    pointsAllowedPerDrive: number;
    avgPlaysPerDrive: number;
    avgYardsAllowedPerDrive: number;
    threeAndOutRate: number;
    redZoneStopRate: number;
    scoringDriveAllowedRate: number;
    touchdownsAllowed: number;
    fieldGoalsAllowed: number;
    stops: number;
    turnovers: number;
  };
  viewMode: 'cards' | 'list' | 'print';
  level: 'season' | 'game';
  gameName?: string;
}

export default function DefensiveDriveAnalyticsSection({
  data,
  viewMode,
  level,
  gameName,
}: DefensiveDriveAnalyticsSectionProps) {
  const title = level === 'game'
    ? `Defensive Drive Analytics - ${gameName || 'Game'}`
    : 'Defensive Drive Analytics - Season';

  return (
    <CollapsibleSection
      id="defense-drive-analytics"
      title={title}
      badge="Tier 2+"
      badgeColor="blue"
      defaultExpanded={false}
    >
      {viewMode === 'cards' ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Points Allowed/Drive"
              value={data.pointsAllowedPerDrive.toFixed(2)}
              color="red"
              tooltip="Average points allowed per opponent drive (lower is better)"
            />
            <StatCard
              label="3-and-Outs Forced"
              value={`${data.threeAndOutRate.toFixed(1)}%`}
              color="green"
              tooltip="Percentage of drives stopped in 3 plays or fewer"
            />
            <StatCard
              label="Red Zone Stop Rate"
              value={`${data.redZoneStopRate.toFixed(0)}%`}
              color="green"
              tooltip="Percentage of red zone drives that didn't result in a touchdown"
            />
            <StatCard
              label="Turnovers Forced"
              value={data.turnovers.toString()}
              color="green"
              tooltip="Total turnovers forced (interceptions + fumbles recovered)"
            />
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Drives"
              value={data.totalDrives.toString()}
              color="gray"
            />
            <StatCard
              label="Avg Plays/Drive"
              value={data.avgPlaysPerDrive.toFixed(1)}
              color="gray"
            />
            <StatCard
              label="Avg Yards/Drive"
              value={data.avgYardsAllowedPerDrive.toFixed(1)}
              color="gray"
            />
            <StatCard
              label="Scoring % Allowed"
              value={`${data.scoringDriveAllowedRate.toFixed(1)}%`}
              color="gray"
            />
          </div>

          {/* Drive Results */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Drive Results</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">TDs Allowed</div>
                <div className="text-2xl font-bold text-red-600">{data.touchdownsAllowed}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">FGs Allowed</div>
                <div className="text-2xl font-bold text-yellow-600">{data.fieldGoalsAllowed}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Stops</div>
                <div className="text-2xl font-bold text-green-600">{data.stops}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Turnovers</div>
                <div className="text-2xl font-bold text-green-600">{data.turnovers}</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <StatList
            stats={[
              { label: 'Points Allowed/Drive', value: data.pointsAllowedPerDrive.toFixed(2) },
              { label: '3-and-Outs Forced', value: `${data.threeAndOutRate.toFixed(1)}%` },
              { label: 'Red Zone Stop Rate', value: `${data.redZoneStopRate.toFixed(0)}%` },
              { label: 'Turnovers Forced', value: data.turnovers.toString() },
              { label: 'Total Drives', value: data.totalDrives.toString() },
              { label: 'Avg Plays/Drive', value: data.avgPlaysPerDrive.toFixed(1) },
              { label: 'Avg Yards/Drive', value: data.avgYardsAllowedPerDrive.toFixed(1) },
              { label: 'Scoring % Allowed', value: `${data.scoringDriveAllowedRate.toFixed(1)}%` },
            ]}
            columns={4}
          />

          <div className="mt-6 pt-6 border-t border-gray-200">
            <StatList
              stats={[
                { label: 'TDs Allowed', value: data.touchdownsAllowed.toString() },
                { label: 'FGs Allowed', value: data.fieldGoalsAllowed.toString() },
                { label: 'Stops', value: data.stops.toString() },
                { label: 'Turnovers', value: data.turnovers.toString() },
              ]}
              columns={4}
            />
          </div>
        </>
      )}

      <p className="text-sm text-gray-600 mt-6">
        {level === 'season'
          ? 'Season-long defensive drive metrics. These stats track opponent possessions and defensive performance.'
          : 'Defensive drive metrics for this game. Defensive drives are marked in the Film Room.'}
      </p>
    </CollapsibleSection>
  );
}
