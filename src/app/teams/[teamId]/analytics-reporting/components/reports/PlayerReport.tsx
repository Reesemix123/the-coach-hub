/**
 * Player Report
 *
 * Individual player performance analysis with position-specific metrics.
 * Shows separate sections for Offense, Defense, and Special Teams based on actual participation.
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReportProps } from '@/types/reports';
import StatCard from '@/components/analytics/StatCard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnalyticsService, PlayerStats } from '@/lib/services/analytics.service';
import type { MetricDefinition } from '@/lib/analytics/metricDefinitions';

// ============================================================================
// Player-Specific Metric Definitions (for tooltips)
// ============================================================================
const PLAYER_METRICS: Record<string, MetricDefinition> = {
  // General
  totalSnaps: {
    title: 'Total Snaps',
    description: 'Number of offensive plays this player participated in',
    useful: 'Shows playing time and involvement in the offense. More snaps = more opportunities.',
    calculation: 'Count of plays where player has a participation record (rusher, passer, or receiver)',
  },
  successRate: {
    title: 'Success Rate',
    description: 'Percentage of plays where expected yards were gained',
    useful: 'Shows how consistently the player helps move the chains. 50%+ is strong.',
    calculation: '1st down: gain 40% of distance | 2nd down: 60% | 3rd/4th: 100% (convert)',
  },

  // Passing
  compAtt: {
    title: 'Comp/Att',
    description: 'Completions divided by pass attempts',
    useful: 'Shows accuracy and efficiency. Completion percentage of 60%+ is good for youth football.',
    calculation: 'Number of completed passes ÷ Number of pass attempts',
  },
  passingYards: {
    title: 'Passing Yards',
    description: 'Total yards gained through completed passes',
    useful: 'Shows passing volume and production. Context matters - 100+ yards/game is solid.',
    calculation: 'Sum of yards gained on all completed passes',
  },
  ypa: {
    title: 'Yards Per Attempt (YPA)',
    description: 'Average yards gained on each pass attempt (completed or not)',
    useful: 'Best efficiency metric for QBs. 7+ YPA is elite. Includes incomplete passes so it measures decision-making.',
    calculation: 'Total passing yards ÷ Total pass attempts',
  },
  tdIntRatio: {
    title: 'TD:INT Ratio',
    description: 'Touchdowns thrown compared to interceptions',
    useful: 'Shows ball security and decision-making. Positive ratio (more TDs than INTs) is the goal.',
    calculation: 'Passing touchdowns : Interceptions thrown',
  },
  passingTouchdowns: {
    title: 'Passing TDs',
    description: 'Number of touchdown passes thrown',
    useful: 'Ultimate measure of QB scoring production. Context of games played matters.',
    calculation: 'Count of completed passes that result in touchdowns',
  },
  interceptions: {
    title: 'Interceptions',
    description: 'Passes thrown that were caught by the defense',
    useful: 'Shows decision-making and ball security issues. Fewer is better. 0-1 per game is ideal.',
    calculation: 'Count of passes intercepted by opponents',
  },

  // Rushing
  carries: {
    title: 'Carries',
    description: 'Number of rushing attempts',
    useful: 'Shows workload and usage. More carries = higher volume role in offense.',
    calculation: 'Count of plays where player was the ball carrier (rusher)',
  },
  rushingYards: {
    title: 'Rushing Yards',
    description: 'Total yards gained on rushing attempts',
    useful: 'Primary production metric for RBs. 75+ yards/game is productive.',
    calculation: 'Sum of yards gained on all rushing attempts',
  },
  ypc: {
    title: 'Yards Per Carry (YPC)',
    description: 'Average yards gained on each rushing attempt',
    useful: 'Key efficiency metric for ball carriers. 4.0+ YPC is good. 5.0+ is excellent.',
    calculation: 'Total rushing yards ÷ Total carries',
  },
  rushingTouchdowns: {
    title: 'Rushing TDs',
    description: 'Number of rushing touchdowns scored',
    useful: 'Shows goal-line and scoring ability. Red zone production matters.',
    calculation: 'Count of rushing attempts that result in touchdowns',
  },
  fumbles: {
    title: 'Fumbles',
    description: 'Number of fumbles lost while carrying the ball',
    useful: 'Critical ball security metric. 0 is the goal. Any fumbles need coaching attention.',
    calculation: 'Count of plays where ball carrier lost the ball',
  },

  // Receiving
  recTargets: {
    title: 'Rec/Targets',
    description: 'Receptions compared to times targeted',
    useful: 'Shows catch rate and reliability. High catch rate = trustworthy target.',
    calculation: 'Catches made ÷ Times ball was thrown to player',
  },
  catchRate: {
    title: 'Catch Rate',
    description: 'Percentage of targets that result in catches',
    useful: 'Key reliability metric. 65%+ is very good. 70%+ is elite.',
    calculation: '(Receptions ÷ Targets) × 100',
  },
  receivingYards: {
    title: 'Receiving Yards',
    description: 'Total yards gained on receptions',
    useful: 'Primary production metric for receivers. 50+ yards/game is productive.',
    calculation: 'Sum of yards gained on all receptions',
  },
  ypr: {
    title: 'Yards Per Reception (YPR)',
    description: 'Average yards gained when catching the ball',
    useful: 'Shows big-play ability after the catch. 10+ YPR is good. 15+ is explosive.',
    calculation: 'Total receiving yards ÷ Total receptions',
  },
  ypt: {
    title: 'Yards Per Target (YPT)',
    description: 'Average yards gained per time targeted',
    useful: 'Best efficiency metric for receivers. Accounts for incomplete passes. 8+ is good.',
    calculation: 'Total receiving yards ÷ Total targets',
  },
  receivingTouchdowns: {
    title: 'Receiving TDs',
    description: 'Number of touchdowns caught',
    useful: 'Shows red zone reliability and scoring ability.',
    calculation: 'Count of receptions that result in touchdowns',
  },
  drops: {
    title: 'Drops',
    description: 'Catchable passes that were not caught',
    useful: 'Shows hands and concentration issues. 0 is the goal. Drops kill drives.',
    calculation: 'Count of targets marked as catchable but not caught',
  },

  // Defensive
  defensiveSnaps: {
    title: 'Defensive Snaps',
    description: 'Number of defensive plays this player participated in',
    useful: 'Shows playing time on defense. More snaps = more opportunity to make plays.',
    calculation: 'Count of plays where player has a defensive participation record',
  },
  tackleRate: {
    title: 'Tackle Rate',
    description: 'Percentage of snaps that result in a tackle',
    useful: 'Shows involvement and productivity. 10%+ is very active. LBs typically higher than DBs.',
    calculation: '(Total tackles ÷ Defensive snaps) × 100',
  },
  missedTackleRate: {
    title: 'Missed Tackle %',
    description: 'Percentage of tackle attempts that were missed',
    useful: 'Shows tackling technique and reliability. 10% or less is good. High rate needs work.',
    calculation: '(Missed tackles ÷ (Tackles + Missed tackles)) × 100',
  },
  totalTackles: {
    title: 'Total Tackles',
    description: 'Combined solo and assisted tackles',
    useful: 'Primary production metric for defenders. 5+ per game is productive.',
    calculation: 'Count of plays where player made primary or assisted tackle',
  },
  missedTackles: {
    title: 'Missed Tackles',
    description: 'Tackle attempts that did not bring down the ball carrier',
    useful: 'Identifies technique issues. Every missed tackle is a potential big play for offense.',
    calculation: 'Count of plays where player attempted but failed to make tackle',
  },
  sacks: {
    title: 'Sacks',
    description: 'Times QB was tackled behind line of scrimmage on pass plays',
    useful: 'Game-changing plays. Elite pass rushers get 1+ per game. Forces punts and turnovers.',
    calculation: 'Count of pressures that resulted in tackling the QB',
  },
  sackRate: {
    title: 'Sack Rate',
    description: 'Percentage of snaps that result in a sack',
    useful: 'Shows pass rush effectiveness. 3%+ is elite. 1-2% is good.',
    calculation: '(Sacks ÷ Defensive snaps) × 100',
  },
  pressures: {
    title: 'Pressures',
    description: 'Times QB was hurried, hit, or forced out of pocket',
    useful: 'Pressures lead to bad throws. Shows pass rush impact beyond just sacks.',
    calculation: 'Count of plays where player affected QB before throw',
  },
  pressureRate: {
    title: 'Pressure Rate',
    description: 'Percentage of snaps that result in a QB pressure',
    useful: 'Shows consistent pass rush ability. 10%+ is very disruptive.',
    calculation: '(Pressures ÷ Defensive snaps) × 100',
  },
  defensiveInterceptions: {
    title: 'Interceptions',
    description: 'Passes caught by the defender',
    useful: 'Game-changing turnovers. Elite ball-hawking skill. 1+ per season is impactful.',
    calculation: 'Count of opponent passes caught by player',
  },
  forcedFumbles: {
    title: 'Forced Fumbles',
    description: 'Fumbles caused by this defender',
    useful: 'Creates turnovers and changes games. Shows ball-stripping effort and technique.',
    calculation: 'Count of plays where player forced ball carrier to fumble',
  },

  // Special Teams
  stSnaps: {
    title: 'ST Snaps',
    description: 'Number of special teams plays participated in',
    useful: 'Shows special teams involvement. Key role players get 10+ snaps per game.',
    calculation: 'Count of plays where player participated in special teams',
  },
  fieldGoals: {
    title: 'Field Goals',
    description: 'Field goals made compared to attempts',
    useful: 'Shows kicker accuracy. 75%+ is good. Distance matters - track long attempts.',
    calculation: 'Field goals made ÷ Field goal attempts',
  },
  fgPct: {
    title: 'FG Percentage',
    description: 'Percentage of field goals made',
    useful: 'Key reliability metric for kickers. 75%+ is dependable.',
    calculation: '(Field goals made ÷ Field goal attempts) × 100',
  },
  pats: {
    title: 'PATs',
    description: 'Extra points made compared to attempts',
    useful: 'Shows reliability on routine kicks. 95%+ is expected. Misses are costly.',
    calculation: 'PATs made ÷ PAT attempts',
  },
  punts: {
    title: 'Punts',
    description: 'Number of punts',
    useful: 'Shows volume of punting duties.',
    calculation: 'Count of punt plays',
  },
  puntAvg: {
    title: 'Punt Average',
    description: 'Average yards per punt',
    useful: 'Shows leg strength and consistency. 40+ yards is good for HS. 35+ for youth.',
    calculation: 'Total punt yards ÷ Number of punts',
  },
  returns: {
    title: 'Returns',
    description: 'Number of kick/punt returns',
    useful: 'Shows return duties. More returns = more opportunities for impact.',
    calculation: 'Count of kick and punt returns',
  },
  returnYards: {
    title: 'Return Yards',
    description: 'Total yards on returns',
    useful: 'Shows return production. Starting field position impact.',
    calculation: 'Sum of yards gained on all returns',
  },
  returnAvg: {
    title: 'Return Average',
    description: 'Average yards per return',
    useful: 'Key efficiency metric. 20+ avg on kickoffs, 10+ on punts is good.',
    calculation: 'Total return yards ÷ Number of returns',
  },
  returnTouchdowns: {
    title: 'Return TDs',
    description: 'Touchdowns scored on returns',
    useful: 'Game-changing plays. Elite returners score 1-2 per season.',
    calculation: 'Count of returns that result in touchdowns',
  },
  coverageTackles: {
    title: 'Coverage Tackles',
    description: 'Tackles made on special teams coverage units',
    useful: 'Shows effort and speed on coverage. 1+ per game is productive.',
    calculation: 'Count of tackles made on kick/punt coverage',
  },
};

export default function PlayerReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    offense: true,
    defense: true,
    specialTeams: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadPlayer() {
      if (!filters.playerId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', filters.playerId)
        .single();

      setPlayer(playerData);

      try {
        const analyticsService = new AnalyticsService();
        const playerStats = await analyticsService.getPlayerStats(filters.playerId, teamId, filters.gameId);
        setStats(playerStats);
      } catch (error) {
        console.error('Error loading player stats:', error);
      }

      setLoading(false);
    }

    loadPlayer();
  }, [filters.playerId, filters.gameId, teamId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading player report...</div>
      </div>
    );
  }

  if (!filters.playerId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-yellow-800 text-lg mb-2">No player selected</p>
        <p className="text-yellow-700 text-sm">
          Please select a player from the filter above to view their individual report.
        </p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load player data</p>
      </div>
    );
  }

  // ============================================================================
  // Data-driven phase detection
  // ============================================================================
  const hasOffensiveStats = stats && stats.totalPlays > 0;
  const hasDefensiveStats = stats && stats.defensiveSnaps > 0;
  const hasSpecialTeamsStats = stats && stats.specialTeamsSnaps > 0;
  const hasAnyStats = hasOffensiveStats || hasDefensiveStats || hasSpecialTeamsStats;

  // Position detection for context
  const pos = player.primary_position?.toUpperCase() || '';
  const isQB = pos === 'QB';
  const isRB = ['RB', 'HB', 'FB', 'TB'].includes(pos);
  const isWR = ['WR', 'SE', 'FL', 'X', 'Y', 'Z', 'SLOT'].includes(pos);
  const isTE = ['TE', 'TE1', 'TE2'].includes(pos);
  const isDL = ['DL', 'DE', 'DT', 'NT', 'EDGE'].includes(pos);
  const isLB = ['LB', 'ILB', 'OLB', 'MLB', 'MIKE', 'WILL', 'SAM'].includes(pos);
  const isDB = ['CB', 'S', 'FS', 'SS', 'DB'].includes(pos);

  // ============================================================================
  // Calculated metrics
  // ============================================================================

  // Offensive metrics
  const yardsPerAttempt = stats && stats.passingAttempts > 0
    ? (stats.passingYards / stats.passingAttempts) : 0;
  const tdIntRatio = stats && stats.interceptions > 0
    ? (stats.passingTouchdowns / stats.interceptions).toFixed(1)
    : stats?.passingTouchdowns ? `${stats.passingTouchdowns}:0` : '0:0';
  const catchRate = stats && stats.targets > 0
    ? ((stats.receptions / stats.targets) * 100) : 0;
  const yardsPerTarget = stats && stats.targets > 0
    ? (stats.receivingYards / stats.targets) : 0;

  // Defensive metrics
  const tackleRate = stats && stats.defensiveSnaps > 0
    ? ((stats.tackles / stats.defensiveSnaps) * 100) : 0;
  const pressureRate = stats && stats.defensiveSnaps > 0
    ? ((stats.pressures / stats.defensiveSnaps) * 100) : 0;
  const sackRate = stats && stats.defensiveSnaps > 0
    ? ((stats.sacks / stats.defensiveSnaps) * 100) : 0;
  const missedTackleRate = stats && (stats.tackles + stats.missedTackles) > 0
    ? ((stats.missedTackles / (stats.tackles + stats.missedTackles)) * 100) : 0;

  // Special teams metrics
  const returnAvg = stats && stats.returns > 0
    ? (stats.returnYards / stats.returns) : 0;
  const fgPct = stats && stats.fieldGoalAttempts > 0
    ? ((stats.fieldGoalsMade / stats.fieldGoalAttempts) * 100) : 0;

  return (
    <div>
      {/* Player Overview */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Player Overview</span>
          {expandedSections.overview ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
        </button>

        {expandedSections.overview && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="h-20 w-20 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                <span className="text-3xl font-bold">{player.jersey_number || '?'}</span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {player.first_name} {player.last_name}
                </h3>
                <p className="text-lg text-gray-600">{player.primary_position}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Jersey Number</p>
                <p className="text-lg font-semibold text-gray-900">{player.jersey_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-gray-900">{player.primary_position || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position Group</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">{player.position_group || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phases Played</p>
                <p className="text-lg font-semibold text-gray-900">
                  {[
                    hasOffensiveStats && 'Offense',
                    hasDefensiveStats && 'Defense',
                    hasSpecialTeamsStats && 'Special Teams'
                  ].filter(Boolean).join(', ') || 'None'}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ====================================================================== */}
      {/* OFFENSE SECTION */}
      {/* ====================================================================== */}
      {hasOffensiveStats && stats && (
        <section className="mb-12">
          <button
            onClick={() => toggleSection('offense')}
            className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
          >
            <span>Offensive Stats</span>
            {expandedSections.offense ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </button>

          {expandedSections.offense && (
            <div className="space-y-6">
              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Snaps"
                  value={stats.totalPlays.toString()}
                  subtitle="Offensive plays"
                  tooltip={PLAYER_METRICS.totalSnaps}
                />
                <StatCard
                  label="Success Rate"
                  value={`${stats.successRate.toFixed(1)}%`}
                  subtitle="Successful plays"
                  color={stats.successRate >= 50 ? 'green' : 'default'}
                  tooltip={PLAYER_METRICS.successRate}
                />
              </div>

              {/* QB Passing Stats */}
              {stats.passingAttempts > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Passing</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Comp/Att"
                      value={`${stats.completions}/${stats.passingAttempts}`}
                      subtitle={`${stats.completionPct.toFixed(1)}% completion`}
                      color={stats.completionPct >= 60 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.compAtt}
                    />
                    <StatCard
                      label="Yards"
                      value={stats.passingYards.toString()}
                      subtitle="Passing yards"
                      tooltip={PLAYER_METRICS.passingYards}
                    />
                    <StatCard
                      label="YPA"
                      value={yardsPerAttempt.toFixed(1)}
                      subtitle="Yards per attempt"
                      color={yardsPerAttempt >= 7 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.ypa}
                    />
                    <StatCard
                      label="TD:INT"
                      value={tdIntRatio.toString()}
                      subtitle="Touchdown to INT ratio"
                      color={stats.passingTouchdowns > stats.interceptions ? 'green' : stats.interceptions > stats.passingTouchdowns ? 'red' : 'default'}
                      tooltip={PLAYER_METRICS.tdIntRatio}
                    />
                    <StatCard
                      label="Pass TDs"
                      value={stats.passingTouchdowns.toString()}
                      subtitle="Touchdowns"
                      color={stats.passingTouchdowns > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.passingTouchdowns}
                    />
                    <StatCard
                      label="INTs"
                      value={stats.interceptions.toString()}
                      subtitle="Interceptions"
                      color={stats.interceptions > 0 ? 'red' : 'green'}
                      tooltip={PLAYER_METRICS.interceptions}
                    />
                  </div>
                </div>
              )}

              {/* Rushing Stats */}
              {stats.rushingAttempts > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Rushing</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <StatCard
                      label="Carries"
                      value={stats.rushingAttempts.toString()}
                      subtitle="Rush attempts"
                      tooltip={PLAYER_METRICS.carries}
                    />
                    <StatCard
                      label="Yards"
                      value={stats.rushingYards.toString()}
                      subtitle="Rushing yards"
                      tooltip={PLAYER_METRICS.rushingYards}
                    />
                    <StatCard
                      label="YPC"
                      value={stats.rushingAvg.toFixed(1)}
                      subtitle="Yards per carry"
                      color={stats.rushingAvg >= 4 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.ypc}
                    />
                    <StatCard
                      label="Rush TDs"
                      value={stats.rushingTouchdowns.toString()}
                      subtitle="Touchdowns"
                      color={stats.rushingTouchdowns > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.rushingTouchdowns}
                    />
                    <StatCard
                      label="Fumbles"
                      value={stats.rushingFumbles.toString()}
                      subtitle="Lost"
                      color={stats.rushingFumbles > 0 ? 'red' : 'green'}
                      tooltip={PLAYER_METRICS.fumbles}
                    />
                  </div>
                </div>
              )}

              {/* Receiving Stats */}
              {stats.targets > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Receiving</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Rec/Targets"
                      value={`${stats.receptions}/${stats.targets}`}
                      subtitle={`${catchRate.toFixed(1)}% catch rate`}
                      color={catchRate >= 65 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.recTargets}
                    />
                    <StatCard
                      label="Yards"
                      value={stats.receivingYards.toString()}
                      subtitle="Receiving yards"
                      tooltip={PLAYER_METRICS.receivingYards}
                    />
                    <StatCard
                      label="YPR"
                      value={stats.receivingAvg.toFixed(1)}
                      subtitle="Yards per reception"
                      tooltip={PLAYER_METRICS.ypr}
                    />
                    <StatCard
                      label="YPT"
                      value={yardsPerTarget.toFixed(1)}
                      subtitle="Yards per target"
                      color={yardsPerTarget >= 8 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.ypt}
                    />
                    <StatCard
                      label="Rec TDs"
                      value={stats.receivingTouchdowns.toString()}
                      subtitle="Touchdowns"
                      color={stats.receivingTouchdowns > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.receivingTouchdowns}
                    />
                    <StatCard
                      label="Drops"
                      value={stats.drops.toString()}
                      subtitle="Dropped passes"
                      color={stats.drops > 0 ? 'red' : 'green'}
                      tooltip={PLAYER_METRICS.drops}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ====================================================================== */}
      {/* DEFENSE SECTION */}
      {/* ====================================================================== */}
      {hasDefensiveStats && stats && (
        <section className="mb-12">
          <button
            onClick={() => toggleSection('defense')}
            className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
          >
            <span>Defensive Stats</span>
            {expandedSections.defense ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </button>

          {expandedSections.defense && (
            <div className="space-y-6">
              {/* Summary row with key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Defensive Snaps"
                  value={stats.defensiveSnaps.toString()}
                  subtitle="Total plays"
                  tooltip={PLAYER_METRICS.defensiveSnaps}
                />
                <StatCard
                  label="Tackle Rate"
                  value={`${tackleRate.toFixed(1)}%`}
                  subtitle="Tackles per snap"
                  color={tackleRate >= 10 ? 'green' : 'default'}
                  tooltip={PLAYER_METRICS.tackleRate}
                />
                {stats.missedTackles > 0 && (
                  <StatCard
                    label="Missed Tackle %"
                    value={`${missedTackleRate.toFixed(1)}%`}
                    subtitle="Of tackle attempts"
                    color={missedTackleRate <= 10 ? 'green' : 'red'}
                    tooltip={PLAYER_METRICS.missedTackleRate}
                  />
                )}
              </div>

              {/* Tackling Stats */}
              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-3">Tackling</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Tackles"
                    value={stats.tackles.toString()}
                    subtitle="Combined tackles"
                    color={stats.tackles > 0 ? 'green' : 'default'}
                    tooltip={PLAYER_METRICS.totalTackles}
                  />
                  <StatCard
                    label="Missed Tackles"
                    value={stats.missedTackles.toString()}
                    subtitle="Missed"
                    color={stats.missedTackles === 0 ? 'green' : 'red'}
                    tooltip={PLAYER_METRICS.missedTackles}
                  />
                </div>
              </div>

              {/* Pass Rush Stats - show for DL/LB or anyone with pressures */}
              {(stats.pressures > 0 || stats.sacks > 0) && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Pass Rush</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Sacks"
                      value={stats.sacks.toString()}
                      subtitle={`${sackRate.toFixed(1)}% sack rate`}
                      color={stats.sacks > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.sacks}
                    />
                    <StatCard
                      label="Pressures"
                      value={stats.pressures.toString()}
                      subtitle={`${pressureRate.toFixed(1)}% pressure rate`}
                      color={stats.pressures > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.pressures}
                    />
                  </div>
                </div>
              )}

              {/* Coverage Stats - show for anyone with interceptions */}
              {stats.defensiveInterceptions > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Coverage</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Interceptions"
                      value={stats.defensiveInterceptions.toString()}
                      subtitle="Picks"
                      color={stats.defensiveInterceptions > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.defensiveInterceptions}
                    />
                  </div>
                </div>
              )}

              {/* Turnovers Created */}
              {(stats.forcedFumbles > 0 || stats.defensiveInterceptions > 0) && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Turnovers Created</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.forcedFumbles > 0 && (
                      <StatCard
                        label="Forced Fumbles"
                        value={stats.forcedFumbles.toString()}
                        subtitle="FF"
                        color="green"
                        tooltip={PLAYER_METRICS.forcedFumbles}
                      />
                    )}
                    {stats.defensiveInterceptions > 0 && (
                      <StatCard
                        label="Interceptions"
                        value={stats.defensiveInterceptions.toString()}
                        subtitle="INTs"
                        color="green"
                        tooltip={PLAYER_METRICS.defensiveInterceptions}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ====================================================================== */}
      {/* SPECIAL TEAMS SECTION */}
      {/* ====================================================================== */}
      {hasSpecialTeamsStats && stats && (
        <section className="mb-12">
          <button
            onClick={() => toggleSection('specialTeams')}
            className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
          >
            <span>Special Teams Stats</span>
            {expandedSections.specialTeams ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
          </button>

          {expandedSections.specialTeams && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="ST Snaps"
                  value={stats.specialTeamsSnaps.toString()}
                  subtitle="Special teams plays"
                  tooltip={PLAYER_METRICS.stSnaps}
                />
              </div>

              {/* Kicking Stats */}
              {(stats.fieldGoalAttempts > 0 || stats.patAttempts > 0) && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Kicking</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.fieldGoalAttempts > 0 && (
                      <StatCard
                        label="Field Goals"
                        value={`${stats.fieldGoalsMade}/${stats.fieldGoalAttempts}`}
                        subtitle={`${fgPct.toFixed(1)}% FG`}
                        color={fgPct >= 75 ? 'green' : 'default'}
                        tooltip={PLAYER_METRICS.fieldGoals}
                      />
                    )}
                    {stats.patAttempts > 0 && (
                      <StatCard
                        label="PATs"
                        value={`${stats.patMade}/${stats.patAttempts}`}
                        subtitle="Extra points"
                        color={stats.patMade === stats.patAttempts ? 'green' : 'default'}
                        tooltip={PLAYER_METRICS.pats}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Punting Stats */}
              {stats.punts > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Punting</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Punts"
                      value={stats.punts.toString()}
                      subtitle="Total punts"
                      tooltip={PLAYER_METRICS.punts}
                    />
                    <StatCard
                      label="Punt Avg"
                      value={stats.puntAvg.toFixed(1)}
                      subtitle="Yards per punt"
                      color={stats.puntAvg >= 40 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.puntAvg}
                    />
                  </div>
                </div>
              )}

              {/* Return Stats */}
              {stats.returns > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Returns</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <StatCard
                      label="Returns"
                      value={stats.returns.toString()}
                      subtitle="Total returns"
                      tooltip={PLAYER_METRICS.returns}
                    />
                    <StatCard
                      label="Return Yards"
                      value={stats.returnYards.toString()}
                      subtitle="Total yards"
                      tooltip={PLAYER_METRICS.returnYards}
                    />
                    <StatCard
                      label="Return Avg"
                      value={returnAvg.toFixed(1)}
                      subtitle="Yards per return"
                      color={returnAvg >= 20 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.returnAvg}
                    />
                    <StatCard
                      label="Return TDs"
                      value={stats.returnTouchdowns.toString()}
                      subtitle="Touchdowns"
                      color={stats.returnTouchdowns > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.returnTouchdowns}
                    />
                  </div>
                </div>
              )}

              {/* Coverage Stats */}
              {stats.coverageTackles > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-3">Coverage</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Coverage Tackles"
                      value={stats.coverageTackles.toString()}
                      subtitle="ST tackles"
                      color={stats.coverageTackles > 0 ? 'green' : 'default'}
                      tooltip={PLAYER_METRICS.coverageTackles}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* No stats available */}
      {!hasAnyStats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Stats Available
            </h3>
            <p className="text-gray-600">
              This player doesn&apos;t have any recorded stats yet. Stats will appear once plays
              are tagged with this player in the Film Room.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
