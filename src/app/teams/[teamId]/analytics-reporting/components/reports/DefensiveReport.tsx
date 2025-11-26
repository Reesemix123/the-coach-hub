/**
 * Defensive Report
 *
 * Complete defensive analysis including:
 * - Defensive metrics (volume, efficiency, disruptive plays)
 * - DL stats (all defensive linemen)
 * - LB stats (all linebackers)
 * - DB stats (all defensive backs)
 * - Drive analytics (defensive perspective)
 * - Down breakdown (defensive perspective)
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Import existing defensive components
import DLStatsSection from '@/components/analytics/defense/DLStatsSection';
import LBStatsSection from '@/components/analytics/defense/LBStatsSection';
import DBStatsSection from '@/components/analytics/defense/DBStatsSection';
import DefensiveDriveAnalyticsSection from '@/components/analytics/defense/DefensiveDriveAnalyticsSection';
import DefensiveDownBreakdownSection from '@/components/analytics/defense/DefensiveDownBreakdownSection';

export default function DefensiveReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    dl: true,
    lb: true,
    db: true,
    drives: true,
    downs: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);

      // Get comprehensive metrics for defensive metrics display
      const { data: metricsData, error: metricsError } = await supabase.rpc('calculate_team_metrics', {
        p_team_id: teamId,
        p_game_id: filters.gameId || gameId || null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_opponent: filters.opponent || null,
      });

      if (metricsError) {
        console.error('Error loading metrics:', metricsError);
        setLoading(false);
        return;
      }

      setMetrics(metricsData as ComprehensiveTeamMetrics);
      setLoading(false);
    }

    loadMetrics();
  }, [teamId, gameId, filters]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading defensive report...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load defensive data</p>
      </div>
    );
  }

  const gamesPlayed = metrics.filters.gamesPlayed || 0;
  const hasData = gamesPlayed > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          {gamesPlayed === 0 ? 'No games played' : `${gamesPlayed} game${gamesPlayed > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
          <p className="text-gray-600 text-lg mb-2">No data available yet</p>
          <p className="text-gray-500 text-sm">
            Defensive stats will appear once you tag plays in your games.
          </p>
        </div>
      )}

      {/* Defensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('metrics')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Metrics</span>
          {expandedSections.metrics ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.metrics && (
          <>
            {/* Volume */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Yards Allowed/Game"
                  value={metrics.defense.volume.totalYardsAllowedPerGame?.toFixed(1) || '0.0'}
                  subtitle="Total yards given up"
                  tooltip={METRIC_DEFINITIONS.totalYardsAllowedPerGame}
                  color={(metrics.defense.volume.totalYardsAllowedPerGame || 999) <= 300 ? 'green' : 'default'}
                />
                <StatCard
                  title="Rushing Yards Allowed/Game"
                  value={metrics.defense.volume.rushingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                  subtitle="Rushing yards given up"
                  tooltip={METRIC_DEFINITIONS.rushingYardsAllowedPerGame}
                />
                <StatCard
                  title="Passing Yards Allowed/Game"
                  value={metrics.defense.volume.passingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                  subtitle="Passing yards given up"
                  tooltip={METRIC_DEFINITIONS.passingYardsAllowedPerGame}
                />
                <StatCard
                  title="Points Allowed/Game"
                  value={metrics.defense.volume.pointsAllowedPerGame?.toFixed(1) || '0.0'}
                  subtitle="Points given up per game"
                  tooltip={METRIC_DEFINITIONS.pointsAllowedPerGame}
                  color={(metrics.defense.volume.pointsAllowedPerGame || 999) <= 20 ? 'green' : 'default'}
                />
              </div>
            </div>

            {/* Efficiency */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Yards Per Play Allowed"
                  value={metrics.defense.efficiency.yardsPerPlayAllowed?.toFixed(2) || '0.00'}
                  subtitle="Yards allowed per play"
                  tooltip={METRIC_DEFINITIONS.yardsPerPlayAllowed}
                  color={(metrics.defense.efficiency.yardsPerPlayAllowed || 999) <= 5.0 ? 'green' : 'default'}
                />
                <StatCard
                  title="3rd Down Stop Rate"
                  value={`${(metrics.defense.efficiency.thirdDownStopRate || 0).toFixed(1)}%`}
                  subtitle={`${metrics.defense.efficiency.thirdDownStops} of ${metrics.defense.efficiency.thirdDownAttempts}`}
                  tooltip={METRIC_DEFINITIONS.thirdDownStopRate}
                  color={(metrics.defense.efficiency.thirdDownStopRate || 0) >= 50 ? 'green' : 'default'}
                />
                <StatCard
                  title="Red Zone TD Rate"
                  value={`${(metrics.defense.efficiency.redZoneTDRate || 0).toFixed(1)}%`}
                  subtitle="Opponent TDs in red zone"
                  tooltip={METRIC_DEFINITIONS.redZoneTDRate}
                  color={(metrics.defense.efficiency.redZoneTDRate || 999) <= 50 ? 'green' : 'default'}
                />
                <StatCard
                  title="Completion % Allowed"
                  value={`${(metrics.defense.efficiency.completionPercentageAllowed || 0).toFixed(1)}%`}
                  subtitle="Pass completions allowed"
                />
              </div>
            </div>

            {/* Disruptive Plays */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Disruptive Plays</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Havoc Rate"
                  value={`${(metrics.defense.disruptive.havocRate || 0).toFixed(1)}%`}
                  subtitle="Disruptive plays per snap"
                  tooltip={METRIC_DEFINITIONS.havocRate}
                  color={(metrics.defense.disruptive.havocRate || 0) >= 10 ? 'green' : 'default'}
                />
                <StatCard
                  title="Sacks"
                  value={metrics.defense.disruptive.sacks.toString()}
                  subtitle={`${(metrics.defense.disruptive.sacksPerGame || 0).toFixed(2)} per game`}
                  color={metrics.defense.disruptive.sacks > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Turnovers Forced"
                  value={metrics.defense.disruptive.turnoversForced.toString()}
                  subtitle={`${(metrics.defense.disruptive.turnoversPerGame || 0).toFixed(2)} per game`}
                  tooltip={METRIC_DEFINITIONS.turnoversForced}
                  color={metrics.defense.disruptive.turnoversForced > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Tackles For Loss"
                  value={metrics.defense.disruptive.tacklesForLoss.toString()}
                  subtitle={`${(metrics.defense.disruptive.tflPerGame || 0).toFixed(2)} per game`}
                  color={metrics.defense.disruptive.tacklesForLoss > 0 ? 'green' : 'default'}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* DL Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('dl')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Line Stats</span>
          {expandedSections.dl ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.dl && (
          <DLStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* LB Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('lb')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Linebacker Stats</span>
          {expandedSections.lb ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.lb && (
          <LBStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* DB Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('db')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Back Stats</span>
          {expandedSections.db ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.db && (
          <DBStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* Drive Analytics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('drives')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Drive Analytics</span>
          {expandedSections.drives ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.drives && (
          <DefensiveDriveAnalyticsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* Down Breakdown */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('downs')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Down & Distance Breakdown</span>
          {expandedSections.downs ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.downs && (
          <DefensiveDownBreakdownSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>
    </div>
  );
}
