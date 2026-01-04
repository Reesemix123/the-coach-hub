/**
 * Drive Analysis Report
 *
 * Drive-level performance metrics and efficiency for both offense and defense.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import StatCard from '@/components/analytics/StatCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MetricDefinition } from '@/lib/analytics/metricDefinitions';

// ============================================================================
// Drive Analysis Metric Definitions (for tooltips)
// ============================================================================
const DRIVE_METRICS: Record<string, MetricDefinition> = {
  // Offensive Drive Metrics
  totalDrives: {
    title: 'Total Drives',
    description: 'Number of offensive possessions',
    useful: 'Shows total opportunities to score. More drives usually means better field position or tempo.',
    calculation: 'Count of distinct offensive possessions (changes after punts, turnovers, scores, etc.)',
  },
  pointsPerDrive: {
    title: 'Points Per Drive',
    description: 'Average points scored on each offensive possession',
    useful: 'Best single measure of offensive efficiency. 2.5+ is excellent. 1.5-2.5 is good. Below 1.5 needs improvement.',
    calculation: 'Total points scored ÷ Total offensive drives',
  },
  avgYardsPerDrive: {
    title: 'Avg Yards Per Drive',
    description: 'Average yards gained on each offensive possession',
    useful: 'Shows drive sustainability. 30+ yards/drive is good. Under 20 indicates stalled drives.',
    calculation: 'Total yards gained ÷ Total offensive drives',
  },
  scoringDriveRate: {
    title: 'Scoring Drive Rate',
    description: 'Percentage of drives that result in points (TD or FG)',
    useful: 'Shows finishing ability. 40%+ is strong. Below 30% means too many empty possessions.',
    calculation: '(Drives ending in TD or FG) ÷ Total drives × 100',
  },
  threeAndOutRate: {
    title: '3-and-Out Rate',
    description: 'Percentage of drives ending after just 3 plays with a punt',
    useful: 'Lower is better. Under 15% is excellent. Above 25% indicates first-down struggles.',
    calculation: '(Drives with 3 or fewer plays ending in punt) ÷ Total drives × 100',
  },
  redZoneTDRate: {
    title: 'Red Zone TD Rate',
    description: 'Percentage of red zone trips that end in touchdowns (not field goals)',
    useful: 'Shows goal-line efficiency. 60%+ is great. Below 40% means settling for field goals too often.',
    calculation: 'Red zone touchdowns ÷ Red zone drives × 100',
  },
  redZoneDrives: {
    title: 'Red Zone Drives',
    description: 'Number of drives that reached inside the opponent\'s 20-yard line',
    useful: 'Shows ability to move the ball into scoring position. More trips = more scoring chances.',
    calculation: 'Count of drives that reached the opponent\'s 20-yard line',
  },

  // Defensive Drive Metrics
  totalDrivesDefense: {
    title: 'Total Drives Faced',
    description: 'Number of opponent offensive possessions',
    useful: 'Fewer drives faced often means offense controlling time of possession.',
    calculation: 'Count of opponent offensive possessions',
  },
  pointsPerDriveAllowed: {
    title: 'Points Per Drive Allowed',
    description: 'Average points allowed on each opponent possession',
    useful: 'Best single measure of defensive efficiency. Under 1.5 is elite. Under 2.0 is good.',
    calculation: 'Total points allowed ÷ Total opponent drives',
  },
  avgYardsAllowedPerDrive: {
    title: 'Avg Yards Allowed/Drive',
    description: 'Average yards opponent gains per possession',
    useful: 'Shows defensive drive containment. Under 25 yards is good. Over 35 is concerning.',
    calculation: 'Total yards allowed ÷ Total opponent drives',
  },
  scoringDrivesAllowed: {
    title: 'Scoring Drives Allowed',
    description: 'Percentage of opponent drives resulting in points',
    useful: 'Lower is better. Under 25% is excellent. Over 40% is problematic.',
    calculation: '(Opponent drives ending in TD or FG) ÷ Total opponent drives × 100',
  },
  threeAndOutStopRate: {
    title: '3-and-Out Stop Rate',
    description: 'Percentage of opponent drives forced into 3-and-out',
    useful: 'Higher is better. 25%+ is excellent. Shows ability to get off field quickly.',
    calculation: '(Opponent 3-and-outs) ÷ Total opponent drives × 100',
  },
  redZoneStopRate: {
    title: 'Red Zone Stop Rate',
    description: 'Percentage of opponent red zone trips held to field goals or less',
    useful: 'Shows bend-don\'t-break ability. 50%+ is solid. Limiting TDs in red zone is crucial.',
    calculation: '(Red zone drives held to FG or no points) ÷ Opponent red zone drives × 100',
  },
  redZoneDrivesFaced: {
    title: 'Red Zone Drives Faced',
    description: 'Number of opponent drives that reached your 20-yard line',
    useful: 'Fewer is better. Shows ability to prevent deep penetration.',
    calculation: 'Count of opponent drives reaching the 20-yard line',
  },
};

interface DriveStats {
  // Offensive drives
  offensive: {
    totalDrives: number;
    totalPoints: number;
    pointsPerDrive: number;
    avgYardsPerDrive: number;
    avgPlaysPerDrive: number;
    scoringDrives: number;
    scoringDriveRate: number;
    threeAndOuts: number;
    threeAndOutRate: number;
    redZoneDrives: number;
    redZoneTouchdowns: number;
    redZoneTDRate: number;
  };

  // Defensive drives (opponent's offense)
  defensive: {
    totalDrives: number;
    totalPointsAllowed: number;
    pointsPerDriveAllowed: number;
    avgYardsPerDriveAllowed: number;
    avgPlaysPerDriveAllowed: number;
    scoringDrivesAllowed: number;
    scoringDriveRateAllowed: number;
    threeAndOutStops: number;
    threeAndOutStopRate: number;
    redZoneDrives: number;
    redZoneTouchdownsAllowed: number;
    redZoneStopRate: number;
  };
}

export default function DriveAnalysisReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function loadDriveStats() {
      setLoading(true);

      try {
        // Build query for drives
        let query = supabase
          .from('drives')
          .select('*')
          .eq('team_id', teamId);

        // Filter by game if specified
        if (filters.gameId || gameId) {
          query = query.eq('game_id', filters.gameId || gameId);
        }

        const { data: drives, error } = await query;

        if (error || !drives) {
          console.error('Error loading drives:', error);
          setLoading(false);
          return;
        }

        // Split into offensive and defensive drives
        const offensiveDrives = drives.filter(d => d.possession_type === 'offense');
        const defensiveDrives = drives.filter(d => d.possession_type === 'defense');

        // Calculate offensive stats
        const offensive = {
          totalDrives: offensiveDrives.length,
          totalPoints: offensiveDrives.reduce((sum, d) => sum + (d.points || 0), 0),
          pointsPerDrive: offensiveDrives.length > 0
            ? offensiveDrives.reduce((sum, d) => sum + (d.points || 0), 0) / offensiveDrives.length
            : 0,
          avgYardsPerDrive: offensiveDrives.length > 0
            ? offensiveDrives.reduce((sum, d) => sum + (d.yards_gained || 0), 0) / offensiveDrives.length
            : 0,
          avgPlaysPerDrive: offensiveDrives.length > 0
            ? offensiveDrives.reduce((sum, d) => sum + (d.plays_count || 0), 0) / offensiveDrives.length
            : 0,
          scoringDrives: offensiveDrives.filter(d => d.scoring_drive).length,
          scoringDriveRate: offensiveDrives.length > 0
            ? (offensiveDrives.filter(d => d.scoring_drive).length / offensiveDrives.length) * 100
            : 0,
          threeAndOuts: offensiveDrives.filter(d => d.three_and_out).length,
          threeAndOutRate: offensiveDrives.length > 0
            ? (offensiveDrives.filter(d => d.three_and_out).length / offensiveDrives.length) * 100
            : 0,
          redZoneDrives: offensiveDrives.filter(d => d.reached_red_zone).length,
          redZoneTouchdowns: offensiveDrives.filter(d => d.reached_red_zone && d.result === 'touchdown').length,
          redZoneTDRate: offensiveDrives.filter(d => d.reached_red_zone).length > 0
            ? (offensiveDrives.filter(d => d.reached_red_zone && d.result === 'touchdown').length /
               offensiveDrives.filter(d => d.reached_red_zone).length) * 100
            : 0
        };

        // Calculate defensive stats
        const defensive = {
          totalDrives: defensiveDrives.length,
          totalPointsAllowed: defensiveDrives.reduce((sum, d) => sum + (d.points || 0), 0),
          pointsPerDriveAllowed: defensiveDrives.length > 0
            ? defensiveDrives.reduce((sum, d) => sum + (d.points || 0), 0) / defensiveDrives.length
            : 0,
          avgYardsPerDriveAllowed: defensiveDrives.length > 0
            ? defensiveDrives.reduce((sum, d) => sum + (d.yards_gained || 0), 0) / defensiveDrives.length
            : 0,
          avgPlaysPerDriveAllowed: defensiveDrives.length > 0
            ? defensiveDrives.reduce((sum, d) => sum + (d.plays_count || 0), 0) / defensiveDrives.length
            : 0,
          scoringDrivesAllowed: defensiveDrives.filter(d => d.scoring_drive).length,
          scoringDriveRateAllowed: defensiveDrives.length > 0
            ? (defensiveDrives.filter(d => d.scoring_drive).length / defensiveDrives.length) * 100
            : 0,
          threeAndOutStops: defensiveDrives.filter(d => d.three_and_out).length,
          threeAndOutStopRate: defensiveDrives.length > 0
            ? (defensiveDrives.filter(d => d.three_and_out).length / defensiveDrives.length) * 100
            : 0,
          redZoneDrives: defensiveDrives.filter(d => d.reached_red_zone).length,
          redZoneTouchdownsAllowed: defensiveDrives.filter(d => d.reached_red_zone && d.result === 'touchdown').length,
          redZoneStopRate: defensiveDrives.filter(d => d.reached_red_zone).length > 0
            ? ((defensiveDrives.filter(d => d.reached_red_zone).length -
                defensiveDrives.filter(d => d.reached_red_zone && d.result === 'touchdown').length) /
               defensiveDrives.filter(d => d.reached_red_zone).length) * 100
            : 0
        };

        setStats({ offensive, defensive });
      } catch (error) {
        console.error('Error calculating drive stats:', error);
      }

      setLoading(false);
    }

    loadDriveStats();
  }, [teamId, gameId, filters.gameId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading drive analysis...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load drive data</p>
      </div>
    );
  }

  const hasData = stats.offensive.totalDrives > 0 || stats.defensive.totalDrives > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Analyze drive-level performance for both offensive and defensive units
        </p>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
          <p className="text-gray-600 text-lg mb-2">No drive data available yet</p>
          <p className="text-gray-500 text-sm">
            Drive analytics will appear once you group plays into drives in the Film Room.
          </p>
        </div>
      )}

      {/* Offensive Drive Analytics */}
      {stats.offensive.totalDrives > 0 && (
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
            <>
              {/* Overall Drive Metrics */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Drive Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Drives"
                    value={stats.offensive.totalDrives.toString()}
                    subtitle={`${stats.offensive.totalPoints} total points`}
                    tooltip={DRIVE_METRICS.totalDrives}
                  />
                  <StatCard
                    label="Points Per Drive"
                    value={stats.offensive.pointsPerDrive.toFixed(2)}
                    subtitle="Offensive efficiency"
                    color={stats.offensive.pointsPerDrive >= 2.5 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.pointsPerDrive}
                  />
                  <StatCard
                    label="Avg Yards Per Drive"
                    value={stats.offensive.avgYardsPerDrive.toFixed(1)}
                    subtitle={`${stats.offensive.avgPlaysPerDrive.toFixed(1)} plays/drive`}
                    color={stats.offensive.avgYardsPerDrive >= 30 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.avgYardsPerDrive}
                  />
                  <StatCard
                    label="Scoring Drive Rate"
                    value={`${stats.offensive.scoringDriveRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.scoringDrives} of ${stats.offensive.totalDrives} drives`}
                    color={stats.offensive.scoringDriveRate >= 40 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.scoringDriveRate}
                  />
                </div>
              </div>

              {/* Drive Efficiency */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Drive Efficiency</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard
                    label="3-and-Out Rate"
                    value={`${stats.offensive.threeAndOutRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.threeAndOuts} of ${stats.offensive.totalDrives} drives`}
                    color={stats.offensive.threeAndOutRate <= 20 ? 'green' : 'red'}
                    tooltip={DRIVE_METRICS.threeAndOutRate}
                  />
                  <StatCard
                    label="Red Zone TD Rate"
                    value={`${stats.offensive.redZoneTDRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.redZoneTouchdowns} of ${stats.offensive.redZoneDrives} attempts`}
                    color={stats.offensive.redZoneTDRate >= 50 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.redZoneTDRate}
                  />
                  <StatCard
                    label="Red Zone Drives"
                    value={stats.offensive.redZoneDrives.toString()}
                    subtitle="Trips inside 20"
                    tooltip={DRIVE_METRICS.redZoneDrives}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Defensive Drive Analytics */}
      {stats.defensive.totalDrives > 0 && (
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
            <>
              {/* Overall Drive Metrics */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Drive Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Drives"
                    value={stats.defensive.totalDrives.toString()}
                    subtitle={`${stats.defensive.totalPointsAllowed} points allowed`}
                    tooltip={DRIVE_METRICS.totalDrivesDefense}
                  />
                  <StatCard
                    label="Points Per Drive Allowed"
                    value={stats.defensive.pointsPerDriveAllowed.toFixed(2)}
                    subtitle="Defensive efficiency"
                    color={stats.defensive.pointsPerDriveAllowed <= 2.0 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.pointsPerDriveAllowed}
                  />
                  <StatCard
                    label="Avg Yards Allowed/Drive"
                    value={stats.defensive.avgYardsPerDriveAllowed.toFixed(1)}
                    subtitle={`${stats.defensive.avgPlaysPerDriveAllowed.toFixed(1)} plays/drive`}
                    color={stats.defensive.avgYardsPerDriveAllowed <= 25 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.avgYardsAllowedPerDrive}
                  />
                  <StatCard
                    label="Scoring Drives Allowed"
                    value={`${stats.defensive.scoringDriveRateAllowed.toFixed(1)}%`}
                    subtitle={`${stats.defensive.scoringDrivesAllowed} of ${stats.defensive.totalDrives} drives`}
                    color={stats.defensive.scoringDriveRateAllowed <= 30 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.scoringDrivesAllowed}
                  />
                </div>
              </div>

              {/* Defensive Stops */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Defensive Stops</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard
                    label="3-and-Out Stop Rate"
                    value={`${stats.defensive.threeAndOutStopRate.toFixed(1)}%`}
                    subtitle={`${stats.defensive.threeAndOutStops} of ${stats.defensive.totalDrives} drives`}
                    color={stats.defensive.threeAndOutStopRate >= 30 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.threeAndOutStopRate}
                  />
                  <StatCard
                    label="Red Zone Stop Rate"
                    value={`${stats.defensive.redZoneStopRate.toFixed(1)}%`}
                    subtitle={`${stats.defensive.redZoneDrives - stats.defensive.redZoneTouchdownsAllowed} of ${stats.defensive.redZoneDrives} stops`}
                    color={stats.defensive.redZoneStopRate >= 50 ? 'green' : 'default'}
                    tooltip={DRIVE_METRICS.redZoneStopRate}
                  />
                  <StatCard
                    label="Red Zone Drives Faced"
                    value={stats.defensive.redZoneDrives.toString()}
                    subtitle={`${stats.defensive.redZoneTouchdownsAllowed} TDs allowed`}
                    tooltip={DRIVE_METRICS.redZoneDrivesFaced}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
