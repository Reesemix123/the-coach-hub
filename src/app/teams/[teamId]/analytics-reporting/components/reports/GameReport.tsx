/**
 * Game Report
 *
 * Comprehensive single-game analysis including:
 * - Game summary and final stats
 * - Offensive metrics
 * - Defensive metrics
 * - Special teams metrics
 * - Key plays and turning points
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { type ComprehensiveTeamMetrics } from '@/lib/services/team-metrics.types';
import StatCard from '@/components/analytics/StatCard';
import { ReportProps } from '@/types/reports';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { QuarterScoreDisplay } from '@/components/film/QuarterScoreDisplay';
import type { GameScoreBreakdown } from '@/types/football';

// Calculate special teams metrics from plays
function calculateSpecialTeamsMetrics(plays: any[]) {
  // Our offensive plays (for FG/XP attempts we make)
  const ourPlays = plays.filter(p => !p.is_opponent_play);

  // Field Goals
  const fgAttempts = ourPlays.filter(p => p.is_field_goal_attempt);
  const fgMade = fgAttempts.filter(p => p.is_field_goal_made).length;
  const fgPct = fgAttempts.length > 0 ? (fgMade / fgAttempts.length) * 100 : 0;

  // Extra Points
  const xpAttempts = ourPlays.filter(p => p.is_extra_point_attempt);
  const xpMade = xpAttempts.filter(p => p.is_extra_point_made).length;
  const xpPct = xpAttempts.length > 0 ? (xpMade / xpAttempts.length) * 100 : 0;

  // Kickoffs (our team kicking off)
  const kickoffs = ourPlays.filter(p => p.is_kickoff && p.kick_distance != null);
  const avgKickoffDistance = kickoffs.length > 0
    ? kickoffs.reduce((sum, p) => sum + (p.kick_distance || 0), 0) / kickoffs.length
    : 0;

  // Punts (our team punting)
  const punts = ourPlays.filter(p => p.is_punt && p.kick_distance != null);
  const avgPuntDistance = punts.length > 0
    ? punts.reduce((sum, p) => sum + (p.kick_distance || 0), 0) / punts.length
    : 0;

  // Kickoff returns (our team returning kicks)
  const kickoffReturns = plays.filter(p => p.is_kickoff_return && p.return_yards != null);
  const avgKickReturnYards = kickoffReturns.length > 0
    ? kickoffReturns.reduce((sum, p) => sum + (p.return_yards || 0), 0) / kickoffReturns.length
    : 0;

  // Punt returns (our team returning punts)
  const puntReturns = plays.filter(p => p.is_punt_return && p.return_yards != null);
  const avgPuntReturnYards = puntReturns.length > 0
    ? puntReturns.reduce((sum, p) => sum + (p.return_yards || 0), 0) / puntReturns.length
    : 0;

  // Average starting field position after kickoff returns
  const avgStartingFieldPosition = kickoffReturns.length > 0
    ? Math.min(50, 5 + avgKickReturnYards)
    : 25;

  return {
    kicking: {
      fgMade,
      fgAttempts: fgAttempts.length,
      fgPct,
      xpMade,
      xpAttempts: xpAttempts.length,
      xpPct,
    },
    kickoff: {
      kickoffs: kickoffs.length,
      avgKickoffDistance,
      kickReturns: kickoffReturns.length,
      avgKickReturnYards,
      avgStartingFieldPosition,
    },
    punting: {
      punts: punts.length,
      avgPuntDistance,
      puntReturns: puntReturns.length,
      avgPuntReturnYards,
    },
  };
}

export default function GameReport({ teamId, gameId, filters }: ReportProps) {
  const supabase = createClient();
  // Using 'any' type since we build custom metrics object with additional scoring/penalties properties
  const [metrics, setMetrics] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible sections state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    offensive: true,
    defensive: true,
    specialTeams: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const selectedGameId = filters.gameId || gameId || null;

      if (!selectedGameId) {
        setLoading(false);
        return;
      }

      // Fetch game details
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', selectedGameId)
        .single();

      if (gameError) {
        console.error('Error loading game:', gameError);
        setLoading(false);
        return;
      }

      setGame(gameData);

      // Fetch play instances for this game to calculate simple metrics
      // First get videos for this game, then get plays for those videos
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id')
        .eq('game_id', selectedGameId);

      if (videosError || !videos || videos.length === 0) {
        console.error('Error loading videos:', videosError);
        // No videos for this game yet - show empty metrics
        setMetrics({
          offense: {
            volume: { totalYards: 0, rushingYards: 0, passingYards: 0, touchdowns: 0 },
            efficiency: { yardsPerPlay: 0, thirdDownConversions: 0, thirdDownAttempts: 0, thirdDownConversionRate: 0 },
            ballSecurity: { turnovers: 0 },
          },
          defense: {
            volume: { totalYardsAllowed: 0, rushingYardsAllowed: 0, passingYardsAllowed: 0, pointsAllowed: gameData?.opponent_score || 0 },
            disruptive: { turnoversForced: 0, sacks: 0, tacklesForLoss: 0, havocRate: 0 },
          },
          specialTeams: {
            kicking: { fgMade: 0, fgAttempts: 0, fgPct: 0, xpMade: 0, xpAttempts: 0, xpPct: 0 },
            kickoff: { kickoffs: 0, avgKickoffDistance: 0, kickReturns: 0, avgKickReturnYards: 0, avgStartingFieldPosition: 25 },
            punting: { punts: 0, avgPuntDistance: 0, puntReturns: 0, avgPuntReturnYards: 0 },
          },
        } as any);
        setLoading(false);
        return;
      }

      const videoIds = videos.map(v => v.id);

      const { data: plays, error: playsError } = await supabase
        .from('play_instances')
        .select('*')
        .in('video_id', videoIds);

      if (playsError) {
        console.error('Error loading plays:', playsError);
        setLoading(false);
        return;
      }

      // Calculate simple game metrics from plays
      const offensivePlays = (plays || []).filter(p => !p.is_opponent_play);
      const defensivePlays = (plays || []).filter(p => p.is_opponent_play);

      // Offensive stats
      const totalYards = offensivePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const rushingPlays = offensivePlays.filter(p => p.play_type === 'run');
      const passingPlays = offensivePlays.filter(p => p.play_type === 'pass');
      const rushingYards = rushingPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const passingYards = passingPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      // Scoring breakdown using new scoring_type field with fallback to legacy fields
      const touchdowns = offensivePlays.filter(p =>
        p.scoring_type === 'touchdown' || p.is_touchdown || p.result === 'touchdown'
      ).length;
      const fieldGoals = offensivePlays.filter(p => p.scoring_type === 'field_goal').length;
      const extraPoints = offensivePlays.filter(p => p.scoring_type === 'extra_point').length;
      const twoPointConversions = offensivePlays.filter(p => p.scoring_type === 'two_point_conversion').length;
      const safeties = offensivePlays.filter(p => p.scoring_type === 'safety').length;
      const totalPoints = offensivePlays.reduce((sum, p) => sum + (p.scoring_points || 0), 0);

      // Penalty stats
      const penaltiesOnUs = offensivePlays.filter(p => p.penalty_on_play && p.penalty_on_us === true).length;
      const penaltiesOnOpponent = offensivePlays.filter(p => p.penalty_on_play && p.penalty_on_us === false).length;
      const penaltyYardsOnUs = offensivePlays
        .filter(p => p.penalty_on_play && p.penalty_on_us === true)
        .reduce((sum, p) => sum + (p.penalty_yards || 0), 0);
      const penaltyYardsOnOpponent = offensivePlays
        .filter(p => p.penalty_on_play && p.penalty_on_us === false)
        .reduce((sum, p) => sum + (p.penalty_yards || 0), 0);

      const turnovers = offensivePlays.filter(p => p.is_turnover).length;
      const thirdDowns = offensivePlays.filter(p => p.down === 3);
      const thirdDownConversions = thirdDowns.filter(p => p.resulted_in_first_down).length;

      // Defensive stats
      const yardsAllowed = defensivePlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const rushingYardsAllowed = defensivePlays.filter(p => p.play_type === 'run').reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const passingYardsAllowed = defensivePlays.filter(p => p.play_type === 'pass').reduce((sum, p) => sum + (p.yards_gained || 0), 0);
      const turnoversForced = defensivePlays.filter(p => p.is_turnover).length;
      const sacks = defensivePlays.filter(p => p.result === 'sack').length;
      const tacklesForLoss = defensivePlays.filter(p => p.yards_gained && p.yards_gained < 0).length;

      // Create simplified metrics object
      const gameMetrics = {
        offense: {
          volume: {
            totalYards,
            rushingYards,
            passingYards,
            touchdowns,
          },
          scoring: {
            touchdowns,
            fieldGoals,
            extraPoints,
            twoPointConversions,
            safeties,
            totalPoints,
          },
          penalties: {
            penaltiesOnUs,
            penaltiesOnOpponent,
            penaltyYardsOnUs,
            penaltyYardsOnOpponent,
          },
          efficiency: {
            yardsPerPlay: offensivePlays.length > 0 ? totalYards / offensivePlays.length : 0,
            thirdDownConversions,
            thirdDownAttempts: thirdDowns.length,
            thirdDownConversionRate: thirdDowns.length > 0 ? (thirdDownConversions / thirdDowns.length) * 100 : 0,
          },
          ballSecurity: {
            turnovers,
          },
        },
        defense: {
          volume: {
            totalYardsAllowed: yardsAllowed,
            rushingYardsAllowed,
            passingYardsAllowed,
            pointsAllowed: gameData?.opponent_score || 0,
          },
          disruptive: {
            turnoversForced,
            sacks,
            tacklesForLoss,
            havocRate: defensivePlays.length > 0 ? ((sacks + turnoversForced + tacklesForLoss) / defensivePlays.length) * 100 : 0,
          },
        },
        specialTeams: calculateSpecialTeamsMetrics(plays || []),
      };

      setMetrics(gameMetrics as any);
      setLoading(false);
    }

    loadData();
  }, [teamId, gameId, filters]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading game report...</div>
      </div>
    );
  }

  if (!filters.gameId && !gameId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <p className="text-yellow-800 text-lg mb-2">No game selected</p>
        <p className="text-yellow-700 text-sm">
          Please select a game from the filter above to view the game report.
        </p>
      </div>
    );
  }

  if (!metrics || !game) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Unable to load game data</p>
      </div>
    );
  }

  const finalScore = `${game.team_score || 0} - ${game.opponent_score || 0}`;
  const result = game.game_result || 'unknown';
  const resultColor = result === 'win' ? 'text-green-600' : result === 'loss' ? 'text-red-600' : 'text-gray-600';

  return (
    <div>
      {/* Game Summary */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('summary')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Game Summary</span>
          {expandedSections.summary ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.summary && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{game.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(game.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Final Score</p>
                <p className={`text-lg font-semibold ${resultColor}`}>
                  {finalScore}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Result</p>
                <p className={`text-lg font-semibold uppercase ${resultColor}`}>
                  {result}
                </p>
              </div>
            </div>

            {/* Quarter-by-Quarter Score Breakdown */}
            <QuarterScoreDisplay
              gameId={game.id}
              teamName="Our Team"
              opponentName={game.opponent || 'Opponent'}
              quarterScores={game.quarter_scores as GameScoreBreakdown | null}
            />
          </div>
        )}
      </section>

      {/* Offensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('offensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Offensive Performance</span>
          {expandedSections.offensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.offensive && (
          <div className="space-y-8">
            {/* Volume */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Yards"
                  value={metrics.offense.volume.totalYards.toString()}
                  subtitle="Total offense"
                  hint="Combined rushing + passing yards"
                />
                <StatCard
                  label="Rushing Yards"
                  value={metrics.offense.volume.rushingYards.toString()}
                  subtitle="Yards on the ground"
                  hint="Shows run game effectiveness"
                />
                <StatCard
                  label="Passing Yards"
                  value={metrics.offense.volume.passingYards.toString()}
                  subtitle="Yards through the air"
                  hint="Shows passing attack production"
                />
                <StatCard
                  label="Touchdowns"
                  value={metrics.offense.volume.touchdowns.toString()}
                  subtitle="Offensive TDs"
                  color="green"
                  hint="Ability to finish drives"
                />
              </div>
            </div>

            {/* Penalties */}
            {metrics.offense.penalties && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Penalties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Penalties (Us)"
                    value={metrics.offense.penalties.penaltiesOnUs.toString()}
                    subtitle={`${metrics.offense.penalties.penaltyYardsOnUs} yards`}
                    color={metrics.offense.penalties.penaltiesOnUs > 5 ? 'red' : 'default'}
                    hint="Discipline issues hurt drives"
                  />
                  <StatCard
                    label="Penalties (Opp)"
                    value={metrics.offense.penalties.penaltiesOnOpponent.toString()}
                    subtitle={`${metrics.offense.penalties.penaltyYardsOnOpponent} yards`}
                    color={metrics.offense.penalties.penaltiesOnOpponent > 0 ? 'green' : 'default'}
                    hint="Free yards from opponent mistakes"
                  />
                  <StatCard
                    label="Penalty Yards (Us)"
                    value={metrics.offense.penalties.penaltyYardsOnUs.toString()}
                    subtitle="Yards assessed"
                    color={metrics.offense.penalties.penaltyYardsOnUs > 50 ? 'red' : 'default'}
                    hint="Total yardage lost to flags"
                  />
                  <StatCard
                    label="Penalty Diff"
                    value={(metrics.offense.penalties.penaltiesOnOpponent - metrics.offense.penalties.penaltiesOnUs).toString()}
                    subtitle="+ favors us"
                    color={(metrics.offense.penalties.penaltiesOnOpponent - metrics.offense.penalties.penaltiesOnUs) > 0 ? 'green' : (metrics.offense.penalties.penaltiesOnOpponent - metrics.offense.penalties.penaltiesOnUs) < 0 ? 'red' : 'default'}
                    hint="Net penalty advantage"
                  />
                </div>
              </div>
            )}

            {/* Efficiency */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Yards Per Play"
                  value={metrics.offense.efficiency.yardsPerPlay?.toFixed(1) || '0.0'}
                  subtitle="Overall efficiency"
                  color={(metrics.offense.efficiency.yardsPerPlay || 0) >= 5.5 ? 'green' : 'default'}
                  hint="5+ is good, 6+ is excellent"
                />
                <StatCard
                  label="3rd Down Conv"
                  value={`${metrics.offense.efficiency.thirdDownConversions}/${metrics.offense.efficiency.thirdDownAttempts}`}
                  subtitle={`${(metrics.offense.efficiency.thirdDownConversionRate || 0).toFixed(0)}%`}
                  color={(metrics.offense.efficiency.thirdDownConversionRate || 0) >= 40 ? 'green' : 'default'}
                  hint="Key to sustaining drives"
                />
                <StatCard
                  label="Turnovers"
                  value={metrics.offense.ballSecurity.turnovers.toString()}
                  subtitle="Giveaways"
                  color={metrics.offense.ballSecurity.turnovers > 0 ? 'red' : 'green'}
                  hint="Turnovers often decide games"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Defensive Metrics */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('defensive')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Defensive Performance</span>
          {expandedSections.defensive ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.defensive && (
          <div className="space-y-8">
            {/* Volume */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Yards Allowed"
                  value={metrics.defense.volume.totalYardsAllowed.toString()}
                  subtitle="Total yards given up"
                  color={(metrics.defense.volume.totalYardsAllowed || 999) <= 300 ? 'green' : 'default'}
                  hint="Lower is better"
                />
                <StatCard
                  label="Rush Yards Allowed"
                  value={metrics.defense.volume.rushingYardsAllowed.toString()}
                  subtitle="Yards on ground"
                  hint="Run defense effectiveness"
                />
                <StatCard
                  label="Pass Yards Allowed"
                  value={metrics.defense.volume.passingYardsAllowed.toString()}
                  subtitle="Yards through air"
                  hint="Coverage and pass rush"
                />
                <StatCard
                  label="Points Allowed"
                  value={metrics.defense.volume.pointsAllowed.toString()}
                  subtitle="Points given up"
                  color={(metrics.defense.volume.pointsAllowed || 999) <= 20 ? 'green' : 'default'}
                  hint="Ultimate defensive measure"
                />
              </div>
            </div>

            {/* Disruptive Plays */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Disruptive Plays</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Turnovers Forced"
                  value={metrics.defense.disruptive.turnoversForced.toString()}
                  subtitle="Takeaways"
                  color={metrics.defense.disruptive.turnoversForced > 0 ? 'green' : 'default'}
                  hint="Extra possessions for offense"
                />
                <StatCard
                  label="Sacks"
                  value={metrics.defense.disruptive.sacks.toString()}
                  subtitle="QB takedowns"
                  color={metrics.defense.disruptive.sacks > 0 ? 'green' : 'default'}
                  hint="Disrupts passing game"
                />
                <StatCard
                  label="Tackles For Loss"
                  value={metrics.defense.disruptive.tacklesForLoss.toString()}
                  subtitle="TFLs"
                  color={metrics.defense.disruptive.tacklesForLoss > 0 ? 'green' : 'default'}
                  hint="Puts offense behind schedule"
                />
                <StatCard
                  label="Havoc Rate"
                  value={`${(metrics.defense.disruptive.havocRate || 0).toFixed(1)}%`}
                  subtitle="Disruptive plays"
                  color={(metrics.defense.disruptive.havocRate || 0) >= 10 ? 'green' : 'default'}
                  hint="% of plays with TFL, sack, or TO"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Special Teams */}
      <section className="mb-12">
        <button
          onClick={() => toggleSection('specialTeams')}
          className="w-full flex items-center justify-between text-2xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200 hover:text-gray-700 transition-colors"
        >
          <span>Special Teams</span>
          {expandedSections.specialTeams ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>

        {expandedSections.specialTeams && (
          <div className="space-y-6">
            {/* Kicking (FG/XP) */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kicking</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Field Goals"
                  value={`${metrics.specialTeams.kicking.fgMade}/${metrics.specialTeams.kicking.fgAttempts}`}
                  subtitle="Made / Attempted"
                  color={metrics.specialTeams.kicking.fgPct >= 75 ? 'green' : 'default'}
                  hint="Points when TDs aren't possible"
                />
                <StatCard
                  label="Extra Points"
                  value={`${metrics.specialTeams.kicking.xpMade}/${metrics.specialTeams.kicking.xpAttempts}`}
                  subtitle="Made / Attempted"
                  color={metrics.specialTeams.kicking.xpPct >= 90 ? 'green' : 'default'}
                  hint="Should be automatic"
                />
                <StatCard
                  label="Kickoff Avg"
                  value={`${(metrics.specialTeams.kickoff.avgKickoffDistance || 0).toFixed(0)}`}
                  subtitle="Yards per kickoff"
                  color={(metrics.specialTeams.kickoff.avgKickoffDistance || 0) >= 55 ? 'green' : 'default'}
                  hint="Deeper = worse field position for opponent"
                />
                <StatCard
                  label="Punt Avg"
                  value={`${(metrics.specialTeams.punting.avgPuntDistance || 0).toFixed(0)}`}
                  subtitle="Yards per punt"
                  color={(metrics.specialTeams.punting.avgPuntDistance || 0) >= 35 ? 'green' : 'default'}
                  hint="Flips field position"
                />
              </div>
            </div>

            {/* Returns */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Returns</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Kick Return Avg"
                  value={`${(metrics.specialTeams.kickoff.avgKickReturnYards || 0).toFixed(1)}`}
                  subtitle="Yards per return"
                  color={(metrics.specialTeams.kickoff.avgKickReturnYards || 0) >= 22 ? 'green' : 'default'}
                  hint="Hidden yardage for offense"
                />
                <StatCard
                  label="Punt Return Avg"
                  value={`${(metrics.specialTeams.punting.avgPuntReturnYards || 0).toFixed(1)}`}
                  subtitle="Yards per return"
                  color={(metrics.specialTeams.punting.avgPuntReturnYards || 0) >= 10 ? 'green' : 'default'}
                  hint="Negates opponent's punt"
                />
                <StatCard
                  label="Starting Field Position"
                  value={`Own ${(metrics.specialTeams.kickoff.avgStartingFieldPosition || 25).toFixed(0)}`}
                  subtitle="After receiving kickoffs"
                  color={(metrics.specialTeams.kickoff.avgStartingFieldPosition || 0) >= 30 ? 'green' : 'default'}
                  hint="Shorter field = easier to score"
                />
                <StatCard
                  label="Total Returns"
                  value={`${(metrics.specialTeams.kickoff.kickReturns || 0) + (metrics.specialTeams.punting.puntReturns || 0)}`}
                  subtitle="Kick + punt returns"
                  hint="Return opportunities taken"
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
