// src/app/teams/[teamId]/analytics-v2/page.tsx
// New analytics page with ODK + Level hierarchy

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { Team, TeamAnalyticsConfig } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';
import AnalyticsFilterBar from '@/components/analytics/AnalyticsFilterBar';

// Offense sections
import OverallPerformanceSection from '@/components/analytics/offense/OverallPerformanceSection';
import DownBreakdownSection from '@/components/analytics/offense/DownBreakdownSection';
import DriveAnalyticsSection from '@/components/analytics/offense/DriveAnalyticsSection';
import PlayerPerformanceSection from '@/components/analytics/offense/PlayerPerformanceSection';
import QBStatsSection from '@/components/analytics/offense/QBStatsSection';
import RBStatsSection from '@/components/analytics/offense/RBStatsSection';
import WRTEStatsSection from '@/components/analytics/offense/WRTEStatsSection';
import OLStatsSection from '@/components/analytics/offense/OLStatsSection';
import AllQBStatsSection from '@/components/analytics/offense/AllQBStatsSection';
import AllRBStatsSection from '@/components/analytics/offense/AllRBStatsSection';
import AllWRTEStatsSection from '@/components/analytics/offense/AllWRTEStatsSection';
import AllOLStatsSection from '@/components/analytics/offense/AllOLStatsSection';

// Defense sections
import OverallDefenseSection from '@/components/analytics/defense/OverallDefenseSection';
import DefensivePerformanceSection from '@/components/analytics/defense/DefensivePerformanceSection';
import DefensiveDriveAnalyticsSection from '@/components/analytics/defense/DefensiveDriveAnalyticsSection';
import DefensiveDownBreakdownSection from '@/components/analytics/defense/DefensiveDownBreakdownSection';
import DLStatsSection from '@/components/analytics/defense/DLStatsSection';
import LBStatsSection from '@/components/analytics/defense/LBStatsSection';
import DBStatsSection from '@/components/analytics/defense/DBStatsSection';
import AllDLStatsSection from '@/components/analytics/defense/AllDLStatsSection';
import AllLBStatsSection from '@/components/analytics/defense/AllLBStatsSection';
import AllDBStatsSection from '@/components/analytics/defense/AllDBStatsSection';

// Unified player stats (multi-position support)
import UnifiedPlayerStatsSection from '@/components/analytics/UnifiedPlayerStatsSection';
import PlayerStatsTable from '@/components/analytics/PlayerStatsTable';
import type { PlayerStatFilter, UnifiedPlayerStats } from '@/types/football';

interface Game {
  id: string;
  name?: string;
  opponent?: string;
  date?: string;
  game_result: 'win' | 'loss' | 'tie' | null;
}

interface Player {
  id: string;
  jersey_number: string;
  first_name: string;
  last_name: string;
  primary_position?: string; // Will be populated by migration 029
  position_group?: 'offense' | 'defense' | 'special_teams'; // Will be populated by migration 029
  position_depths: Record<string, number>; // JSONB field with positions
  is_active: boolean;
}

type ODK = 'offense' | 'defense' | 'special_teams' | 'player';
type Level = 'season' | 'game';
type ViewMode = 'cards' | 'list' | 'print';
type PositionGroup = 'QB' | 'RB' | 'WR/TE' | 'OL' | 'DL' | 'LB' | 'DB';

