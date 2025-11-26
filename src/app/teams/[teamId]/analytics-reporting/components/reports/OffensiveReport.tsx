/**
 * Offensive Report
 *
 * Complete offensive analysis including:
 * - Offensive metrics (volume, efficiency, ball security, possession)
 * - QB stats (all QBs)
 * - RB stats (all RBs)
 * - WR/TE stats (all receivers)
 * - OL performance
 * - Drive analytics
 * - Down breakdown
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Import existing offensive components
import QBStatsSection from '@/components/analytics/offense/QBStatsSection';
import RBStatsSection from '@/components/analytics/offense/RBStatsSection';
import WRTEStatsSection from '@/components/analytics/offense/WRTEStatsSection';
import OLStatsSection from '@/components/analytics/offense/OLStatsSection';

export default function OffensiveReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    qb: true,
    rb: true,
    wrte: true,
    ol: true,
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

      // Get comprehensive metrics for offensive metrics display
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
        <div className="text-gray-600">Loading offensive report...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load offensive data</p>
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
            Offensive stats will appear once you tag plays in your games.
          </p>
        </div>
      )}

      {/* Offensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('metrics')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Metrics</span>
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
                  title="Total Yards/Game"
                  value={metrics.offense.volume.totalYardsPerGame?.toFixed(1) || '0.0'}
                  subtitle="Total offense per game"
                  tooltip={METRIC_DEFINITIONS.totalYardsPerGame}
                />
                <StatCard
                  title="Rushing Yards/Game"
                  value={metrics.offense.volume.rushingYardsPerGame?.toFixed(1) || '0.0'}
                  subtitle="Average rushing yards"
                  tooltip={METRIC_DEFINITIONS.rushingYardsPerGame}
                />
                <StatCard
                  title="Passing Yards/Game"
                  value={metrics.offense.volume.passingYardsPerGame?.toFixed(1) || '0.0'}
                  subtitle="Average passing yards"
                  tooltip={METRIC_DEFINITIONS.passingYardsPerGame}
                />
                <StatCard
                  title="Touchdowns"
                  value={metrics.offense.volume.touchdowns.toString()}
                  subtitle={`${(metrics.offense.volume.touchdownsPerGame || 0).toFixed(1)} per game`}
                  tooltip={METRIC_DEFINITIONS.touchdowns}
                  color="green"
                />
              </div>
            </div>

            {/* Efficiency */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Yards Per Play"
                  value={metrics.offense.efficiency.yardsPerPlay?.toFixed(2) || '0.00'}
                  subtitle="Overall efficiency"
                  tooltip={METRIC_DEFINITIONS.yardsPerPlay}
                  color={(metrics.offense.efficiency.yardsPerPlay || 0) >= 5.5 ? 'green' : 'default'}
                />
                <StatCard
                  title="Yards Per Carry"
                  value={metrics.offense.efficiency.yardsPerCarry?.toFixed(2) || '0.00'}
                  subtitle="Rushing efficiency"
                  tooltip={METRIC_DEFINITIONS.yardsPerCarry}
                />
                <StatCard
                  title="Yards Per Completion"
                  value={metrics.offense.efficiency.yardsPerCompletion?.toFixed(1) || '0.0'}
                  subtitle="Average yards per catch"
                  tooltip={METRIC_DEFINITIONS.yardsPerCompletion}
                />
                <StatCard
                  title="Completion %"
                  value={`${(metrics.offense.efficiency.completionPercentage || 0).toFixed(1)}%`}
                  subtitle="Passing accuracy"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <StatCard
                  title="3rd Down Conversion %"
                  value={`${(metrics.offense.efficiency.thirdDownConversionRate || 0).toFixed(1)}%`}
                  subtitle={`${metrics.offense.efficiency.thirdDownConversions} of ${metrics.offense.efficiency.thirdDownAttempts}`}
                  tooltip={METRIC_DEFINITIONS.thirdDownConversionRate}
                  color={(metrics.offense.efficiency.thirdDownConversionRate || 0) >= 40 ? 'green' : 'default'}
                />
                <StatCard
                  title="Red Zone Efficiency"
                  value={`${(metrics.offense.efficiency.redZoneEfficiency || 0).toFixed(1)}%`}
                  subtitle="Scoring in red zone"
                  tooltip={METRIC_DEFINITIONS.redZoneEfficiency}
                  color={(metrics.offense.efficiency.redZoneEfficiency || 0) >= 60 ? 'green' : 'default'}
                />
              </div>
            </div>

            {/* Ball Security */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ball Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  title="Turnovers"
                  value={metrics.offense.ballSecurity.turnovers.toString()}
                  subtitle={`${(metrics.offense.ballSecurity.turnoversPerGame || 0).toFixed(2)} per game`}
                  tooltip={METRIC_DEFINITIONS.turnovers}
                  color={metrics.offense.ballSecurity.turnovers > 0 ? 'red' : 'green'}
                />
                <StatCard
                  title="Fumbles"
                  value={metrics.offense.ballSecurity.fumbles.toString()}
                  subtitle="Fumbles lost"
                />
                <StatCard
                  title="Interceptions"
                  value={metrics.offense.ballSecurity.interceptions.toString()}
                  subtitle="Passes intercepted"
                />
              </div>
            </div>

            {/* Possession */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Possession</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                  title="Time of Possession"
                  value={metrics.offense.possession.timeOfPossessionFormatted}
                  subtitle={`${(metrics.offense.possession.timeOfPossessionPerGame || 0).toFixed(0)} sec/game`}
                  tooltip={METRIC_DEFINITIONS.timeOfPossession}
                />
                <StatCard
                  title="Avg Play Duration"
                  value={`${(metrics.offense.possession.averagePlayDuration || 0).toFixed(1)}s`}
                  subtitle="Seconds per play"
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* QB Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('qb')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Quarterback Stats</span>
          {expandedSections.qb ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.qb && (
          <QBStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* RB Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('rb')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Running Back Stats</span>
          {expandedSections.rb ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.rb && (
          <RBStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* WR/TE Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('wrte')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Receiver Stats (WR/TE)</span>
          {expandedSections.wrte ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.wrte && (
          <WRTEStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>

      {/* OL Stats */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('ol')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Line Stats</span>
          {expandedSections.ol ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.ol && (
          <OLStatsSection teamId={teamId} gameId={filters.gameId || gameId} />
        )}
      </section>
    </div>
  );
}
