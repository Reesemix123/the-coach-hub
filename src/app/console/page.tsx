'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: any;
  created_at: string;
  user_id: string;
}

interface TeamStats {
  games: number;
  plays: number;
  players: number;
}

export default function ConsolePage() {
  const [user, setUser] = useState<User | null>(null);
  const [ownedTeams, setOwnedTeams] = useState<Team[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
  const [teamName, setTeamName] = useState('');
  const [teamLevel, setTeamLevel] = useState('High School');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const router = useRouter();
  const membershipService = new TeamMembershipService();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      await fetchOwnedTeams(user.id);
    }

    setLoading(false);
  }

  async function fetchOwnedTeams(userId: string) {
    // Fetch teams where user is the owner
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOwnedTeams(data);

      // Fetch stats for each team
      for (const team of data) {
        await fetchTeamStats(team.id);
      }
    }
  }

  async function fetchTeamStats(teamId: string) {
    const [gamesCount, playsCount, playersCount] = await Promise.all([
      supabase.from('games').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabase.from('play_instances').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', teamId)
    ]);

    setTeamStats(prev => ({
      ...prev,
      [teamId]: {
        games: gamesCount.count || 0,
        plays: playsCount.count || 0,
        players: playersCount.count || 0
      }
    }));
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!teamName.trim()) {
      setMessage('Please enter a team name');
      return;
    }

    const { data, error } = await supabase
      .from('teams')
      .insert([{
        name: teamName.trim(),
        level: teamLevel.trim(),
        colors: { primary: '#000000', secondary: '#FFFFFF' },
        user_id: user?.id
      }])
      .select()
      .single();

    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('Team created successfully!');
      setTeamName('');
      setTeamLevel('High School');
      setShowForm(false);

      // Refresh teams
      if (user) {
        await fetchOwnedTeams(user.id);
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    }
  }

  async function deleteTeam(teamId: string, teamName: string) {
    if (!confirm(`Are you sure you want to delete "${teamName}"? This will delete all games, plays, and data associated with this team. This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      alert('Error deleting team: ' + error.message);
    } else {
      if (user) {
        await fetchOwnedTeams(user.id);
      }
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!user) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
            <p className="text-gray-600 mb-8">Access the owner console.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">Owner Console</h1>
            <p className="mt-2 text-gray-600">Manage your teams and organization</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Overview Stats */}
          <div className="grid grid-cols-3 gap-6 mb-12">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-semibold text-gray-900">{ownedTeams.length}</div>
              <div className="text-sm text-gray-600 mt-2">Teams Owned</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-semibold text-gray-900">
                {Object.values(teamStats).reduce((sum, stats) => sum + stats.games, 0)}
              </div>
              <div className="text-sm text-gray-600 mt-2">Total Games</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-semibold text-gray-900">
                {Object.values(teamStats).reduce((sum, stats) => sum + stats.plays, 0)}
              </div>
              <div className="text-sm text-gray-600 mt-2">Total Plays Tagged</div>
            </div>
          </div>

          {/* Create Team Section */}
          <div className="mb-8">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                + Create New Team
              </button>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Create New Team</h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setMessage('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={createTeam} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g., Varsity Football"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Level
                    </label>
                    <select
                      value={teamLevel}
                      onChange={(e) => setTeamLevel(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white text-gray-900"
                    >
                      <option value="Youth">Youth</option>
                      <option value="Middle School">Middle School</option>
                      <option value="High School">High School</option>
                      <option value="College">College</option>
                      <option value="Pro">Pro</option>
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setMessage('');
                      }}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
                    >
                      Create Team
                    </button>
                  </div>
                </form>
              </div>
            )}

            {message && (
              <div className={`mt-4 p-4 rounded-lg ${
                message.includes('Error')
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-green-50 text-green-800 border border-green-200'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Teams List */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Teams</h2>

            {ownedTeams.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-gray-400 mb-4">No teams yet</div>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Create Your First Team
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {ownedTeams.map((team) => {
                  const stats = teamStats[team.id] || { games: 0, plays: 0, players: 0 };

                  return (
                    <div
                      key={team.id}
                      className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900">{team.name}</h3>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                              {team.level}
                            </span>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-600 mt-4">
                            <div>
                              <span className="font-medium text-gray-900">{stats.games}</span> games
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{stats.plays}</span> plays
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{stats.players}</span> players
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => router.push(`/teams/${team.id}`)}
                            className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            View Team
                          </button>
                          <button
                            onClick={() => router.push(`/teams/${team.id}/settings`)}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Settings
                          </button>
                          <button
                            onClick={() => deleteTeam(team.id, team.name)}
                            className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
