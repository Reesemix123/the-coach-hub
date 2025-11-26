/**
 * Season Overview Report
 *
 * Displays all 28 comprehensive team metrics organized by category.
 * Migrated from the old Metrics page.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function SeasonOverviewReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    offensive: true,
    defensive: true,
    specialTeams: true,
    overall: true,
    summary: true,
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

      // Get comprehensive metrics directly from database function
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
        <div className="text-gray-600">Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load metrics</p>
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
            Metrics will appear once you tag plays with the new scoring and special teams fields.
          </p>
        </div>
      )}

      {/* Offensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('offensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Metrics</span>
          {expandedSections.offensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.offensive && (
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

      {/* Defensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('defensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Metrics</span>
          {expandedSections.defensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.defensive && (
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
              color={(metrics.defense.volume.totalYardsAllowedPerGame || 999) < 300 ? 'green' : 'default'}
            />
            <StatCard
              title="Rush Yards Allowed/Game"
              value={metrics.defense.volume.rushingYardsAllowedPerGame?.toFixed(1) || '0.0'}
              subtitle="Rushing yards allowed"
            />
            <StatCard
              title="Pass Yards Allowed/Game"
              value={metrics.defense.volume.passingYardsAllowedPerGame?.toFixed(1) || '0.0'}
              subtitle="Passing yards allowed"
            />
            <StatCard
              title="Points Allowed/Game"
              value={metrics.defense.volume.pointsAllowedPerGame?.toFixed(1) || '0.0'}
              subtitle="Points given up per game"
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
              subtitle="Yards allowed per play"
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
              subtitle="Opponent TDs in red zone"
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
              subtitle="Disruptive plays per snap"
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
          </>
        )}
      </section>

      {/* Special Teams Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('specialTeams')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Special Teams Metrics</span>
          {expandedSections.specialTeams ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.specialTeams && (
          <>
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
            subtitle="Average starting yard line"
            tooltip={METRIC_DEFINITIONS.averageStartingFieldPosition}
          />
        </div>
          </>
        )}
      </section>

      {/* Overall Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('overall')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Overall Team Metrics</span>
          {expandedSections.overall ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.overall && (
          <>
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
          </>
        )}
      </section>

      {/* Performance Summary */}
      {hasData && (
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <button
            onClick={() => toggleSection('summary')}
            className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4 hover:text-gray-700 transition-colors"
          >
            <span>Performance Summary</span>
            {expandedSections.summary ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>

          {expandedSections.summary && (
            <>
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
            </>
          )}
        </section>
      )}
    </div>
  );
}
