'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import TeamNavigation from '@/components/TeamNavigation';

/**
 * Comprehensive Metrics Dashboard
 *
 * Displays all 28 football metrics organized by category:
 * - Offensive Metrics (Volume, Efficiency, Ball Security, Possession)
 * - Defensive Metrics (Volume, Efficiency, Disruptive)
 * - Special Teams Metrics
 * - Overall Metrics
 */

interface Team {
  id: string;
  name: string;
  level: string;
}

interface MetricsPageProps {
  params: Promise<{
    teamId: string;
  }>;
  searchParams?: Promise<{
    gameId?: string;
  }>;
}

export default function MetricsPage({ params, searchParams }: MetricsPageProps) {
  const { teamId } = use(params);
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get team info
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, level')
        .eq('id', teamId)
        .single();

      if (!teamData) {
        router.push('/');
        return;
      }

      setTeam(teamData);

      // Get comprehensive metrics directly from database function
      const { data: metricsData, error: metricsError } = await supabase.rpc('calculate_team_metrics', {
        p_team_id: teamId,
        p_game_id: null,
        p_start_date: null,
        p_end_date: null,
        p_opponent: null,
      });

      if (metricsError) {
        console.error('Error loading metrics:', metricsError);
        setLoading(false);
        return;
      }

      setMetrics(metricsData as ComprehensiveTeamMetrics);
      setLoading(false);
    }

    loadData();
  }, [teamId, router]);

  if (loading || !team || !metrics) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Loading metrics...</div>
      </div>
    );
  }

  const gamesPlayed = metrics.filters.gamesPlayed || 0;
  const hasData = gamesPlayed > 0;

  return (
    <div className="min-h-screen bg-white">
      <TeamNavigation team={team} teamId={teamId} currentPage="metrics" />

      {/* Deprecation Notice */}
      <div className="bg-yellow-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                New Analytics and Reporting System Available
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                This metrics page has been migrated to the new Analytics and Reporting system with
                enhanced features, better organization, and comprehensive reports. This page will be
                deprecated in a future update.
              </p>
              <button
                onClick={() => router.push(`/teams/${teamId}/analytics-reporting`)}
                className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Go to Analytics and Reporting →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
            Comprehensive Metrics
          </h1>
          <p className="text-gray-600">
            {gamesPlayed === 0 ? 'No games played' : `${gamesPlayed} game${gamesPlayed > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* No Data Message */}
        {!hasData && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-8">
            <p className="text-gray-600 text-lg mb-2">No data available yet</p>
            <p className="text-gray-500 text-sm">
              Metrics will appear once you tag plays with the new scoring and special teams fields.
            </p>
          </div>
        )}

        {/* Offensive Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
            Offensive Metrics
          </h2>

          {/* Volume */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Yards/Game"
                value={metrics.offense.volume.totalYardsPerGame?.toFixed(1) || '0.0'}
                subtitle="Offensive production"
                tooltip={METRIC_DEFINITIONS.totalYardsPerGame}
              />
              <StatCard
                title="Rushing Yards/Game"
                value={metrics.offense.volume.rushingYardsPerGame?.toFixed(1) || '0.0'}
                subtitle="Ground game"
                tooltip={METRIC_DEFINITIONS.rushingYardsPerGame}
              />
              <StatCard
                title="Passing Yards/Game"
                value={metrics.offense.volume.passingYardsPerGame?.toFixed(1) || '0.0'}
                subtitle="Air attack"
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
                subtitle="Most important efficiency metric"
                tooltip={METRIC_DEFINITIONS.yardsPerPlay}
                color={(metrics.offense.efficiency.yardsPerPlay || 0) >= 5.5 ? 'green' : 'default'}
              />
              <StatCard
                title="Yards Per Carry"
                value={metrics.offense.efficiency.yardsPerCarry?.toFixed(2) || '0.00'}
                subtitle="Run efficiency"
                tooltip={METRIC_DEFINITIONS.yardsPerCarry}
              />
              <StatCard
                title="Yards Per Completion"
                value={metrics.offense.efficiency.yardsPerCompletion?.toFixed(1) || '0.0'}
                subtitle="Big play ability"
                tooltip={METRIC_DEFINITIONS.yardsPerCompletion}
              />
              <StatCard
                title="Completion %"
                value={`${(metrics.offense.efficiency.completionPercentage || 0).toFixed(1)}%`}
                subtitle="Pass accuracy"
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
        </section>

        {/* Defensive Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
            Defensive Metrics
          </h2>

          {/* Volume */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Yards Allowed/Game"
                value={metrics.defense.volume.totalYardsAllowedPerGame?.toFixed(1) || '0.0'}
                subtitle="Overall defense"
                tooltip={METRIC_DEFINITIONS.totalYardsAllowedPerGame}
                color={(metrics.defense.volume.totalYardsAllowedPerGame || 999) < 300 ? 'green' : 'default'}
              />
              <StatCard
                title="Rush Yards Allowed/Game"
                value={metrics.defense.volume.rushingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                subtitle="Run defense"
              />
              <StatCard
                title="Pass Yards Allowed/Game"
                value={metrics.defense.volume.passingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                subtitle="Pass defense"
              />
              <StatCard
                title="Points Allowed/Game"
                value={metrics.defense.volume.pointsAllowedPerGame?.toFixed(1) || '0.0'}
                subtitle="Scoring defense"
                tooltip={METRIC_DEFINITIONS.pointsAllowedPerGame}
                color={(metrics.defense.volume.pointsAllowedPerGame || 999) < 20 ? 'green' : 'default'}
              />
            </div>
          </div>

          {/* Efficiency */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                title="Yards Per Play Allowed"
                value={metrics.defense.efficiency.yardsPerPlayAllowed?.toFixed(2) || '0.00'}
                subtitle="Defensive efficiency"
                tooltip={METRIC_DEFINITIONS.yardsPerPlayAllowed}
                color={(metrics.defense.efficiency.yardsPerPlayAllowed || 999) < 5.0 ? 'green' : 'default'}
              />
              <StatCard
                title="3rd Down Stop %"
                value={`${(metrics.defense.efficiency.thirdDownStopPercentage || 0).toFixed(1)}%`}
                subtitle={`${metrics.defense.efficiency.opponentThirdDownStops} stops`}
                tooltip={METRIC_DEFINITIONS.thirdDownStopPercentage}
                color={(metrics.defense.efficiency.thirdDownStopPercentage || 0) >= 60 ? 'green' : 'default'}
              />
              <StatCard
                title="Red Zone Defense"
                value={`${(metrics.defense.efficiency.redZoneDefense || 0).toFixed(1)}%`}
                subtitle="Opponent TD rate"
                tooltip={METRIC_DEFINITIONS.redZoneDefense}
                color={(metrics.defense.efficiency.redZoneDefense || 100) < 50 ? 'green' : 'default'}
              />
            </div>
          </div>

          {/* Disruptive */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Disruptive Plays</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Takeaways"
                value={metrics.defense.disruptive.takeaways.toString()}
                subtitle={`${(metrics.defense.disruptive.takeawaysPerGame || 0).toFixed(2)} per game`}
                tooltip={METRIC_DEFINITIONS.takeaways}
                color="green"
              />
              <StatCard
                title="Sacks"
                value={metrics.defense.disruptive.sacks.toString()}
                subtitle="QB sacks"
                tooltip={METRIC_DEFINITIONS.sacks}
              />
              <StatCard
                title="Tackles For Loss"
                value={metrics.defense.disruptive.tacklesForLoss.toString()}
                subtitle="TFLs"
                tooltip={METRIC_DEFINITIONS.tacklesForLoss}
              />
              <StatCard
                title="Havoc Rate"
                value={`${(metrics.defense.disruptive.havocRate || 0).toFixed(1)}%`}
                subtitle="Disruptive play rate"
                tooltip={METRIC_DEFINITIONS.havocRate}
                color={(metrics.defense.disruptive.havocRate || 0) >= 10 ? 'green' : 'default'}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <StatCard
                title="Interceptions"
                value={metrics.defense.disruptive.interceptions.toString()}
                subtitle="Passes intercepted"
              />
              <StatCard
                title="Fumble Recoveries"
                value={metrics.defense.disruptive.fumbleRecoveries.toString()}
                subtitle="Fumbles recovered"
              />
              <StatCard
                title="Pass Breakups"
                value={metrics.defense.disruptive.passBreakups.toString()}
                subtitle="PBUs"
              />
            </div>
          </div>
        </section>

        {/* Special Teams Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
            Special Teams Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Field Goal %"
              value={`${(metrics.specialTeams.fieldGoalPercentage || 0).toFixed(1)}%`}
              subtitle={`${metrics.specialTeams.fieldGoalsMade}/${metrics.specialTeams.fieldGoalsAttempted}`}
              tooltip={METRIC_DEFINITIONS.fieldGoalPercentage}
              color={(metrics.specialTeams.fieldGoalPercentage || 0) >= 75 ? 'green' : 'default'}
            />
            <StatCard
              title="Extra Point %"
              value={`${(metrics.specialTeams.extraPointPercentage || 0).toFixed(1)}%`}
              subtitle={`${metrics.specialTeams.extraPointsMade}/${metrics.specialTeams.extraPointsAttempted}`}
            />
            <StatCard
              title="Punt Return Avg"
              value={metrics.specialTeams.puntReturnAverage?.toFixed(1) || '0.0'}
              subtitle={`${metrics.specialTeams.puntReturns} returns`}
              tooltip={METRIC_DEFINITIONS.puntReturnAverage}
            />
            <StatCard
              title="Kickoff Return Avg"
              value={metrics.specialTeams.kickoffReturnAverage?.toFixed(1) || '0.0'}
              subtitle={`${metrics.specialTeams.kickoffReturns} returns`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <StatCard
              title="Avg Starting Field Position"
              value={metrics.specialTeams.averageStartingFieldPosition?.toFixed(1) || '0.0'}
              subtitle="Yard line"
              tooltip={METRIC_DEFINITIONS.averageStartingFieldPosition}
            />
          </div>
        </section>

        {/* Overall Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
            Overall Team Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Turnover Differential"
              value={metrics.overall.turnoverDifferential >= 0
                ? `+${metrics.overall.turnoverDifferential}`
                : metrics.overall.turnoverDifferential.toString()
              }
              subtitle="Best win predictor"
              tooltip={METRIC_DEFINITIONS.turnoverDifferential}
              color={
                metrics.overall.turnoverDifferential > 0
                  ? 'green'
                  : metrics.overall.turnoverDifferential < 0
                    ? 'red'
                    : 'default'
              }
            />
          </div>
        </section>

        {/* Performance Summary */}
        {hasData && (
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Offensive Rating:</span>{' '}
                {(metrics.offense.efficiency.yardsPerPlay || 0) > 5.5 &&
                 (metrics.offense.efficiency.thirdDownConversionRate || 0) > 40 &&
                 (metrics.offense.ballSecurity.turnoversPerGame || 0) < 1.5
                  ? '✅ Excellent'
                  : '⚠️ Needs Improvement'
                }
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Defensive Rating:</span>{' '}
                {(metrics.defense.efficiency.yardsPerPlayAllowed || 999) < 5.0 &&
                 (metrics.defense.efficiency.thirdDownStopPercentage || 0) > 60 &&
                 (metrics.defense.disruptive.takeawaysPerGame || 0) > 1.0
                  ? '✅ Excellent'
                  : '⚠️ Needs Improvement'
                }
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Turnover Margin:</span>{' '}
                {metrics.overall.turnoverDifferential > 0
                  ? `✅ Winning turnover battle (+${metrics.overall.turnoverDifferential})`
                  : metrics.overall.turnoverDifferential < 0
                    ? `❌ Losing turnover battle (${metrics.overall.turnoverDifferential})`
                    : '➖ Even on turnovers'
                }
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
