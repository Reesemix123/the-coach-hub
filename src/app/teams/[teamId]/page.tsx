// src/app/teams/[teamId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: {
    primary?: string;
    secondary?: string;
  };
}

interface Game {
  id: string;
  name: string;
  date: string;
  opponent: string;
  team_score: number | null;
  opponent_score: number | null;
  game_result: 'win' | 'loss' | 'tie' | null;
}

interface Play {
  id: string;
  play_code: string;
  play_name: string;
  attributes: {
    odk: string;
    formation: string;
    playType?: string;
  };
}

interface TeamStats {
  totalPlays: number;
  offensivePlays: number;
  defensivePlays: number;
  specialTeamsPlays: number;
  topFormations: { name: string; count: number }[];
}

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'playbook' | 'analytics'>('schedule');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchTeamData();
  }, [params.teamId]);

  const fetchTeamData = async () => {
    try {
      // Fetch team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', params.teamId)
        .order('date', { ascending: false });

      setGames(gamesData || []);

      // Fetch plays
      const { data: playsData } = await supabase
        .from('playbook_plays')
        .select('id, play_code, play_name, attributes')
        .eq('team_id', params.teamId);

      setPlays(playsData || []);

      // Calculate stats
      if (playsData) {
        const offensivePlays = playsData.filter(p => p.attributes?.odk === 'offense').length;
        const defensivePlays = playsData.filter(p => p.attributes?.odk === 'defense').length;
        const specialTeamsPlays = playsData.filter(p => p.attributes?.odk === 'specialTeams').length;

        // Count formations
        const formationCounts: Record<string, number> = {};
        playsData.forEach(play => {
          const formation = play.attributes?.formation;
          if (formation) {
            formationCounts[formation] = (formationCounts[formation] || 0) + 1;
          }
        });

        const topFormations = Object.entries(formationCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        setStats({
          totalPlays: playsData.length,
          offensivePlays,
          defensivePlays,
          specialTeamsPlays,
          topFormations
        });
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading team...</div>
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

  const record = getWinLossRecord();
  const winPercentage = record.wins + record.losses > 0
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(0)
    : '0';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push('/setup')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Teams
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div
                className="h-2 w-20 rounded-full mb-3"
                style={{ backgroundColor: team.colors?.primary || '#000000' }}
              />
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                {team.name}
              </h1>
              {team.level && (
                <p className="mt-2 text-gray-600">{team.level}</p>
              )}
            </div>

            <div className="text-right">
              <div className="text-5xl font-semibold text-gray-900">
                {record.wins}-{record.losses}
                {record.ties > 0 && `-${record.ties}`}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {winPercentage}% Win Rate
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6 mt-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{games.length}</div>
              <div className="text-sm text-gray-600 mt-1">Games Played</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{stats?.totalPlays || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Total Plays</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{stats?.offensivePlays || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Offensive Plays</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-semibold text-gray-900">{stats?.defensivePlays || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Defensive Plays</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mt-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'schedule'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Schedule & Results
              {activeTab === 'schedule' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('playbook')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'playbook'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Playbook Summary
              {activeTab === 'playbook' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'analytics'
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
              {activeTab === 'analytics' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'schedule' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Games</h2>
              <button
                onClick={() => router.push('/film')}
                className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                Add Game Film
              </button>
            </div>

            {games.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg">
                <div className="text-gray-400 mb-4">No games scheduled yet</div>
                <button
                  onClick={() => router.push('/film')}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Add Your First Game
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            vs {game.opponent || 'TBD'}
                          </h3>
                          {game.game_result && (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                game.game_result === 'win'
                                  ? 'bg-green-100 text-green-700'
                                  : game.game_result === 'loss'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {game.game_result.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {game.date ? new Date(game.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Date TBD'}
                        </div>
                      </div>

                      {(game.team_score !== null || game.opponent_score !== null) && (
                        <div className="text-center mr-6">
                          <div className="text-3xl font-semibold text-gray-900">
                            {game.team_score ?? '-'} - {game.opponent_score ?? '-'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Final Score</div>
                        </div>
                      )}

                      <button
                        onClick={() => router.push(`/film/${game.id}`)}
                        className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View Film
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'playbook' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Playbook</h2>
              <button
                onClick={() => router.push('/playbook')}
                className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                View Full Playbook
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Play Distribution */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Play Distribution</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Offense</span>
                    <span className="font-semibold text-gray-900">{stats?.offensivePlays || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Defense</span>
                    <span className="font-semibold text-gray-900">{stats?.defensivePlays || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Special Teams</span>
                    <span className="font-semibold text-gray-900">{stats?.specialTeamsPlays || 0}</span>
                  </div>
                </div>
              </div>

              {/* Top Formations */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Formations</h3>
                {stats?.topFormations && stats.topFormations.length > 0 ? (
                  <div className="space-y-4">
                    {stats.topFormations.map((formation, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-gray-600">{formation.name}</span>
                        <span className="font-semibold text-gray-900">{formation.count} plays</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No plays yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h2>
            <div className="border border-gray-200 rounded-lg p-12 text-center">
              <div className="text-gray-400 mb-2">📊</div>
              <div className="text-gray-600">Advanced analytics coming soon</div>
              <div className="text-sm text-gray-500 mt-2">
                Track play success rates, tendencies, and game-by-game performance
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}