// src/lib/services/analytics.service.ts
import { createClient } from '@/utils/supabase/client';

export interface TeamAnalytics {
  // Overall metrics
  totalPlays: number;
  totalYards: number;
  avgYardsPerPlay: number;
  successRate: number;
  firstDowns: number;
  turnovers: number;

  // By down
  firstDownStats: { plays: number; success: number; successRate: number };
  secondDownStats: { plays: number; success: number; successRate: number };
  thirdDownStats: { plays: number; success: number; successRate: number; conversions: number };
  fourthDownStats: { plays: number; success: number; successRate: number };

  // Situational
  redZoneAttempts: number;
  redZoneTouchdowns: number;
  redZoneSuccessRate: number;

  // Top/Bottom plays
  topPlays: Array<{
    play_code: string;
    play_name: string;
    attempts: number;
    successRate: number;
    avgYards: number;
  }>;
  bottomPlays: Array<{
    play_code: string;
    play_name: string;
    attempts: number;
    successRate: number;
    avgYards: number;
  }>;
}

export interface PlayerStats {
  player: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: string;
    position: string;
  };
  
  totalPlays: number;
  successRate: number;
  
  rushingAttempts: number;
  rushingYards: number;
  rushingAvg: number;
  rushingTouchdowns: number;
  rushingFumbles: number;
  
  passingAttempts: number;
  completions: number;
  completionPct: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  passingFumbles: number;
  
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingAvg: number;
  receivingTouchdowns: number;
  drops: number;
  receivingFumbles: number;
  
  // Yards per down breakdown
  yardsByDown: {
    firstDown: { attempts: number; totalYards: number; avgYards: number };
    secondDown: { attempts: number; totalYards: number; avgYards: number };
    thirdDown: { attempts: number; totalYards: number; avgYards: number };
    fourthDown: { attempts: number; totalYards: number; avgYards: number };
  };
  
  topPlays: Array<{
    play_code: string;
    play_name: string;
    attempts: number;
    successRate: number;
    avgYards: number;
  }>;

  // Defensive stats
  defensiveSnaps: number;
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  pressures: number;
  passBreakups: number;
  defensiveInterceptions: number;
  forcedFumbles: number;
  missedTackles: number;

  // Special Teams stats
  specialTeamsSnaps: number;
  kickoffs: number;
  kickoffYards: number;
  kickoffAvg: number;
  kickoffTouchbacks: number;
  punts: number;
  puntYards: number;
  puntAvg: number;
  fieldGoalAttempts: number;
  fieldGoalsMade: number;
  fieldGoalPct: number;
  patAttempts: number;
  patMade: number;
  returns: number;
  returnYards: number;
  returnAvg: number;
  returnTouchdowns: number;
  coverageTackles: number;
}

export class AnalyticsService {
  private supabase = createClient();

  /**
   * Get video IDs from games that have completed film tagging
   * Used to filter analytics to only include completed games
   */
  private async getCompletedGameVideoIds(teamId: string): Promise<string[]> {
    // First get all games for this team that are marked as complete
    const { data: completedGames } = await this.supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .eq('film_analysis_status', 'complete');

    if (!completedGames || completedGames.length === 0) {
      return [];
    }

    const gameIds = completedGames.map(g => g.id);

    // Then get all video IDs for those games
    const { data: videos } = await this.supabase
      .from('videos')
      .select('id')
      .in('game_id', gameIds);

    return videos?.map(v => v.id) || [];
  }

  /**
   * Calculate if a play was successful based on down and distance
   */
  private isPlaySuccessful(
    down: number | null,
    distance: number | null,
    yardsGained: number | null,
    resultedInFirstDown: boolean | null
  ): boolean {
    // If explicitly marked as first down, it's successful
    if (resultedInFirstDown) return true;

    // If no down/distance data, can't determine success
    if (!down || !distance || yardsGained === null) return false;

    // Standard success criteria
    // 1st down: gain 40% of yards needed
    // 2nd down: gain 60% of yards needed  
    // 3rd/4th down: gain 100% of yards needed (first down)
    if (down === 1) return yardsGained >= distance * 0.4;
    if (down === 2) return yardsGained >= distance * 0.6;
    if (down === 3 || down === 4) return yardsGained >= distance;

    return false;
  }

