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

// Defense sections
import OverallDefenseSection from '@/components/analytics/defense/OverallDefenseSection';
import DefensivePerformanceSection from '@/components/analytics/defense/DefensivePerformanceSection';
import DefensiveDriveAnalyticsSection from '@/components/analytics/defense/DefensiveDriveAnalyticsSection';
import DefensiveDownBreakdownSection from '@/components/analytics/defense/DefensiveDownBreakdownSection';
import DLStatsSection from '@/components/analytics/defense/DLStatsSection';
import LBStatsSection from '@/components/analytics/defense/LBStatsSection';
import DBStatsSection from '@/components/analytics/defense/DBStatsSection';

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
  primary_position: string;
  position_group: 'offense' | 'defense' | 'special_teams';
  is_active: boolean;
}

type ODK = 'offense' | 'defense' | 'special_teams';
type Level = 'season' | 'game' | 'player';
type ViewMode = 'cards' | 'list' | 'print';

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
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

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

  const router = useRouter();
  const supabase = createClient();
  const analyticsService = new AnalyticsService();
  const advancedService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  // Fetch position-specific stats when player is selected
  useEffect(() => {
    if (selectedLevel === 'player' && selectedPlayerId && config) {
      fetchPositionStats();
    } else {
      setPositionStats(null);
    }
  }, [selectedPlayerId, selectedLevel, selectedGameId, config]);

  const fetchPositionStats = async () => {
    if (!selectedPlayerId) return;

    const player = players.find(p => p.id === selectedPlayerId);
    if (!player) return;

    try {
      const gameId = selectedGameId || undefined;
      let stats = null;

      // Determine position category and fetch appropriate stats
      const position = player.primary_position;

      // Offense positions
      if (position === 'QB') {
        stats = await advancedService.getQBStats(selectedPlayerId, gameId);
      } else if (position === 'RB' || position === 'FB') {
        stats = await advancedService.getRBStats(selectedPlayerId, gameId);
      } else if (['WR', 'TE', 'SWR', 'X', 'Y', 'Z'].includes(position)) {
        stats = await advancedService.getWRTEStats(selectedPlayerId, gameId);
      } else if (['LT', 'LG', 'C', 'RG', 'RT'].includes(position) && config.enable_ol_tracking) {
        const allOLStats = await advancedService.getOffensiveLineStats(teamId);
        stats = allOLStats.find((s: any) => s.playerId === selectedPlayerId);
      }
      // Defense positions
      else if (['DE', 'DT', 'NT'].includes(position) && config.enable_defensive_tracking) {
        stats = await advancedService.getDLStats(selectedPlayerId, gameId);
      } else if (['MLB', 'OLB', 'LB', 'ILB'].includes(position) && config.enable_defensive_tracking) {
        stats = await advancedService.getLBStats(selectedPlayerId, gameId);
      } else if (['CB', 'S', 'FS', 'SS', 'DB'].includes(position) && config.enable_defensive_tracking) {
        stats = await advancedService.getDBStats(selectedPlayerId, gameId);
      }

      setPositionStats(stats);
    } catch (error) {
      console.error('Error fetching position stats:', error);
      setPositionStats(null);
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

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      setTeam(teamData);

      // Fetch games
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, name, opponent, date, game_result')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      setGames(gamesData || []);

      // Fetch players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('jersey_number');

      setPlayers(playersData || []);

      // Get tier config
      const tierConfig = await advancedService.getTeamTier(teamId);
      setConfig(tierConfig);

      // Basic analytics
      const basic = await analyticsService.getTeamAnalytics(teamId);
      setBasicAnalytics(basic);

      // Drive analytics (Tier 2+)
      if (tierConfig.enable_drive_analytics) {
        const drives = await advancedService.getDriveAnalytics(teamId);
        setDriveAnalytics(drives);

        // Defensive drive analytics (Tier 2+)
        const defDrives = await advancedService.getDefensiveDriveAnalytics(teamId);
        setDefensiveDriveAnalytics(defDrives);
      }

      // Player stats (Tier 2+)
      if (tierConfig.enable_player_attribution) {
        const players = await advancedService.getPlayerAttributionStats(teamId);
        setPlayerStats(players);
      }

      // Defensive stats (Tier 3)
      if (tierConfig.enable_defensive_tracking) {
        const def = await advancedService.getDefensiveStats(teamId);
        setDefStats(def);
      }

      // Defensive analytics (all tiers - from opponent plays)
      const defenseStats = await calculateDefensiveStats(teamId);
      setDefensiveAnalytics(defenseStats);

      // Defensive down breakdown (all tiers)
      const defDownBreakdown = await advancedService.getDefensiveDownBreakdown(teamId);
      setDefensiveDownBreakdown(defDownBreakdown);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
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

  // Get selected player details
  const selectedPlayer = selectedPlayerId ? players.find(p => p.id === selectedPlayerId) : null;

  // Filter players by position group matching selected ODK
  const filteredPlayers = players.filter(p => {
    if (selectedODK === 'offense') return p.position_group === 'offense';
    if (selectedODK === 'defense') return p.position_group === 'defense';
    if (selectedODK === 'special_teams') return p.position_group === 'special_teams';
    return false;
  });

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

      {/* Player Selector (shown when Level is Player) */}
      {selectedLevel === 'player' && (
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Player
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">-- Select a player --</option>
              {filteredPlayers.map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name} ({player.primary_position})
                </option>
              ))}
            </select>
            {selectedPlayer && (
              <div className="mt-2 text-sm text-gray-600">
                Viewing {selectedGameId && gameName ? `${gameName} stats` : 'season stats'} for{' '}
                <span className="font-medium text-gray-900">
                  #{selectedPlayer.jersey_number} {selectedPlayer.first_name} {selectedPlayer.last_name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">

        {/* Analytics Sections - Offense */}
        {selectedODK === 'offense' && (
          <div className="space-y-6">
            {/* Overall Performance (Season/Game level) */}
            {selectedLevel !== 'player' && (
              <OverallPerformanceSection
                data={basicAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Drive Analytics (Season/Game level, Tier 2+) */}
            {selectedLevel !== 'player' && driveAnalytics && (
              <DriveAnalyticsSection
                data={driveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Down Breakdown (Season/Game level) */}
            {selectedLevel !== 'player' && (
              <DownBreakdownSection
                data={basicAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Position-Specific Player Stats (Player level, Tier 2+) */}
            {selectedLevel === 'player' && selectedPlayer && config.enable_player_attribution && (
              <>
                {/* QB Stats */}
                {selectedPlayer.primary_position === 'QB' && (
                  <QBStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* RB Stats */}
                {['RB', 'FB'].includes(selectedPlayer.primary_position) && (
                  <RBStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* WR/TE Stats */}
                {['WR', 'TE', 'SWR', 'X', 'Y', 'Z'].includes(selectedPlayer.primary_position) && (
                  <WRTEStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* OL Stats (Tier 3 only) */}
                {['LT', 'LG', 'C', 'RG', 'RT'].includes(selectedPlayer.primary_position) && config.enable_ol_tracking && (
                  <OLStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* OL Tier 3 Required Message */}
                {['LT', 'LG', 'C', 'RG', 'RT'].includes(selectedPlayer.primary_position) && !config.enable_ol_tracking && (
                  <div className="border border-gray-200 rounded-lg p-12 text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Tier 3 Required</h3>
                    <p className="text-gray-600">
                      Offensive line block tracking requires Tier 3 analytics.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Prompt to select player */}
            {selectedLevel === 'player' && !selectedPlayerId && (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Select a Player</h3>
                <p className="text-gray-600">
                  Choose a player from the dropdown above to view individual statistics.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Sections - Defense */}
        {selectedODK === 'defense' && (
          <div className="space-y-6">
            {/* Overall Defense (Season/Game level) - All Tiers */}
            {selectedLevel !== 'player' && defensiveAnalytics && (
              <OverallDefenseSection
                data={defensiveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Defensive Drive Analytics (Season/Game level, Tier 2+) */}
            {selectedLevel !== 'player' && defensiveDriveAnalytics && config.enable_drive_analytics && (
              <DefensiveDriveAnalyticsSection
                data={defensiveDriveAnalytics}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Defensive Down Breakdown (Season/Game level) - All Tiers */}
            {selectedLevel !== 'player' && defensiveDownBreakdown.length > 0 && (
              <DefensiveDownBreakdownSection
                data={defensiveDownBreakdown}
                viewMode={viewMode}
                level={selectedLevel}
                gameName={gameName}
              />
            )}

            {/* Position-Specific Defensive Player Stats (Player level, Tier 3) */}
            {selectedLevel === 'player' && selectedPlayer && config.enable_defensive_tracking && (
              <>
                {/* DL Stats */}
                {['DE', 'DT', 'NT'].includes(selectedPlayer.primary_position) && (
                  <DLStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* LB Stats */}
                {['MLB', 'OLB', 'LB', 'ILB'].includes(selectedPlayer.primary_position) && (
                  <LBStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}

                {/* DB Stats */}
                {['CB', 'S', 'FS', 'SS', 'DB'].includes(selectedPlayer.primary_position) && (
                  <DBStatsSection data={positionStats} gameName={selectedGameId ? gameName : undefined} />
                )}
              </>
            )}

            {/* Prompt to select player */}
            {selectedLevel === 'player' && !selectedPlayerId && (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Select a Player</h3>
                <p className="text-gray-600">
                  Choose a defensive player from the dropdown above to view individual statistics.
                </p>
              </div>
            )}

            {/* Message when no defensive data */}
            {selectedLevel !== 'player' && !defensiveAnalytics && (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Defensive Data</h3>
                <p className="text-gray-600">
                  Tag opponent plays in the Film Room to see defensive analytics.
                </p>
              </div>
            )}

            {/* Message when Player level but no Tier 3 */}
            {selectedLevel === 'player' && selectedPlayerId && !config.enable_defensive_tracking && (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Tier 3 Required</h3>
                <p className="text-gray-600">
                  Individual defensive player stats require Tier 3 analytics.
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
      </div>
    </div>
  );
}
