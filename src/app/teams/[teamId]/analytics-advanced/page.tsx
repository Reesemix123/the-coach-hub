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

// Defense sections
import OverallDefenseSection from '@/components/analytics/defense/OverallDefenseSection';
import DefensivePerformanceSection from '@/components/analytics/defense/DefensivePerformanceSection';

interface Game {
  id: string;
  name?: string;
  opponent?: string;
  date?: string;
  game_result: 'win' | 'loss' | 'tie' | null;
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

  // Data state
  const [basicAnalytics, setBasicAnalytics] = useState<any>(null);
  const [driveAnalytics, setDriveAnalytics] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [defStats, setDefStats] = useState<any[]>([]);
  const [defensiveAnalytics, setDefensiveAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();
  const analyticsService = new AnalyticsService();
  const advancedService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

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

            {/* Player Performance (Player level, Tier 2+) */}
            {selectedLevel === 'player' && config.enable_player_attribution && (
              <PlayerPerformanceSection
                data={playerStats}
                gameName={selectedGameId && gameName}
              />
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

            {/* Defensive Player Stats (Player level, Tier 3) */}
            {selectedLevel === 'player' && config.enable_defensive_tracking && (
              <DefensivePerformanceSection
                data={defStats}
                gameName={selectedGameId && gameName}
              />
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
            {selectedLevel === 'player' && !config.enable_defensive_tracking && (
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
