/**
 * Opponent Scouting Report
 *
 * Same 28 metrics as Season Overview but calculated from opponent scouting film.
 * Shows comprehensive opponent analysis for game planning.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { METRIC_DEFINITIONS, type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp, Eye, AlertCircle } from 'lucide-react';

interface OpponentOption {
  name: string;
  gameCount: number;
  playCount: number;
}

export default function OpponentScoutingReport({ teamId, filters }: ReportProps) {
  const supabase = createClient();

  // State
  const [opponents, setOpponents] = useState<OpponentOption[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string>('');
  const [metrics, setMetrics] = useState<ComprehensiveTeamMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Collapsible sections state
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

  // Fetch opponents that have plays tagged with is_opponent_play = true
  // Works with both dedicated scouting games AND regular games where opponent plays were tagged
  useEffect(() => {
    async function loadOpponents() {
      setLoading(true);

      // Get ALL games for this team (not just scouting games)
      const { data: games, error } = await supabase
        .from('games')
        .select('id, opponent, opponent_team_name')
        .eq('team_id', teamId);

      if (error || !games || games.length === 0) {
        console.error('Error fetching games:', error);
        setOpponents([]);
        setLoading(false);
        return;
      }

      // Get videos for these games
      const gameIds = games.map(g => g.id);
      const { data: videos } = await supabase
        .from('videos')
        .select('id, game_id')
        .in('game_id', gameIds);

      if (!videos || videos.length === 0) {
        setOpponents([]);
        setLoading(false);
        return;
      }

      // Get opponent plays (is_opponent_play = true) for these videos
      const videoIds = videos.map(v => v.id);
      const { data: plays } = await supabase
        .from('play_instances')
        .select('video_id')
        .eq('team_id', teamId)
        .eq('is_opponent_play', true)
        .in('video_id', videoIds);

      if (!plays || plays.length === 0) {
        setOpponents([]);
        setLoading(false);
        return;
      }

      // Map video_id to game_id, then to opponent name
      const videoToGame = new Map(videos.map(v => [v.id, v.game_id]));
      const gameToOpponent = new Map(games.map(g => [g.id, g.opponent_team_name || g.opponent]));

      // Count plays per opponent
      const opponentStats = new Map<string, { gameIds: Set<string>; playCount: number }>();

      for (const play of plays) {
        const gameId = videoToGame.get(play.video_id);
        if (!gameId) continue;
        const opponentName = gameToOpponent.get(gameId);
        if (!opponentName) continue;

        if (!opponentStats.has(opponentName)) {
          opponentStats.set(opponentName, { gameIds: new Set(), playCount: 0 });
        }
        const stats = opponentStats.get(opponentName)!;
        stats.gameIds.add(gameId);
        stats.playCount++;
      }

      // Build sorted list - only opponents WITH plays, sorted by play count
      const sortedOpponents = Array.from(opponentStats.entries())
        .map(([name, stats]) => ({
          name,
          gameCount: stats.gameIds.size,
          playCount: stats.playCount,
        }))
        .sort((a, b) => b.playCount - a.playCount);

      setOpponents(sortedOpponents);
      setLoading(false);

      // Auto-select opponent with most plays
      if (sortedOpponents.length > 0 && !selectedOpponent) {
        setSelectedOpponent(sortedOpponents[0].name);
      }
    }

    loadOpponents();
  }, [teamId]);

  // Load metrics when opponent changes
  useEffect(() => {
    async function loadMetrics() {
      if (!selectedOpponent) return;

      setLoadingMetrics(true);

      // Call the calculate_opponent_metrics function
      const { data: metricsData, error } = await supabase.rpc('calculate_opponent_metrics', {
        p_team_id: teamId,
        p_opponent_name: selectedOpponent,
        p_game_id: null,
      });

      if (error) {
        console.error('Error loading opponent metrics:', error);
        setLoadingMetrics(false);
        return;
      }

      setMetrics(metricsData as ComprehensiveTeamMetrics);
      setLoadingMetrics(false);
    }

    loadMetrics();
  }, [teamId, selectedOpponent]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading opponents...</div>
      </div>
    );
  }

  if (opponents.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <Eye className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Opponent Plays Tagged</h3>
        <p className="text-gray-600 mb-4">
          Tag opponent plays in the Film section to see their metrics here.
        </p>
        <p className="text-sm text-gray-500">
          Upload scouting film, then tag plays with &quot;Opponent Play&quot; checked.
        </p>
      </div>
    );
  }

  const gamesAnalyzed = metrics?.filters?.gamesAnalyzed || metrics?.filters?.gamesPlayed || 0;
  const hasData = gamesAnalyzed > 0 && (metrics?.offense?.volume?.totalYards || 0) > 0;

  return (
    <div>
      {/* Opponent Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Opponent
        </label>
        <div className="relative">
          <select
            value={selectedOpponent}
            onChange={(e) => setSelectedOpponent(e.target.value)}
            className="w-full md:w-64 px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 appearance-none cursor-pointer"
          >
            {opponents.map((opponent) => (
              <option key={opponent.name} value={opponent.name}>
                {opponent.name} ({opponent.playCount} plays)
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Loading State */}
      {loadingMetrics && (
        <div className="text-center py-12">
          <div className="text-gray-600">Loading {selectedOpponent} metrics...</div>
        </div>
      )}

      {/* No Data State */}
      {!loadingMetrics && !hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">No Tagged Plays Found</h3>
              <p className="text-sm text-amber-700 mt-1">
                Tag opponent plays in the Film section to see metrics for {selectedOpponent}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Content - Same structure as Season Overview */}
      {!loadingMetrics && hasData && metrics && (
        <>
          {/* Header */}
          <div className="mb-8">
            <p className="text-gray-600">
              {gamesAnalyzed} game{gamesAnalyzed > 1 ? 's' : ''} analyzed for {selectedOpponent}
            </p>
          </div>

          {/* Opponent Offensive Metrics (what they do on offense) */}
          <section className="mb-12">
            <button
              onClick={() => toggleSection('offensive')}
              className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
            >
              <span>{selectedOpponent} Offense</span>
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
                      label="Total Yards/Game"
                      value={metrics.offense.volume.totalYardsPerGame?.toFixed(1) || '0.0'}
                      subtitle="Their total offense per game"
                      tooltip={METRIC_DEFINITIONS.totalYardsPerGame}
                    />
                    <StatCard
                      label="Rushing Yards/Game"
                      value={metrics.offense.volume.rushingYardsPerGame?.toFixed(1) || '0.0'}
                      subtitle="Their rushing average"
                      tooltip={METRIC_DEFINITIONS.rushingYardsPerGame}
                    />
                    <StatCard
                      label="Passing Yards/Game"
                      value={metrics.offense.volume.passingYardsPerGame?.toFixed(1) || '0.0'}
                      subtitle="Their passing average"
                      tooltip={METRIC_DEFINITIONS.passingYardsPerGame}
                    />
                    <StatCard
                      label="Touchdowns"
                      value={metrics.offense.volume.touchdowns.toString()}
                      subtitle={`${(metrics.offense.volume.touchdownsPerGame || 0).toFixed(1)} per game`}
                      tooltip={METRIC_DEFINITIONS.touchdowns}
                      color="red"
                    />
                  </div>
                </div>

                {/* Efficiency */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="Yards Per Play"
                      value={metrics.offense.efficiency.yardsPerPlay?.toFixed(1) || '0.0'}
                      subtitle="Their overall efficiency"
                      tooltip={METRIC_DEFINITIONS.yardsPerPlay}
                      color={(metrics.offense.efficiency.yardsPerPlay || 0) >= 5.5 ? 'red' : 'default'}
                    />
                    <StatCard
                      label="Yards Per Carry"
                      value={metrics.offense.efficiency.yardsPerCarry?.toFixed(1) || '0.0'}
                      subtitle="Their rushing efficiency"
                      tooltip={METRIC_DEFINITIONS.yardsPerCarry}
                    />
                    <StatCard
                      label="Yards Per Completion"
                      value={metrics.offense.efficiency.yardsPerCompletion?.toFixed(1) || '0.0'}
                      subtitle="Average yards per catch"
                      tooltip={METRIC_DEFINITIONS.yardsPerCompletion}
                    />
                    <StatCard
                      label="Completion %"
                      value={`${(metrics.offense.efficiency.completionPercentage || 0).toFixed(0)}%`}
                      subtitle="Passing accuracy"
                      hint="60%+ is good"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <StatCard
                      label="3rd Down Conv %"
                      value={`${(metrics.offense.efficiency.thirdDownConversionRate || 0).toFixed(0)}%`}
                      subtitle={`${metrics.offense.efficiency.thirdDownConversions} of ${metrics.offense.efficiency.thirdDownAttempts}`}
                      tooltip={METRIC_DEFINITIONS.thirdDownConversionRate}
                      color={(metrics.offense.efficiency.thirdDownConversionRate || 0) >= 40 ? 'red' : 'default'}
                    />
                    <StatCard
                      label="Red Zone Efficiency"
                      value={`${(metrics.offense.efficiency.redZoneEfficiency || 0).toFixed(0)}%`}
                      subtitle="Their scoring in red zone"
                      tooltip={METRIC_DEFINITIONS.redZoneEfficiency}
                      color={(metrics.offense.efficiency.redZoneEfficiency || 0) >= 60 ? 'red' : 'default'}
                    />
                  </div>
                </div>

                {/* Ball Security */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ball Security (Weaknesses to Exploit)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard
                      label="Turnovers"
                      value={metrics.offense.ballSecurity.turnovers.toString()}
                      subtitle={`${(metrics.offense.ballSecurity.turnoversPerGame || 0).toFixed(1)} per game`}
                      tooltip={METRIC_DEFINITIONS.turnovers}
                      color={metrics.offense.ballSecurity.turnovers > 0 ? 'green' : 'default'}
                    />
                    <StatCard
                      label="Fumbles"
                      value={metrics.offense.ballSecurity.fumbles.toString()}
                      subtitle="Fumbles lost"
                      hint="Opportunity for your defense"
                    />
                    <StatCard
                      label="Interceptions"
                      value={metrics.offense.ballSecurity.interceptions.toString()}
                      subtitle="Passes intercepted"
                      hint="Target their QB"
                    />
                  </div>
                </div>

                {/* Possession */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Possession</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard
                      label="Time of Possession"
                      value={metrics.offense.possession.timeOfPossessionFormatted}
                      subtitle={`${(metrics.offense.possession.timeOfPossessionPerGame || 0).toFixed(0)} sec/game`}
                      tooltip={METRIC_DEFINITIONS.timeOfPossession}
                    />
                    <StatCard
                      label="Avg Play Duration"
                      value={`${(metrics.offense.possession.averagePlayDuration || 0).toFixed(1)}s`}
                      subtitle="Seconds per play"
                      hint="Tempo indicator"
                    />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Opponent Defensive Metrics (how good their defense is) */}
          <section className="mb-12">
            <button
              onClick={() => toggleSection('defensive')}
              className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
            >
              <span>{selectedOpponent} Defense</span>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">What They Allow</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="Yards Allowed/Game"
                      value={metrics.defense.volume.totalYardsAllowedPerGame?.toFixed(1) || '0.0'}
                      subtitle="Total yards they give up"
                      tooltip={METRIC_DEFINITIONS.totalYardsAllowedPerGame}
                      color={(metrics.defense.volume.totalYardsAllowedPerGame || 0) > 300 ? 'green' : 'default'}
                    />
                    <StatCard
                      label="Rush Yards/Game"
                      value={metrics.defense.volume.rushingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                      subtitle="Run defense weakness"
                      hint="Can you run on them?"
                    />
                    <StatCard
                      label="Pass Yards/Game"
                      value={metrics.defense.volume.passingYardsAllowedPerGame?.toFixed(1) || '0.0'}
                      subtitle="Pass defense weakness"
                      hint="Can you pass on them?"
                    />
                    <StatCard
                      label="Points Allowed/Game"
                      value={metrics.defense.volume.pointsAllowedPerGame?.toFixed(1) || '0.0'}
                      subtitle="Scoring allowed"
                      tooltip={METRIC_DEFINITIONS.pointsAllowedPerGame}
                      color={(metrics.defense.volume.pointsAllowedPerGame || 0) > 20 ? 'green' : 'default'}
                    />
                  </div>
                </div>

                {/* Efficiency */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Defensive Efficiency</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard
                      label="Yards/Play Allowed"
                      value={metrics.defense.efficiency.yardsPerPlayAllowed?.toFixed(1) || '0.0'}
                      subtitle="Per play efficiency"
                      tooltip={METRIC_DEFINITIONS.yardsPerPlayAllowed}
                      color={(metrics.defense.efficiency.yardsPerPlayAllowed || 0) > 5.0 ? 'green' : 'default'}
                    />
                    <StatCard
                      label="3rd Down Stop %"
                      value={`${(metrics.defense.efficiency.thirdDownStopPercentage || 0).toFixed(0)}%`}
                      subtitle="How often they get off field"
                      tooltip={METRIC_DEFINITIONS.thirdDownStopPercentage}
                      color={(metrics.defense.efficiency.thirdDownStopPercentage || 100) < 60 ? 'green' : 'default'}
                    />
                    <StatCard
                      label="Red Zone Defense"
                      value={`${(metrics.defense.efficiency.redZoneDefense || 0).toFixed(0)}%`}
                      subtitle="TDs allowed in red zone"
                      tooltip={METRIC_DEFINITIONS.redZoneDefense}
                      color={(metrics.defense.efficiency.redZoneDefense || 0) > 50 ? 'green' : 'default'}
                    />
                  </div>
                </div>

                {/* Disruptive */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Disruptive Plays (Protect Against)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="Takeaways"
                      value={metrics.defense.disruptive.takeaways.toString()}
                      subtitle={`${(metrics.defense.disruptive.takeawaysPerGame || 0).toFixed(1)} per game`}
                      tooltip={METRIC_DEFINITIONS.takeaways}
                      color={(metrics.defense.disruptive.takeaways || 0) > 2 ? 'red' : 'default'}
                    />
                    <StatCard
                      label="Sacks"
                      value={metrics.defense.disruptive.sacks.toString()}
                      subtitle="QB sacks"
                      tooltip={METRIC_DEFINITIONS.sacks}
                      color={(metrics.defense.disruptive.sacks || 0) > 3 ? 'red' : 'default'}
                    />
                    <StatCard
                      label="Tackles For Loss"
                      value={metrics.defense.disruptive.tacklesForLoss.toString()}
                      subtitle="TFLs"
                      tooltip={METRIC_DEFINITIONS.tacklesForLoss}
                    />
                    <StatCard
                      label="Havoc Rate"
                      value={`${(metrics.defense.disruptive.havocRate || 0).toFixed(1)}%`}
                      subtitle="Disruptive play rate"
                      tooltip={METRIC_DEFINITIONS.havocRate}
                      color={(metrics.defense.disruptive.havocRate || 0) >= 10 ? 'red' : 'default'}
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
              <span>{selectedOpponent} Special Teams</span>
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
                    label="Field Goal %"
                    value={`${(metrics.specialTeams.fieldGoalPercentage || 0).toFixed(0)}%`}
                    subtitle={`${metrics.specialTeams.fieldGoalsMade}/${metrics.specialTeams.fieldGoalsAttempted}`}
                    tooltip={METRIC_DEFINITIONS.fieldGoalPercentage}
                  />
                  <StatCard
                    label="Extra Point %"
                    value={`${(metrics.specialTeams.extraPointPercentage || 0).toFixed(0)}%`}
                    subtitle={`${metrics.specialTeams.extraPointsMade}/${metrics.specialTeams.extraPointsAttempted}`}
                    tooltip={METRIC_DEFINITIONS.patPercentage}
                  />
                  <StatCard
                    label="Punt Return Avg"
                    value={metrics.specialTeams.puntReturnAverage?.toFixed(1) || '0.0'}
                    subtitle={`${metrics.specialTeams.puntReturns} returns`}
                    tooltip={METRIC_DEFINITIONS.puntReturnAverage}
                    color={(metrics.specialTeams.puntReturnAverage || 0) > 10 ? 'red' : 'default'}
                  />
                  <StatCard
                    label="Kick Return Avg"
                    value={metrics.specialTeams.kickoffReturnAverage?.toFixed(1) || '0.0'}
                    subtitle={`${metrics.specialTeams.kickoffReturns} returns`}
                    hint="Dangerous returner?"
                    color={(metrics.specialTeams.kickoffReturnAverage || 0) > 25 ? 'red' : 'default'}
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
              <span>Overall Assessment</span>
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
                    label="Turnover Differential"
                    value={metrics.overall.turnoverDifferential >= 0
                      ? `+${metrics.overall.turnoverDifferential}`
                      : metrics.overall.turnoverDifferential.toString()
                    }
                    subtitle="Their turnover margin"
                    tooltip={METRIC_DEFINITIONS.turnoverDifferential}
                    color={
                      metrics.overall.turnoverDifferential > 0
                        ? 'red'
                        : metrics.overall.turnoverDifferential < 0
                          ? 'green'
                          : 'default'
                    }
                  />
                </div>
              </>
            )}
          </section>

          {/* Scouting Summary */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4 hover:text-gray-700 transition-colors"
            >
              <span>Scouting Summary</span>
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
                    <span className="font-medium">Their Offensive Threat:</span>{' '}
                    {(() => {
                      const ypg = metrics.offense.volume.totalYardsPerGame || 0;
                      const tdpg = metrics.offense.volume.touchdownsPerGame || 0;
                      const ypp = metrics.offense.efficiency.yardsPerPlay || 0;

                      if (ypg >= 300 && tdpg >= 2 && ypp >= 5.5) {
                        return '🔴 High - Explosive offense, prepare your defense';
                      } else if (ypg >= 200 && (tdpg >= 1 || ypp >= 5.0)) {
                        return '🟡 Moderate - Capable offense, stay disciplined';
                      } else {
                        return '🟢 Low - Limited offense, your defense should contain them';
                      }
                    })()}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Their Defensive Strength:</span>{' '}
                    {(() => {
                      const ypgAllowed = metrics.defense.volume.totalYardsAllowedPerGame || 0;
                      const yppAllowed = metrics.defense.efficiency.yardsPerPlayAllowed || 0;
                      const stopRate = metrics.defense.efficiency.thirdDownStopPercentage || 0;

                      // If no defensive data, say so
                      if (ypgAllowed === 0 && yppAllowed === 0) {
                        return '❓ No defensive data - tag opponent defensive plays to analyze';
                      }

                      if (ypgAllowed < 250 && stopRate > 60) {
                        return '🔴 Strong defense - be creative and take what they give';
                      } else if (ypgAllowed < 350 && stopRate > 40) {
                        return '🟡 Average defense - execute your game plan';
                      } else {
                        return '🟢 Weak defense - attack them';
                      }
                    })()}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Ball Security:</span>{' '}
                    {(() => {
                      const toPerGame = metrics.offense.ballSecurity.turnoversPerGame || 0;
                      const totalTO = metrics.offense.ballSecurity.turnovers || 0;

                      if (toPerGame >= 2) {
                        return '🟢 Turnover prone - pressure them and create opportunities!';
                      } else if (toPerGame >= 1) {
                        return '🟡 Average ball security - play aggressive defense';
                      } else if (totalTO === 0) {
                        return '❓ No turnovers in sample - need more film';
                      } else {
                        return '🔴 They protect the ball - focus on execution';
                      }
                    })()}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Run vs Pass:</span>{' '}
                    {(() => {
                      const rushAllowed = metrics.defense.volume.rushingYardsAllowedPerGame || 0;
                      const passAllowed = metrics.defense.volume.passingYardsAllowedPerGame || 0;

                      if (rushAllowed === 0 && passAllowed === 0) {
                        return '❓ No defensive data - tag opponent defensive plays to see weakness';
                      }

                      const diff = rushAllowed - passAllowed;
                      if (Math.abs(diff) < 20) {
                        return '⚖️ Balanced - mix run and pass';
                      } else if (diff > 0) {
                        return '🏃 Run game opportunity - they give up ' + rushAllowed.toFixed(0) + ' rush yards/game';
                      } else {
                        return '🏈 Pass game opportunity - they give up ' + passAllowed.toFixed(0) + ' pass yards/game';
                      }
                    })()}
                  </p>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
