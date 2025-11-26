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
}

export class AnalyticsService {
  private supabase = createClient();

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
   */
  async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
    // Fetch all play instances for this team (exclude opponent plays)
    const { data: plays, error } = await this.supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_opponent_play', false);

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
    const redZoneTouchdowns = redZonePlays.filter(p => p.result_type === 'touchdown').length;

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
   * Get comprehensive player statistics
   */
  async getPlayerStats(playerId: string, teamId: string): Promise<PlayerStats> {
    // Fetch player info
    const { data: player } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (!player) throw new Error('Player not found');

    // Fetch all plays by this player (check all player attribution columns)
    const { data: plays } = await this.supabase
      .from('play_instances')
      .select('*')
      .or(`ball_carrier_id.eq.${playerId},qb_id.eq.${playerId},target_id.eq.${playerId}`)
      .eq('team_id', teamId)
      .eq('is_opponent_play', false);

    if (!plays || plays.length === 0) {
      return this.getEmptyPlayerStats(player);
    }

    // Calculate overall stats
    const totalPlays = plays.length;
    const successfulPlays = plays.filter(p =>
      this.isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
    );
    const successRate = (successfulPlays.length / totalPlays) * 100;

    // Rushing stats (plays where this player was the ball carrier)
    const rushPlays = plays.filter(p => p.ball_carrier_id === playerId);
    const rushingAttempts = rushPlays.length;
    const rushingYards = rushPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const rushingAvg = rushingAttempts > 0 ? rushingYards / rushingAttempts : 0;
    const rushingTouchdowns = rushPlays.filter(p =>
      p.result?.includes('touchdown') || (p.yard_line && p.yard_line >= 100)
    ).length;
    const rushingFumbles = rushPlays.filter(p => p.is_turnover).length;

    // Passing stats (plays where this player was the QB)
    const passPlays = plays.filter(p => p.qb_id === playerId);
    const passingAttempts = passPlays.length;
    const completions = passPlays.filter(p =>
      p.result?.includes('complete') ||
      (p.result?.includes('touchdown') && p.target_id)
    ).length;
    const completionPct = passingAttempts > 0 ? (completions / passingAttempts) * 100 : 0;
    const passingYards = passPlays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const passingTouchdowns = passPlays.filter(p =>
      p.result?.includes('touchdown') && p.target_id
    ).length;
    const interceptions = passPlays.filter(p =>
      p.result?.includes('interception') || p.is_interception
    ).length;
    const passingFumbles = passPlays.filter(p => p.is_turnover && !p.is_interception).length;

    // Receiving stats (plays where this player was the target)
    const targetPlays = plays.filter(p => p.target_id === playerId);
    const targets = targetPlays.length;
    const receptions = targetPlays.filter(p =>
      p.result?.includes('complete') ||
      (p.result?.includes('touchdown') && p.target_id === playerId)
    ).length;
    const drops = targetPlays.filter(p =>
      p.result?.includes('incomplete') && !p.result?.includes('defended')
    ).length;
    const receivingYards = targetPlays
      .filter(p => p.result?.includes('complete') || p.result?.includes('touchdown'))
      .reduce((sum, p) => sum + (p.yards_gained || 0), 0);
    const receivingAvg = receptions > 0 ? receivingYards / receptions : 0;
    const receivingTouchdowns = targetPlays.filter(p =>
      p.result?.includes('touchdown')
    ).length;
    const receivingFumbles = targetPlays.filter(p => p.is_turnover).length;

    // Yards by down
    const firstDownPlays = plays.filter(p => p.down === 1);
    const secondDownPlays = plays.filter(p => p.down === 2);
    const thirdDownPlays = plays.filter(p => p.down === 3);
    const fourthDownPlays = plays.filter(p => p.down === 4);

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
      topPlays
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
      topPlays: []
    };
  }
}