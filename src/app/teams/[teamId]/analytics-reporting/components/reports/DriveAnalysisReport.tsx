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
        const offensiveDrives = drives.filter(d => d.is_offensive_drive === true);
        const defensiveDrives = drives.filter(d => d.is_offensive_drive === false);

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
                    title="Total Drives"
                    value={stats.offensive.totalDrives.toString()}
                    subtitle={`${stats.offensive.totalPoints} total points`}
                  />
                  <StatCard
                    title="Points Per Drive"
                    value={stats.offensive.pointsPerDrive.toFixed(2)}
                    subtitle="Offensive efficiency"
                    color={stats.offensive.pointsPerDrive >= 2.5 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Avg Yards Per Drive"
                    value={stats.offensive.avgYardsPerDrive.toFixed(1)}
                    subtitle={`${stats.offensive.avgPlaysPerDrive.toFixed(1)} plays/drive`}
                    color={stats.offensive.avgYardsPerDrive >= 30 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Scoring Drive Rate"
                    value={`${stats.offensive.scoringDriveRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.scoringDrives} of ${stats.offensive.totalDrives} drives`}
                    color={stats.offensive.scoringDriveRate >= 40 ? 'green' : 'default'}
                  />
                </div>
              </div>

              {/* Drive Efficiency */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Drive Efficiency</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard
                    title="3-and-Out Rate"
                    value={`${stats.offensive.threeAndOutRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.threeAndOuts} of ${stats.offensive.totalDrives} drives`}
                    color={stats.offensive.threeAndOutRate <= 20 ? 'green' : 'red'}
                  />
                  <StatCard
                    title="Red Zone TD Rate"
                    value={`${stats.offensive.redZoneTDRate.toFixed(1)}%`}
                    subtitle={`${stats.offensive.redZoneTouchdowns} of ${stats.offensive.redZoneDrives} attempts`}
                    color={stats.offensive.redZoneTDRate >= 50 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Red Zone Drives"
                    value={stats.offensive.redZoneDrives.toString()}
                    subtitle="Trips inside 20"
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
                    title="Total Drives"
                    value={stats.defensive.totalDrives.toString()}
                    subtitle={`${stats.defensive.totalPointsAllowed} points allowed`}
                  />
                  <StatCard
                    title="Points Per Drive Allowed"
                    value={stats.defensive.pointsPerDriveAllowed.toFixed(2)}
                    subtitle="Defensive efficiency"
                    color={stats.defensive.pointsPerDriveAllowed <= 2.0 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Avg Yards Allowed/Drive"
                    value={stats.defensive.avgYardsPerDriveAllowed.toFixed(1)}
                    subtitle={`${stats.defensive.avgPlaysPerDriveAllowed.toFixed(1)} plays/drive`}
                    color={stats.defensive.avgYardsPerDriveAllowed <= 25 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Scoring Drives Allowed"
                    value={`${stats.defensive.scoringDriveRateAllowed.toFixed(1)}%`}
                    subtitle={`${stats.defensive.scoringDrivesAllowed} of ${stats.defensive.totalDrives} drives`}
                    color={stats.defensive.scoringDriveRateAllowed <= 30 ? 'green' : 'default'}
                  />
                </div>
              </div>

              {/* Defensive Stops */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Defensive Stops</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard
                    title="3-and-Out Stop Rate"
                    value={`${stats.defensive.threeAndOutStopRate.toFixed(1)}%`}
                    subtitle={`${stats.defensive.threeAndOutStops} of ${stats.defensive.totalDrives} drives`}
                    color={stats.defensive.threeAndOutStopRate >= 30 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Red Zone Stop Rate"
                    value={`${stats.defensive.redZoneStopRate.toFixed(1)}%`}
                    subtitle={`${stats.defensive.redZoneDrives - stats.defensive.redZoneTouchdownsAllowed} of ${stats.defensive.redZoneDrives} stops`}
                    color={stats.defensive.redZoneStopRate >= 50 ? 'green' : 'default'}
                  />
                  <StatCard
                    title="Red Zone Drives Faced"
                    value={stats.defensive.redZoneDrives.toString()}
                    subtitle={`${stats.defensive.redZoneTouchdownsAllowed} TDs allowed`}
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
