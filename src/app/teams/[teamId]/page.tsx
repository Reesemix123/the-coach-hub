// src/app/teams/[teamId]/page.tsx
// Team Dashboard - Coaching Mission Control
'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import TeamNavigation from '@/components/TeamNavigation';

interface Team {
  id: string;
  name: string;
  level: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

interface Game {
  id: string;
  opponent?: string;
  date?: string;
  game_result?: 'win' | 'loss' | 'tie' | null;
}

interface DashboardStats {
  playsInBook: number;
  gamesPlayed: number;
  videosUploaded: number;
  playsTagged: number;
  activePlayers: number;
}

export default function TeamDashboardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    playsInBook: 0,
    gamesPlayed: 0,
    videosUploaded: 0,
    playsTagged: 0,
    activePlayers: 0,
  });
  const [nextGame, setNextGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, [teamId]);

  async function fetchDashboardData() {
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
        .select('id, opponent, date, game_result')
        .eq('team_id', teamId)
        .order('date', { ascending: false });

      setGames(gamesData || []);

      // Find next upcoming game
      const now = new Date().toISOString().split('T')[0];
      const { data: upcomingGames } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', teamId)
        .gte('date', now)
        .order('date', { ascending: true })
        .limit(1);

      if (upcomingGames && upcomingGames.length > 0) {
        setNextGame(upcomingGames[0]);
      }

      // Fetch stats
      const [playsResult, videosResult, playInstancesResult, playersResult] = await Promise.all([
        supabase.from('playbook_plays').select('id', { count: 'exact' }).eq('team_id', teamId).eq('is_archived', false),
        supabase.from('videos').select('id', { count: 'exact' }).eq('team_id', teamId),
        supabase.from('play_instances').select('id', { count: 'exact' }).eq('team_id', teamId),
        supabase.from('players').select('id', { count: 'exact' }).eq('team_id', teamId).eq('is_active', true),
      ]);

      setStats({
        playsInBook: playsResult.count || 0,
        gamesPlayed: gamesData?.length || 0,
        videosUploaded: videosResult.count || 0,
        playsTagged: playInstancesResult.count || 0,
        activePlayers: playersResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Team not found</div>
          <button
            onClick={() => router.push('/teams')}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  const record = games.reduce(
    (acc, game) => {
      if (game.game_result === 'win') acc.wins++;
      else if (game.game_result === 'loss') acc.losses++;
      else if (game.game_result === 'tie') acc.ties++;
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 }
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="dashboard"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coaching Dashboard</h1>
          <p className="text-gray-600 mt-2">Mission control for {team.name}</p>
        </div>

        {/* Quick Stats */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Coaching Prep Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900">{stats.playsInBook}</div>
              <div className="text-sm text-gray-600 mt-1">Plays in Playbook</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900">{stats.videosUploaded}</div>
              <div className="text-sm text-gray-600 mt-1">Videos Uploaded</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900">{stats.playsTagged}</div>
              <div className="text-sm text-gray-600 mt-1">Plays Tagged</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900">{stats.gamesPlayed}</div>
              <div className="text-sm text-gray-600 mt-1">Games Played</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900">{stats.activePlayers}</div>
              <div className="text-sm text-gray-600 mt-1">Active Players</div>
            </div>
          </div>
        </div>

        {/* Next Game */}
        {nextGame && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Next Game</h2>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold text-gray-900">
                    vs {nextGame.opponent || 'TBD'}
                  </div>
                  <div className="text-gray-600 mt-1">
                    {nextGame.date ? new Date(nextGame.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    }) : 'Date TBD'}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/teams/${teamId}/film`)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    View Film
                  </button>
                  <button
                    onClick={() => router.push(`/teams/${teamId}/playbook`)}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Game Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push(`/teams/${teamId}/film`)}
              className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all text-left"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Upload Film</div>
                <div className="text-sm text-gray-600">Add game or opponent footage</div>
              </div>
            </button>

            <button
              onClick={() => router.push(`/playbook?teamId=${teamId}`)}
              className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all text-left"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Build Play</div>
                <div className="text-sm text-gray-600">Design new plays</div>
              </div>
            </button>

            <button
              onClick={() => router.push(`/teams/${teamId}/analytics-advanced`)}
              className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all text-left"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900">View Analytics</div>
                <div className="text-sm text-gray-600">See what's working</div>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Games */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Games</h2>
            <button
              onClick={() => router.push(`/teams/${teamId}/schedule`)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              View Full Schedule →
            </button>
          </div>
          <div className="space-y-3">
            {games.slice(0, 5).map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => router.push(`/teams/${teamId}/film`)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    game.game_result === 'win' ? 'bg-green-500' :
                    game.game_result === 'loss' ? 'bg-red-500' :
                    game.game_result === 'tie' ? 'bg-yellow-500' :
                    'bg-gray-300'
                  }`} />
                  <div>
                    <div className="font-medium text-gray-900">vs {game.opponent || 'TBD'}</div>
                    <div className="text-sm text-gray-600">
                      {game.date ? new Date(game.date).toLocaleDateString() : 'Date TBD'}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 capitalize">
                  {game.game_result || 'Scheduled'}
                </div>
              </div>
            ))}
            {games.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No games yet. Add games to your schedule to get started.</p>
                <button
                  onClick={() => router.push(`/teams/${teamId}/schedule`)}
                  className="mt-4 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Add Game
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