  /**
   * Get comprehensive team analytics
   * Only includes plays from games marked as tagging complete
   */
  async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
    // Get video IDs from completed games only
    const completedVideoIds = await this.getCompletedGameVideoIds(teamId);

    // If no completed games, return empty analytics
    if (completedVideoIds.length === 0) {
      return this.getEmptyTeamAnalytics();
    }

    // Fetch play instances only from completed games
    const { data: plays, error } = await this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_opponent_play', false)
      .in('video_id', completedVideoIds);

    if (error || !plays) {
      throw new Error('Failed to fetch play instances');
    }

    // Calculate overall metrics
    const totalPlays = plays.length;
    const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const avgYardsPerPlay = totalPlays > 0 ? totalYards / totalPlays : 0;
    
    const successfulPlays = plays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );
    const successRate = totalPlays > 0 ? (successfulPlays.length / totalPlays) * 100 : 0;

    const firstDowns = plays.filter(p => p.resulted_in_first_down).length;
    const turnovers = plays.filter(p => p.is_turnover).length;

    // By down stats
    const firstDownPlays = plays.filter(p => p.down === 1);
    const firstDownSuccess = firstDownPlays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );

    const secondDownPlays = plays.filter(p => p.down === 2);
    const secondDownSuccess = secondDownPlays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );

    const thirdDownPlays = plays.filter(p => p.down === 3);
    const thirdDownSuccess = thirdDownPlays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );
    const thirdDownConversions = thirdDownPlays.filter(p => p.resulted_in_first_down).length;

    const fourthDownPlays = plays.filter(p => p.down === 4);
    const fourthDownSuccess = fourthDownPlays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );

    // Red zone (inside 20 yard line)
    const redZonePlays = plays.filter(p => p.yard_line && p.yard_line <= 20);
    // Use scoring_type for touchdowns (new field), fall back to is_touchdown or result_type for backward compatibility
    const redZoneTouchdowns = redZonePlays.filter(p =>
      p.scoring_type === 'touchdown' || p.is_touchdown || p.result_type === 'touchdown'
    ).length;

    // Group plays by play_code and calculate stats
    const playStats = new Map<string, {
      play_code: string;
      attempts: number;
      successes: number;
      totalYards: number;
    }>();

    plays.forEach(play => {
      if (!play.play_code) return;

      const existing = playStats.get(play.play_code) || {
        play_code: play.play_code,
        attempts: 0,
        successes: 0,
        totalYards: 0
      };

      existing.attempts++;
      existing.totalYards += play.yards_gained || 0;
      if (this.isPlaySuccessful(play.down, play.distance, play.yards_gained, play.resulted_in_first_down)) {
        existing.successes++;
      }

      playStats.set(play.play_code, existing);
    });

    // Fetch play names from playbook
    const playCodes = Array.from(playStats.keys());
    const { data: playbookPlays } = await this.supabase
      .from('playbook_plays')
      .select('play_code, play_name')
      .in('play_code', playCodes)
      .eq('team_id', teamId);

    const playNameMap = new Map(playbookPlays?.map(p => [p.play_code, p.play_name]) || []);

    // Convert to array with percentages
    const playsWithStats = Array.from(playStats.values())
      .filter(p => p.attempts >= 3) // Only show plays with 3+ attempts
      .map(p => ({
        play_code: p.play_code,
        play_name: playNameMap.get(p.play_code) || p.play_code,
        attempts: p.attempts,
        successRate: (p.successes / p.attempts) * 100,
        avgYards: p.totalYards / p.attempts
      }));

    // Sort and get top 5 and bottom 5
    const sortedPlays = [...playsWithStats].sort((a, b) => b.successRate - a.successRate);
    const topPlays = sortedPlays.slice(0, 5);
    const bottomPlays = sortedPlays.slice(-5).reverse();

    return {
      totalPlays,
      totalYards,
      avgYardsPerPlay,
      successRate,
      firstDowns,
      turnovers,

      firstDownStats: {
        plays: firstDownPlays.length,
        success: firstDownSuccess.length,
        successRate: firstDownPlays.length > 0 ? (firstDownSuccess.length / firstDownPlays.length) * 100 : 0
      },
      secondDownStats: {
        plays: secondDownPlays.length,
        success: secondDownSuccess.length,
        successRate: secondDownPlays.length > 0 ? (secondDownSuccess.length / secondDownPlays.length) * 100 : 0
      },
      thirdDownStats: {
        plays: thirdDownPlays.length,
        success: thirdDownSuccess.length,
        successRate: thirdDownPlays.length > 0 ? (thirdDownSuccess.length / thirdDownPlays.length) * 100 : 0,
        conversions: thirdDownConversions
      },
      fourthDownStats: {
        plays: fourthDownPlays.length,
        success: fourthDownSuccess.length,
        successRate: fourthDownPlays.length > 0 ? (fourthDownSuccess.length / fourthDownPlays.length) * 100 : 0
      },

      redZoneAttempts: redZonePlays.length,
      redZoneTouchdowns,
      redZoneSuccessRate: redZonePlays.length > 0 ? (redZoneTouchdowns / redZonePlays.length) * 100 : 0,

      topPlays,
      bottomPlays
    };
  }

  /**
   * Return empty team analytics for when no completed games exist
   */
  private getEmptyTeamAnalytics(): TeamAnalytics {
    return {
      totalPlays: 0,
      totalYards: 0,
      avgYardsPerPlay: 0,
      successRate: 0,
      firstDowns: 0,
      turnovers: 0,
      firstDownStats: { plays: 0, success: 0, successRate: 0 },
      secondDownStats: { plays: 0, success: 0, successRate: 0 },
      thirdDownStats: { plays: 0, success: 0, successRate: 0, conversions: 0 },
      fourthDownStats: { plays: 0, success: 0, successRate: 0 },
      redZoneAttempts: 0,
      redZoneTouchdowns: 0,
      redZoneSuccessRate: 0,
      topPlays: [],
      bottomPlays: []
    };
  }

  /**
   * Get comprehensive player statistics
   * Only includes plays from games marked as tagging complete
   */
  async getPlayerStats(playerId: string, teamId: string): Promise<PlayerStats> {
    // Fetch player info
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Get video IDs from completed games only
    const completedVideoIds = await this.getCompletedGameVideoIds(teamId);

    // If no completed games, return empty player stats
    if (completedVideoIds.length === 0) {
      return this.getEmptyPlayerStats(player);
    }

    // ======================================================================
    // UNIFIED PLAYER PARTICIPATION MODEL
    // Query player_participation table for ALL player involvement
    // This replaces the deprecated play_instances columns (ball_carrier_id, qb_id, target_id)
    // ======================================================================

    // Query all participation records for this player
    const { data: allParticipation, error: partError } = await this.supabase
      .from('player_participation')
      .select('*, play_instance:play_instances!inner(id, video_id, is_opponent_play, down, distance, yards_gained, resulted_in_first_down, is_turnover, is_touchdown, scoring_type, result, play_code, yard_line)')
      .eq('player_id', playerId)
      .eq('team_id', teamId);

    // Filter to only completed games
    const validParticipation = allParticipation?.filter(p =>
      p.play_instance && completedVideoIds.includes(p.play_instance.video_id)
    ) || [];

    // Separate by phase
    const offensiveParticipation = validParticipation.filter(p =>
      p.phase === 'offense' || ['passer', 'rusher', 'receiver', 'blocker'].includes(p.participation_type)
    );
    const validDefensiveParticipation = validParticipation.filter(p =>
      (p.phase === 'defense' || !['passer', 'rusher', 'receiver', 'blocker', 'returner'].includes(p.participation_type)) &&
      p.play_instance?.is_opponent_play === true
    );
    const specialTeamsParticipation = validParticipation.filter(p =>
      p.phase === 'special_teams' || p.participation_type === 'returner'
    );

    // Build a list of unique play instances with their data for offensive stats
    const offensivePlays = offensiveParticipation
      .filter(p => p.play_instance && !p.play_instance.is_opponent_play)
      .map(p => ({
        ...p.play_instance,
        // Mark which role this player had on this play
        _participation_type: p.participation_type,
        _player_id: playerId
      }));

    // De-duplicate plays (player might have multiple participation types on same play)
    const uniqueOffensivePlays = Array.from(
      new Map(offensivePlays.map(p => [p.id, p])).values()
    );

    // If no offensive plays AND no defensive participation, return empty stats
    if (uniqueOffensivePlays.length === 0 && validDefensiveParticipation.length === 0) {
      return this.getEmptyPlayerStats(player);
    }

    // Calculate overall stats (offensive plays only)
    const totalPlays = uniqueOffensivePlays.length;
    const successfulPlays = uniqueOffensivePlays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );
    const successRate = totalPlays > 0 ? (successfulPlays.length / totalPlays) * 100 : 0;

    // Helper to check if a play is a touchdown (supports new scoring_type, result_type, and legacy fields)
    const isTouchdown = (p: any) =>
      p.scoring_type === 'touchdown' || p.is_touchdown ||
      p.result?.includes('touchdown') || p.result_type?.includes('touchdown');

    // Helper to check if a pass was completed (supports result_type from UI and legacy result field)
    const isComplete = (p: any) =>
      p.result_type === 'pass_complete' ||
      p.result?.includes('complete') ||
      p.is_complete === true;

    // Helper to check if a play was an interception
    const isInt = (p: any) =>
      p.result_type === 'pass_interception' ||
      p.result?.includes('interception') ||
      p.is_interception === true;

    // Helper to check if a pass was incomplete (for drops)
    const isIncomplete = (p: any) =>
      p.result_type === 'pass_incomplete' ||
      p.result?.includes('incomplete');

    // ======================================================================
    // UNIFIED MODEL: Use participation types to identify player roles
    // Instead of checking play_instances columns, we filter by participation_type
    // ======================================================================

    // Rushing stats (participation_type = 'rusher')
    const rushParticipation = offensiveParticipation.filter(p => p.participation_type === 'rusher');
    const rushPlays = rushParticipation.map(p => p.play_instance).filter(Boolean);
    const rushingAttempts = rushPlays.length;
    const rushingYards = rushParticipation.reduce((sum, p) => sum + (p.yards_gained || p.play_instance?.yards_gained || 0), 0);
    const rushingAvg = rushingAttempts > 0 ? rushingYards / rushingAttempts : 0;
    const rushingTouchdowns = rushParticipation.filter(p =>
      p.is_touchdown || isTouchdown(p.play_instance)
    ).length;
    const rushingFumbles = rushParticipation.filter(p =>
      p.is_turnover || p.play_instance?.is_turnover
    ).length;

    // Passing stats (participation_type = 'passer')
    const passParticipation = offensiveParticipation.filter(p => p.participation_type === 'passer');
    const passPlays = passParticipation.map(p => p.play_instance).filter(Boolean);
    const passingAttempts = passPlays.length;
    const completions = passPlays.filter(p =>
      isComplete(p) || isTouchdown(p)
    ).length;
    const completionPct = passingAttempts > 0 ? (completions / passingAttempts) * 100 : 0;
    const passingYards = passParticipation.reduce((sum, p) => sum + (p.yards_gained || p.play_instance?.yards_gained || 0), 0);
    const passingTouchdowns = passParticipation.filter(p =>
      p.is_touchdown || isTouchdown(p.play_instance)
    ).length;
    const interceptions = passPlays.filter(p => isInt(p)).length;
    const passingFumbles = passPlays.filter(p => p.is_turnover && !p.is_interception).length;

    // Receiving stats (participation_type = 'receiver')
    const receiverParticipation = offensiveParticipation.filter(p => p.participation_type === 'receiver');
    const targetPlays = receiverParticipation.map(p => p.play_instance).filter(Boolean);
    const targets = targetPlays.length;
    const receptions = targetPlays.filter(p =>
      isComplete(p) || isTouchdown(p)
    ).length;
    const drops = targetPlays.filter(p =>
      isIncomplete(p) && !p.result?.includes('defended') && !p.result_type?.includes('defended')
    ).length;
    const receivingYards = receiverParticipation
      .filter(p => isComplete(p.play_instance) || isTouchdown(p.play_instance))
      .reduce((sum, p) => sum + (p.yards_gained || p.play_instance?.yards_gained || 0), 0);
    const receivingAvg = receptions > 0 ? receivingYards / receptions : 0;
    const receivingTouchdowns = receiverParticipation.filter(p =>
      p.is_touchdown || isTouchdown(p.play_instance)
    ).length;
    const receivingFumbles = targetPlays.filter(p => p.is_turnover).length;

    // Yards by down (use unique offensive plays)
    const firstDownPlays = uniqueOffensivePlays.filter(p => p.down === 1);
    const secondDownPlays = uniqueOffensivePlays.filter(p => p.down === 2);
    const thirdDownPlays = uniqueOffensivePlays.filter(p => p.down === 3);
    const fourthDownPlays = uniqueOffensivePlays.filter(p => p.down === 4);

    const yardsByDown = {
      firstDown: {
        attempts: firstDownPlays.length,
        totalYards: firstDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
        avgYards: firstDownPlays.length > 0 
          ? firstDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / firstDownPlays.length 
          : 0
      },
      secondDown: {
        attempts: secondDownPlays.length,
        totalYards: secondDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
        avgYards: secondDownPlays.length > 0 
          ? secondDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / secondDownPlays.length 
          : 0
      },
      thirdDown: {
        attempts: thirdDownPlays.length,
        totalYards: thirdDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
        avgYards: thirdDownPlays.length > 0 
          ? thirdDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / thirdDownPlays.length 
          : 0
      },
      fourthDown: {
        attempts: fourthDownPlays.length,
        totalYards: fourthDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0),
        avgYards: fourthDownPlays.length > 0 
          ? fourthDownPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0) / fourthDownPlays.length 
          : 0
      }
    };

    // Group plays by play_code for top plays
    const playStats = new Map<string, {
      play_code: string;
      attempts: number;
      successes: number;
      totalYards: number;
    }>();

    uniqueOffensivePlays.forEach(play => {
      if (!play.play_code) return;

      const existing = playStats.get(play.play_code) || {
        play_code: play.play_code,
        attempts: 0,
        successes: 0,
        totalYards: 0
      };

      existing.attempts++;
      existing.totalYards += play.yards_gained || 0;
      if (this.isPlaySuccessful(play.down, play.distance, play.yards_gained, play.resulted_in_first_down)) {
        existing.successes++;
      }

      playStats.set(play.play_code, existing);
    });

    // Fetch play names from playbook
    const playCodes = Array.from(playStats.keys());
    const { data: playbookPlays } = playCodes.length > 0 ? await this.supabase
      .from('playbook_plays')
      .select('play_code, play_name')
      .in('play_code', playCodes)
      .eq('team_id', teamId) : { data: [] };

    const playNameMap = new Map(playbookPlays?.map(p => [p.play_code, p.play_name]) || []);

    // Get top plays (minimum 2 attempts for individual players)
    const topPlays = Array.from(playStats.values())
      .filter(p => p.attempts >= 2)
      .map(p => ({
        play_code: p.play_code,
        play_name: playNameMap.get(p.play_code) || p.play_code,
        attempts: p.attempts,
        successRate: (p.successes / p.attempts) * 100,
        avgYards: p.totalYards / p.attempts
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Count defensive stats by participation_type
    let tackles = 0;
    let tacklesForLoss = 0;
    let sacks = 0;
    let pressures = 0;
    let passBreakups = 0;
    let defensiveInterceptions = 0;
    let forcedFumbles = 0;
    let missedTackles = 0;

    validDefensiveParticipation.forEach(p => {
      const type = p.participation_type;

      // Tackles
      if (type === 'primary_tackle' || type === 'assist_tackle' || type === 'solo_tackle') {
        tackles++;
      }

      // Tackles for loss
      if (type === 'tackle_for_loss') {
        tacklesForLoss++;
        tackles++; // TFLs also count as tackles
      }

      // Sacks (from pressure type with sack result)
      if (type === 'pressure' && p.result === 'sack') {
        sacks++;
        pressures++; // Sacks also count as pressures
      } else if (type === 'sack') {
        sacks++;
      }

      // Pressures (QB hurries, hits without sack)
      if (type === 'pressure' && p.result !== 'sack') {
        pressures++;
      }

      // Interceptions
      if (type === 'interception') {
        defensiveInterceptions++;
      }

      // Pass breakups / PBUs
      if (type === 'pass_breakup' || type === 'pbu') {
        passBreakups++;
      }

      // Forced fumbles
      if (type === 'forced_fumble' || type === 'fumble_recovery') {
        forcedFumbles++;
      }

      // Missed tackles
      if (type === 'missed_tackle') {
        missedTackles++;
      }
    });

    // Count unique plays where this player had defensive involvement
    const uniqueDefensivePlays = new Set(validDefensiveParticipation.map(p => p.play_instance_id));
    const defensiveSnaps = uniqueDefensivePlays.size;

    // ======================================================================
    // SPECIAL TEAMS STATS
    // Calculate kicking, punting, returning, and coverage stats
    // ======================================================================

    // Count unique special teams plays
    const uniqueSpecialTeamsPlays = new Set(specialTeamsParticipation.map(p => p.play_instance_id));
    const specialTeamsSnaps = uniqueSpecialTeamsPlays.size;

    // Kicking stats (kickoffs)
    const kickerParticipation = specialTeamsParticipation.filter(p =>
      p.participation_type === 'kicker' && p.metadata?.kick_type === 'kickoff'
    );
    const kickoffs = kickerParticipation.length;
    const kickoffYards = kickerParticipation.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const kickoffAvg = kickoffs > 0 ? kickoffYards / kickoffs : 0;
    const kickoffTouchbacks = kickerParticipation.filter(p =>
      p.result === 'touchback' || p.metadata?.is_touchback
    ).length;

    // Punting stats
    const punterParticipation = specialTeamsParticipation.filter(p => p.participation_type === 'punter');
    const punts = punterParticipation.length;
    const puntYards = punterParticipation.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const puntAvg = punts > 0 ? puntYards / punts : 0;

    // Field Goal stats
    const fgKickerParticipation = specialTeamsParticipation.filter(p =>
      p.participation_type === 'kicker' && p.metadata?.kick_type === 'field_goal'
    );
    const fieldGoalAttempts = fgKickerParticipation.length;
    const fieldGoalsMade = fgKickerParticipation.filter(p => p.result === 'made').length;
    const fieldGoalPct = fieldGoalAttempts > 0 ? (fieldGoalsMade / fieldGoalAttempts) * 100 : 0;

    // PAT stats
    const patKickerParticipation = specialTeamsParticipation.filter(p =>
      p.participation_type === 'kicker' && p.metadata?.kick_type === 'pat'
    );
    const patAttempts = patKickerParticipation.length;
    const patMade = patKickerParticipation.filter(p => p.result === 'made').length;

    // Return stats
    const returnerParticipation = specialTeamsParticipation.filter(p => p.participation_type === 'returner');
    const returns = returnerParticipation.length;
    const returnYards = returnerParticipation.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const returnAvg = returns > 0 ? returnYards / returns : 0;
    const returnTouchdowns = returnerParticipation.filter(p => p.is_touchdown).length;

    // Coverage stats (gunner/coverage_tackle)
    const coverageParticipation = specialTeamsParticipation.filter(p =>
      p.participation_type === 'gunner' || p.participation_type === 'coverage_tackle'
    );
    const coverageTackles = coverageParticipation.length;

    return {
      player: {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number || '',
        position: player.primary_position || player.position || ''
      },
      totalPlays,
      successRate,
      rushingAttempts,
      rushingYards,
      rushingAvg,
      rushingTouchdowns,
      rushingFumbles,
      passingAttempts,
      completions,
      completionPct,
      passingYards,
      passingTouchdowns,
      interceptions,
      passingFumbles,
      targets,
      receptions,
      receivingYards,
      receivingAvg,
      receivingTouchdowns,
      drops,
      receivingFumbles,
      yardsByDown,
      topPlays,
      // Defensive stats
      defensiveSnaps,
      tackles,
      tacklesForLoss,
      sacks,
      pressures,
      passBreakups,
      defensiveInterceptions,
      forcedFumbles,
      missedTackles,
      // Special Teams stats
      specialTeamsSnaps,
      kickoffs,
      kickoffYards,
      kickoffAvg,
      kickoffTouchbacks,
      punts,
      puntYards,
      puntAvg,
      fieldGoalAttempts,
      fieldGoalsMade,
      fieldGoalPct,
      patAttempts,
      patMade,
      returns,
      returnYards,
      returnAvg,
      returnTouchdowns,
      coverageTackles
    };
  }

  /**
   * Helper to return empty stats when player has no plays
   */
  private getEmptyPlayerStats(player: any): PlayerStats {
    return {
      player: {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number || '',
        position: player.primary_position || player.position || ''
      },
      totalPlays: 0,
      successRate: 0,
      rushingAttempts: 0,
      rushingYards: 0,
      rushingAvg: 0,
      rushingTouchdowns: 0,
      rushingFumbles: 0,
      passingAttempts: 0,
      completions: 0,
      completionPct: 0,
      passingYards: 0,
      passingTouchdowns: 0,
      interceptions: 0,
      passingFumbles: 0,
      targets: 0,
      receptions: 0,
      receivingYards: 0,
      receivingAvg: 0,
      receivingTouchdowns: 0,
      drops: 0,
      receivingFumbles: 0,
      yardsByDown: {
        firstDown: { attempts: 0, totalYards: 0, avgYards: 0 },
        secondDown: { attempts: 0, totalYards: 0, avgYards: 0 },
        thirdDown: { attempts: 0, totalYards: 0, avgYards: 0 },
        fourthDown: { attempts: 0, totalYards: 0, avgYards: 0 }
      },
      topPlays: [],
      // Defensive stats
      defensiveSnaps: 0,
      tackles: 0,
      tacklesForLoss: 0,
      sacks: 0,
      pressures: 0,
      passBreakups: 0,
      defensiveInterceptions: 0,
      forcedFumbles: 0,
      missedTackles: 0,
      // Special Teams stats
      specialTeamsSnaps: 0,
      kickoffs: 0,
      kickoffYards: 0,
      kickoffAvg: 0,
      kickoffTouchbacks: 0,
      punts: 0,
      puntYards: 0,
      puntAvg: 0,
      fieldGoalAttempts: 0,
      fieldGoalsMade: 0,
      fieldGoalPct: 0,
      patAttempts: 0,
      patMade: 0,
      returns: 0,
      returnYards: 0,
      returnAvg: 0,
      returnTouchdowns: 0,
      coverageTackles: 0
    };
  }
}