export default function AnalyticsV2Page({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [config, setConfig] = useState<TeamAnalyticsConfig | null>(null);

  // Filter state
  const [selectedODK, setSelectedODK] = useState<ODK>('offense');
  const [selectedLevel, setSelectedLevel] = useState<Level>('season');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Player state
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPositionGroup, setSelectedPositionGroup] = useState<PositionGroup | ''>('');

  // Unified player stats (replaces fragmented position group fetching)
  const [unifiedPlayerStats, setUnifiedPlayerStats] = useState<UnifiedPlayerStats[]>([]);
  const [playerStatFilter, setPlayerStatFilter] = useState<PlayerStatFilter>('all');

  // Data state
  const [basicAnalytics, setBasicAnalytics] = useState<any>(null);
  const [driveAnalytics, setDriveAnalytics] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [defStats, setDefStats] = useState<any[]>([]);
  const [defensiveAnalytics, setDefensiveAnalytics] = useState<any>(null);

  // Defensive team analytics
  const [defensiveDriveAnalytics, setDefensiveDriveAnalytics] = useState<any>(null);
  const [defensiveDownBreakdown, setDefensiveDownBreakdown] = useState<any[]>([]);

  // Position-specific stats
  const [positionStats, setPositionStats] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const analyticsService = new AnalyticsService();
  const advancedService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  // Clear position group when switching ODKs
  useEffect(() => {
    setSelectedPositionGroup('');
    setPositionStats(null);
  }, [selectedODK]);

  // Fetch unified player stats when player phase is selected
  useEffect(() => {
    if (selectedODK === 'player' && config) {
      fetchUnifiedPlayerStats();
    } else {
      setUnifiedPlayerStats([]);
      setPositionStats(null);
    }
  }, [selectedODK, selectedGameId, config]);

  // Filter unified stats when filter changes
  useEffect(() => {
    if (unifiedPlayerStats.length > 0) {
      applyPlayerStatFilter();
    }
  }, [playerStatFilter, selectedPositionGroup, unifiedPlayerStats]);

  /**
   * Fetch unified player stats (all offensive + OL + defensive stats merged)
   * Replaces old fragmented fetchPositionStats approach
   */
  const fetchUnifiedPlayerStats = async () => {
    try {
      setLoadingPlayerStats(true);
      console.log('🔄 Fetching unified player stats...');
      const gameId = selectedGameId || undefined;

      const unified = await advancedService.getUnifiedPlayerStats(teamId, gameId);
      console.log('✅ Unified stats fetched:', unified.length, 'players');

      setUnifiedPlayerStats(unified);

      // Apply initial filter
      applyPlayerStatFilter();
    } catch (error: any) {
      console.error('❌ Error fetching unified player stats:', error);
      setUnifiedPlayerStats([]);
      setPositionStats([]);
    } finally {
      setLoadingPlayerStats(false);
    }
  };

  /**
   * Apply client-side filtering to unified stats based on selected filter
   */
  const applyPlayerStatFilter = () => {
    if (unifiedPlayerStats.length === 0) {
      setPositionStats([]);
      return;
    }

    console.log('🔍 Applying filter:', playerStatFilter, selectedPositionGroup);
    let filtered = unifiedPlayerStats;

    switch (playerStatFilter) {
      case 'offense':
        filtered = unifiedPlayerStats.filter(s => s.offense !== null);
        console.log('🔍 Filtered to offensive players:', filtered.length);
        break;

      case 'defense':
        filtered = unifiedPlayerStats.filter(s => s.defense !== null);
        console.log('🔍 Filtered to defensive players:', filtered.length);
        break;

      case 'ol':
        filtered = unifiedPlayerStats.filter(s => s.offensiveLine !== null);
        console.log('🔍 Filtered to OL players:', filtered.length);
        break;

      case 'position_group':
        if (selectedPositionGroup) {
          const positionCodes = getPositionCodesForGroup(selectedPositionGroup);
          filtered = unifiedPlayerStats.filter(s =>
            s.positions.some(pos => positionCodes.includes(pos))
          );
          console.log('🔍 Filtered to', selectedPositionGroup, 'players:', filtered.length);
        }
        break;

      case 'all':
      default:
        console.log('🔍 Showing all players:', filtered.length);
        break;
    }

    setPositionStats(filtered);
  };

  /**
   * Map position group to position codes for filtering
   */
  const getPositionCodesForGroup = (group: PositionGroup): string[] => {
    switch (group) {
      case 'QB': return ['QB'];
      case 'RB': return ['RB', 'FB'];
      case 'WR/TE': return ['WR', 'TE', 'SWR', 'X', 'Y', 'Z'];
      case 'OL': return ['LT', 'LG', 'C', 'RG', 'RT'];
      case 'DL': return ['DE', 'DT', 'NT', 'DT1', 'DT2'];
      case 'LB': return ['MLB', 'OLB', 'LB', 'ILB', 'SAM', 'WILL', 'MIKE'];
      case 'DB': return ['CB', 'S', 'FS', 'SS', 'DB', 'LCB', 'RCB'];
      default: return [];
    }
  };

  /**
   * Legacy function - replaced by unified approach
   * Kept for reference during migration
   */
  const fetchPositionStats_LEGACY = async () => {
    if (!selectedPositionGroup) return;

    try {
      console.log('🎯 Fetching position stats for:', selectedPositionGroup);
      const gameId = selectedGameId || undefined;

      // Fetch ALL players' attribution stats
      console.log('📊 Calling getPlayerAttributionStats...');
      const allPlayerStats = await advancedService.getPlayerAttributionStats(teamId, gameId);
      console.log('📊 Player attribution stats fetched:', allPlayerStats?.length || 0, 'players');
      console.log('📊 Sample player data:', allPlayerStats?.[0]);

      // Log all unique positions to debug
      const uniquePositions = [...new Set(allPlayerStats.map((p: any) => p.position))];
      console.log('📊 All unique positions found:', uniquePositions);

      // Log all positions from position_depths
      const allPositionsFromDepths = new Set<string>();
      allPlayerStats.forEach((p: any) => {
        Object.keys(p.position_depths || {}).forEach(pos => allPositionsFromDepths.add(pos));
      });
      console.log('📊 All positions from position_depths:', Array.from(allPositionsFromDepths));

      // Filter and transform stats by selected position group
      let transformedStats: any[] = [];

      switch (selectedPositionGroup) {
        case 'QB': {
          console.log('🔍 Filtering for QB position...');
          const qbStats = allPlayerStats.filter((s: any) => playerPlaysPosition(s, 'QB'));
          console.log('🔍 Found', qbStats.length, 'QBs');
          console.log('🔍 QB data sample:', qbStats[0]);
          transformedStats = qbStats.map((s: any) => ({
            playerId: s.playerId,
            playerName: s.playerName,
            jerseyNumber: s.jerseyNumber,
            attempts: s.passAttempts || 0,
            completions: s.completions || 0,
            completionPct: s.completionPct || 0,
            passingYards: s.passYards || 0,
            yardsPerAttempt: s.passAttempts > 0 ? (s.passYards || 0) / s.passAttempts : 0,
            touchdowns: s.passTouchdowns || 0,
            interceptions: s.interceptions || 0,
            sacks: 0, // TODO: Add sacks to player attribution
            successRate: s.rushSuccessRate || 0, // TODO: Add pass success rate
          }));
          break;
        }
        case 'RB': {
          console.log('🔍 Filtering for RB/FB positions...');
          const rbStats = allPlayerStats.filter((s: any) => playerPlaysPosition(s, ['RB', 'FB']));
          console.log('🔍 Found', rbStats.length, 'RBs');
          transformedStats = rbStats.map((s: any) => ({
            playerId: s.playerId,
            playerName: s.playerName,
            jerseyNumber: s.jerseyNumber,
            carries: s.carries || 0,
            rushingYards: s.rushYards || 0,
            yardsPerCarry: s.rushAvg || 0,
            rushingTouchdowns: s.rushTouchdowns || 0,
            longRun: 0, // TODO: Track long run
            rushingSuccessRate: s.rushSuccessRate || 0,
            runsOf10Plus: 0, // TODO: Track explosive runs
            targets: s.targets || 0,
            receptions: s.receptions || 0,
            receivingYards: s.recYards || 0,
            receivingTouchdowns: s.recTouchdowns || 0,
            yardsPerReception: s.recAvg || 0,
            totalTouches: (s.carries || 0) + (s.receptions || 0),
            totalYards: (s.rushYards || 0) + (s.recYards || 0),
            totalTouchdowns: (s.rushTouchdowns || 0) + (s.recTouchdowns || 0),
            yardsPerTouch: ((s.carries || 0) + (s.receptions || 0)) > 0
              ? ((s.rushYards || 0) + (s.recYards || 0)) / ((s.carries || 0) + (s.receptions || 0))
              : 0,
          }));
          break;
        }
        case 'WR/TE': {
          const wrteStats = allPlayerStats.filter((s: any) =>
            playerPlaysPosition(s, ['WR', 'TE', 'SWR', 'X', 'Y', 'Z'])
          );
          transformedStats = wrteStats.map((s: any) => ({
            playerId: s.playerId,
            playerName: s.playerName,
            jerseyNumber: s.jerseyNumber,
            position: s.position,
            targets: s.targets || 0,
            receptions: s.receptions || 0,
            catchRate: s.catchRate || 0,
            receivingYards: s.recYards || 0,
            yardsPerReception: s.recAvg || 0,
            yardsPerTarget: s.targets > 0 ? (s.recYards || 0) / s.targets : 0,
            touchdowns: s.recTouchdowns || 0,
            longReception: 0, // TODO: Track long reception
            firstDowns: 0, // TODO: Track first downs
            receptionsOf15Plus: 0, // TODO: Track explosive receptions
            successRate: 0, // TODO: Track receiving success rate
            dropRate: 0, // TODO: Track drops
          }));
          break;
        }
        case 'OL':
          if (config?.enable_ol_tracking) {
            console.log('🔍 Fetching OL stats...');
            try {
              // OL stats come from a different method (already in correct format)
              transformedStats = await advancedService.getOffensiveLineStats(teamId);
              console.log('🔍 Found', transformedStats.length, 'OL players');
            } catch (olError: any) {
              console.error('❌ OL stats failed:', olError.message);
              transformedStats = [];
            }
          }
          break;
        case 'DL': {
          if (config?.enable_defensive_tracking) {
            console.log('🔍 Fetching DL stats...');
            try {
              const allDefStats = await advancedService.getDefensiveStats(teamId);
              console.log('🔍 Got defensive stats, filtering for DL...');
              const dlStats = allDefStats.filter((s: any) => ['DE', 'DT', 'NT', 'DT1', 'DT2'].includes(s.position));
              console.log('🔍 Found', dlStats.length, 'DL players');
              transformedStats = dlStats.map((s: any) => ({
              playerId: s.playerId,
              playerName: s.playerName,
              jerseyNumber: s.jerseyNumber,
              position: s.position,
              defensiveSnaps: s.defensiveSnaps || 0,
              primaryTackles: s.primaryTackles || 0,
              assistTackles: s.assistTackles || 0,
              totalTackles: s.totalTackles || 0,
              missedTackles: s.missedTackles || 0,
              tackleParticipation: s.tackleParticipation || 0,
              passRushSnaps: s.defensiveSnaps || 0, // Approximate
              pressures: s.pressures || 0,
              sacks: s.sacks || 0,
              pressureRate: s.pressureRate || 0,
              runStops: s.tfls || 0, // Approximate
              runStopRate: (s.tfls && s.defensiveSnaps) ? (s.tfls / s.defensiveSnaps) * 100 : 0,
              tfls: s.tfls || 0,
              forcedFumbles: s.forcedFumbles || 0,
              havocRate: s.defensiveSnaps > 0 ? (((s.tfls || 0) + (s.sacks || 0) + (s.forcedFumbles || 0)) / s.defensiveSnaps) * 100 : 0,
            }));
            } catch (dlError: any) {
              console.error('❌ DL stats failed:', dlError.message);
              transformedStats = [];
            }
          }
          break;
        }
        case 'LB': {
          if (config?.enable_defensive_tracking) {
            console.log('🔍 Fetching LB stats...');
            try {
              const allDefStats = await advancedService.getDefensiveStats(teamId);
              console.log('🔍 Got defensive stats, filtering for LB...');
              const lbStats = allDefStats.filter((s: any) => ['MLB', 'OLB', 'LB', 'ILB', 'SAM', 'WILL', 'MIKE'].includes(s.position));
              console.log('🔍 Found', lbStats.length, 'LB players');
            transformedStats = lbStats.map((s: any) => ({
              playerId: s.playerId,
              playerName: s.playerName,
              jerseyNumber: s.jerseyNumber,
              position: s.position,
              defensiveSnaps: s.defensiveSnaps || 0,
              primaryTackles: s.primaryTackles || 0,
              assistTackles: s.assistTackles || 0,
              totalTackles: s.totalTackles || 0,
              missedTackles: s.missedTackles || 0,
              tackleParticipation: s.tackleParticipation || 0,
              coverageSnaps: s.defensiveSnaps || 0, // Approximate
              targets: s.targets || 0,
              completionsAllowed: (s.targets || 0) - (s.coverageWins || 0),
              yardsAllowed: 0, // TODO: Track yards allowed
              coverageSuccessRate: s.coverageSuccessRate || 0,
              blitzSnaps: (s.pressures || 0) > 0 ? (s.pressures || 0) * 3 : 0, // Approximate
              pressures: s.pressures || 0,
              sacks: s.sacks || 0,
              pressureRate: s.pressureRate || 0,
              tfls: s.tfls || 0,
              forcedFumbles: s.forcedFumbles || 0,
              interceptions: s.interceptions || 0,
              pbus: s.pbus || 0,
              havocRate: (s.defensiveSnaps || 0) > 0 ? (((s.tfls || 0) + (s.sacks || 0) + (s.interceptions || 0) + (s.pbus || 0) + (s.forcedFumbles || 0)) / s.defensiveSnaps) * 100 : 0,
            }));
            } catch (lbError: any) {
              console.error('❌ LB stats failed:', lbError.message);
              transformedStats = [];
            }
          }
          break;
        }
        case 'DB': {
          if (config?.enable_defensive_tracking) {
            console.log('🔍 Fetching DB stats...');
            try {
              const allDefStats = await advancedService.getDefensiveStats(teamId);
              console.log('🔍 Got defensive stats, filtering for DB...');
              const dbStats = allDefStats.filter((s: any) => ['CB', 'S', 'FS', 'SS', 'DB', 'LCB', 'RCB'].includes(s.position));
              console.log('🔍 Found', dbStats.length, 'DB players');
              transformedStats = dbStats.map((s: any) => ({
              playerId: s.playerId,
              playerName: s.playerName,
              jerseyNumber: s.jerseyNumber,
              position: s.position,
              defensiveSnaps: s.defensiveSnaps || 0,
              coverageSnaps: s.defensiveSnaps || 0, // Approximate
              targets: s.targets || 0,
              completionsAllowed: (s.targets || 0) - (s.coverageWins || 0),
              yardsAllowed: 0, // TODO: Track yards allowed
              yardsAllowedPerTarget: 0, // TODO: Calculate
              coverageSuccessRate: s.coverageSuccessRate || 0,
              interceptions: s.interceptions || 0,
              pbus: s.pbus || 0,
              ballProductionRate: (s.defensiveSnaps || 0) > 0 ? (((s.interceptions || 0) + (s.pbus || 0)) / s.defensiveSnaps) * 100 : 0,
              primaryTackles: s.primaryTackles || 0,
              assistTackles: s.assistTackles || 0,
              totalTackles: s.totalTackles || 0,
              missedTackles: s.missedTackles || 0,
            }));
            } catch (dbError: any) {
              console.error('❌ DB stats failed:', dbError.message);
              transformedStats = [];
            }
          }
          break;
        }
      }

      console.log('📊 Transformed stats count:', transformedStats.length);
      console.log('📊 Sample transformed data:', transformedStats[0]);
      console.log('📊 Setting position stats...');
      setPositionStats(transformedStats);
      console.log('✅ Position stats set successfully');
    } catch (error: any) {
      console.error('❌ Error fetching position stats:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      setPositionStats([]);
    }
  };

  // Helper function to calculate defensive stats from opponent plays
  const calculateDefensiveStats = async (teamId: string) => {
    try {
      // Query opponent plays (is_opponent_play = true)
      const { data: opponentPlays } = await supabase
        .from('play_instances')
        .select('yards_gained, down, distance, is_turnover')
        .eq('team_id', teamId)
        .eq('is_opponent_play', true);

      if (!opponentPlays || opponentPlays.length === 0) {
        return {
          totalPlays: 0,
          yardsAllowedPerPlay: 0,
          defensiveSuccessRate: 0,
          turnoversForced: 0,
        };
      }

      const totalPlays = opponentPlays.length;
      const totalYardsAllowed = opponentPlays.reduce((sum, play) => sum + (play.yards_gained || 0), 0);
      const yardsAllowedPerPlay = totalYardsAllowed / totalPlays;

      // Defensive success = opponent failed to get expected yards
      const defensiveSuccesses = opponentPlays.filter(play => {
        const yardsGained = play.yards_gained || 0;
        const down = play.down || 1;
        const distance = play.distance || 10;

        // Inverted success rate - defense succeeds when offense fails
        if (down === 1) return yardsGained < 0.40 * distance;
        if (down === 2) return yardsGained < 0.60 * distance;
        return yardsGained < distance; // 3rd/4th down
      }).length;

      const defensiveSuccessRate = (defensiveSuccesses / totalPlays) * 100;
      const turnoversForced = opponentPlays.filter(p => p.is_turnover).length;

      return {
        totalPlays,
        yardsAllowedPerPlay,
        defensiveSuccessRate,
        turnoversForced,
      };
    } catch (error) {
      console.error('Error calculating defensive stats:', error);
      return {
        totalPlays: 0,
        yardsAllowedPerPlay: 0,
        defensiveSuccessRate: 0,
        turnoversForced: 0,
      };
    }
  };

  // Helper: Timeout wrapper for async functions
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
      )
    ]);
  };

  const fetchData = async () => {
    try {
      console.log('🔄 Starting fetchData for teamId:', teamId);

      // Fetch team
      console.log('📊 Fetching team data...');
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw new Error(`Team fetch failed: ${teamError.message}`);
      console.log('✅ Team data loaded');
      setTeam(teamData);

      // Fetch games
      console.log('🏈 Fetching games...');
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, name, opponent, date, game_result')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      if (gamesError) throw new Error(`Games fetch failed: ${gamesError.message}`);
      console.log('✅ Games loaded:', gamesData?.length || 0);
      setGames(gamesData || []);

      // Fetch players
      console.log('👥 Fetching players...');
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('jersey_number');

      if (playersError) throw new Error(`Players fetch failed: ${playersError.message}`);
      console.log('✅ Players loaded:', playersData?.length || 0);
      setPlayers(playersData || []);

      // Get tier config
      console.log('⚙️ Fetching tier config...');
      const tierConfig = await advancedService.getTeamTier(teamId);
      console.log('✅ Tier config loaded:', tierConfig.tier);
      setConfig(tierConfig);

      // Basic analytics
      console.log('📈 Fetching basic analytics...');
      try {
        const basic = await analyticsService.getTeamAnalytics(teamId);
        console.log('✅ Basic analytics loaded');
        setBasicAnalytics(basic);
      } catch (basicError: any) {
        console.warn('⚠️ Basic analytics query failed:', basicError.message);
        console.warn('⚠️ Setting empty analytics to allow page to load...');
        // Set empty analytics so page can still load (handles case of 0 plays or query errors)
        setBasicAnalytics({
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
        });
      }

      // Drive analytics (Tier 2+)
      if (tierConfig.enable_drive_analytics) {
        console.log('🚗 Fetching drive analytics...');
        const drives = await advancedService.getDriveAnalytics(teamId);
        console.log('✅ Drive analytics loaded');
        setDriveAnalytics(drives);

        // Defensive drive analytics (Tier 2+)
        console.log('🛡️ Fetching defensive drive analytics...');
        const defDrives = await advancedService.getDefensiveDriveAnalytics(teamId);
        console.log('✅ Defensive drive analytics loaded');
        setDefensiveDriveAnalytics(defDrives);
      }

      // Player stats (Tier 2+)
      if (tierConfig.enable_player_attribution) {
        console.log('👤 Fetching player stats...');
        const players = await advancedService.getPlayerAttributionStats(teamId);
        console.log('✅ Player stats loaded');
        setPlayerStats(players);
      }

      // Defensive stats (Tier 3)
      if (tierConfig.enable_defensive_tracking) {
        console.log('🛡️ Fetching defensive stats (Tier 3)...');
        try {
          // Add 10 second timeout to prevent infinite hang
          const def = await withTimeout(
            advancedService.getDefensiveStats(teamId),
            10000,
            'Defensive stats query timed out after 10 seconds'
          );
          console.log('✅ Defensive stats loaded:', def?.length || 0);
          setDefStats(def);
        } catch (defError: any) {
          console.warn('⚠️ Defensive stats failed (non-fatal):', defError.message);
          console.warn('⚠️ Continuing without defensive player stats...');
          setDefStats([]); // Continue with empty defensive stats
        }
      }

      // Defensive analytics (all tiers - from opponent plays)
      console.log('⚔️ Calculating defensive analytics...');
      try {
        const defenseStats = await calculateDefensiveStats(teamId);
        console.log('✅ Defensive analytics calculated');
        setDefensiveAnalytics(defenseStats);
      } catch (defAnalyticsError: any) {
        console.warn('⚠️ Defensive analytics failed (non-fatal):', defAnalyticsError.message);
        setDefensiveAnalytics(null);
      }

      // Defensive down breakdown (all tiers)
      console.log('📉 Fetching defensive down breakdown...');
      try {
        const defDownBreakdown = await advancedService.getDefensiveDownBreakdown(teamId);
        console.log('✅ Defensive down breakdown loaded');
        setDefensiveDownBreakdown(defDownBreakdown);
      } catch (defDownError: any) {
        console.warn('⚠️ Defensive down breakdown failed (non-fatal):', defDownError.message);
        setDefensiveDownBreakdown([]);
      }

      console.log('✅ All data loaded successfully!');

    } catch (error: any) {
      console.error('❌ ERROR in fetchData:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);
      // Don't show alert - errors are now handled gracefully with fallback empty states
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!team || !config || !basicAnalytics) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Analytics not available</div>
          <button
            onClick={() => router.push(`/teams/${teamId}`)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  const record = getWinLossRecord();
  const selectedGame = selectedGameId ? games.find(g => g.id === selectedGameId) : null;
  const gameName = selectedGame ? `vs ${selectedGame.opponent}` : undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="analytics"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Filter Bar - Sticky, Compact, Horizontal */}
      <AnalyticsFilterBar
        selectedODK={selectedODK}
        onODKChange={setSelectedODK}
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        games={games}
        selectedGameId={selectedGameId}
        onGameChange={setSelectedGameId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrint={() => window.print()}
      />

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">

        {/* Analytics Sections - Offense */}
        {selectedODK === 'offense' && (
          <div className="space-y-6">
            {/* Overall Performance */}
            <OverallPerformanceSection
              data={basicAnalytics}
              viewMode={viewMode}
              level={selectedLevel}
              gameName={gameName}
            />

            {/* Drive Analytics (Tier 2+) */}
            {driveAnalytics && (
              <DriveAnalyticsSection
                data={driveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Down Breakdown */}
            <DownBreakdownSection
              data={basicAnalytics}
              viewMode={viewMode}
              level={selectedLevel}
              gameName={gameName}
            />
          </div>
        )}

        {/* Analytics Sections - Defense */}
        {selectedODK === 'defense' && (
          <div className="space-y-6">
            {/* Overall Defense - All Tiers */}
            {defensiveAnalytics && (
              <OverallDefenseSection
                data={defensiveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Defensive Drive Analytics (Tier 2+) */}
            {defensiveDriveAnalytics && config.enable_drive_analytics && (
              <DefensiveDriveAnalyticsSection
                data={defensiveDriveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Defensive Down Breakdown - All Tiers */}
            {defensiveDownBreakdown.length > 0 && (
              <DefensiveDownBreakdownSection
                data={defensiveDownBreakdown}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Message when no defensive data */}
            {!defensiveAnalytics && (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Defensive Data</h3>
                <p className="text-gray-600">
                  Tag opponent plays in the Film Room to see defensive analytics.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Sections - Special Teams */}
        {selectedODK === 'special_teams' && (
          <div className="border border-gray-200 rounded-lg p-12 text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Special Teams Analytics</h3>
            <p className="text-gray-600">
              Special teams tracking is coming in a future update.
            </p>
          </div>
        )}

        {/* Analytics Sections - Player (Unified Stats Table) */}
        {selectedODK === 'player' && (
          <div className="space-y-6">
            {loadingPlayerStats ? (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Crunching the numbers... 🏈
                  </h3>
                  <p className="text-gray-600">
                    This may take longer than a two-minute drill. Hang tight!
                  </p>
                </div>
              </div>
            ) : unifiedPlayerStats.length > 0 ? (
              <PlayerStatsTable
                data={unifiedPlayerStats}
                level={selectedLevel}
                gameName={selectedGameId ? gameName : undefined}
              />
            ) : (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Player Stats Yet</h3>
                <p className="text-gray-600">
                  Tag plays with player attribution in Film Room to see statistics.
                </p>
                <p className="text-gray-500 mt-2 text-sm">
                  (Your players are currently on the bench waiting for their stats to be tracked!)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
