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
import type { TaggingTier } from '@/types/football';

// Import data-fetching sections
import AllDLStatsSection from '../sections/AllDLStatsSection';
import AllLBStatsSection from '../sections/AllLBStatsSection';
import AllDBStatsSection from '../sections/AllDBStatsSection';

export default function DefensiveReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTier, setCurrentTier] = useState<TaggingTier | undefined>(undefined);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    dl: true,
    lb: true,
    db: true,
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

      // Fetch tagging tier for the selected game
      const selectedGameId = filters.gameId || gameId;
      if (selectedGameId) {
        const { data: gameData } = await supabase
          .from('games')
          .select('tagging_tier')
          .eq('id', selectedGameId)
          .single();

        if (gameData?.tagging_tier) {
          setCurrentTier(gameData.tagging_tier as TaggingTier);
        }
      } else {
        setCurrentTier(undefined);
      }

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
                  value={(metrics.defense?.volume?.totalYardsAllowedPerGame || 0).toFixed(1)}
                  subtitle="Total yards given up"
                  tooltip={METRIC_DEFINITIONS.totalYardsAllowedPerGame}
                  color={(metrics.defense?.volume?.totalYardsAllowedPerGame || 999) <= 300 ? 'green' : 'default'}
                />
                <StatCard
                  title="Rushing Yards Allowed/Game"
                  value={(metrics.defense?.volume?.rushingYardsAllowedPerGame || 0).toFixed(1)}
                  subtitle="Rushing yards given up"
                  tooltip={METRIC_DEFINITIONS.rushingYardsAllowedPerGame}
                />
                <StatCard
                  title="Passing Yards Allowed/Game"
                  value={(metrics.defense?.volume?.passingYardsAllowedPerGame || 0).toFixed(1)}
                  subtitle="Passing yards given up"
                  tooltip={METRIC_DEFINITIONS.passingYardsAllowedPerGame}
                />
                <StatCard
                  title="Points Allowed/Game"
                  value={(metrics.defense?.volume?.pointsAllowedPerGame || 0).toFixed(1)}
                  subtitle="Points given up per game"
                  tooltip={METRIC_DEFINITIONS.pointsAllowedPerGame}
                  color={(metrics.defense?.volume?.pointsAllowedPerGame || 999) <= 20 ? 'green' : 'default'}
                />
              </div>
            </div>

            {/* Efficiency */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Yards Per Play Allowed"
                  value={(metrics.defense?.efficiency?.yardsPerPlayAllowed || 0).toFixed(2)}
                  subtitle="Yards allowed per play"
                  tooltip={METRIC_DEFINITIONS.yardsPerPlayAllowed}
                  color={(metrics.defense?.efficiency?.yardsPerPlayAllowed || 999) <= 5.0 ? 'green' : 'default'}
                />
                <StatCard
                  title="3rd Down Stop Rate"
                  value={`${(metrics.defense?.efficiency?.thirdDownStopRate || 0).toFixed(1)}%`}
                  subtitle={`${metrics.defense?.efficiency?.thirdDownStops || 0} of ${metrics.defense?.efficiency?.thirdDownAttempts || 0}`}
                  tooltip={METRIC_DEFINITIONS.thirdDownStopRate}
                  color={(metrics.defense?.efficiency?.thirdDownStopRate || 0) >= 50 ? 'green' : 'default'}
                />
                <StatCard
                  title="Red Zone TD Rate"
                  value={`${(metrics.defense?.efficiency?.redZoneTDRate || 0).toFixed(1)}%`}
                  subtitle="Opponent TDs in red zone"
                  tooltip={METRIC_DEFINITIONS.redZoneTDRate}
                  color={(metrics.defense?.efficiency?.redZoneTDRate || 999) <= 50 ? 'green' : 'default'}
                />
                <StatCard
                  title="Completion % Allowed"
                  value={`${(metrics.defense?.efficiency?.completionPercentageAllowed || 0).toFixed(1)}%`}
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
                  value={`${(metrics.defense?.disruptive?.havocRate || 0).toFixed(1)}%`}
                  subtitle="Disruptive plays per snap"
                  tooltip={METRIC_DEFINITIONS.havocRate}
                  color={(metrics.defense?.disruptive?.havocRate || 0) >= 10 ? 'green' : 'default'}
                />
                <StatCard
                  title="Sacks"
                  value={(metrics.defense?.disruptive?.sacks || 0).toString()}
                  subtitle={`${(metrics.defense?.disruptive?.sacksPerGame || 0).toFixed(2)} per game`}
                  color={(metrics.defense?.disruptive?.sacks || 0) > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Turnovers Forced"
                  value={(metrics.defense?.disruptive?.turnoversForced || 0).toString()}
                  subtitle={`${(metrics.defense?.disruptive?.turnoversPerGame || 0).toFixed(2)} per game`}
                  tooltip={METRIC_DEFINITIONS.turnoversForced}
                  color={(metrics.defense?.disruptive?.turnoversForced || 0) > 0 ? 'green' : 'default'}
                />
                <StatCard
                  title="Tackles For Loss"
                  value={(metrics.defense?.disruptive?.tacklesForLoss || 0).toString()}
                  subtitle={`${(metrics.defense?.disruptive?.tflPerGame || 0).toFixed(2)} per game`}
                  color={(metrics.defense?.disruptive?.tacklesForLoss || 0) > 0 ? 'green' : 'default'}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* DL Stats */}
      {expandedSections.dl && (
        <AllDLStatsSection teamId={teamId} gameId={filters.gameId || gameId} currentTier={currentTier} />
      )}

      {/* LB Stats */}
      {expandedSections.lb && (
        <AllLBStatsSection teamId={teamId} gameId={filters.gameId || gameId} currentTier={currentTier} />
      )}

      {/* DB Stats */}
      {expandedSections.db && (
        <AllDBStatsSection teamId={teamId} gameId={filters.gameId || gameId} currentTier={currentTier} />
      )}
    </div>
  );
}
