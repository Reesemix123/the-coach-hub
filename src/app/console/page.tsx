'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import {
  Users,
  Trophy,
  Film,
  Zap,
  AlertCircle,
  ChevronRight,
  Plus,
  Settings,
  Trash2,
  Shield,
  Upload,
  ArrowRight,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import ConsoleNav from '@/components/console/ConsoleNav';

interface OverviewData {
  organization: {
    id: string;
    name: string;
  } | null;
  summary: {
    teams_count: number;
    active_users_count: number;
    total_games: number;
    total_plays_tagged: number;
  };
  users: {
    total: number;
    new_this_week: number;
    new_this_month: number;
  };
  ai_credits: {
    used: number;
    allowed: number;
    percentage: number;
  };
  upload_tokens: {
    used: number;
    available: number;
    total_allocation: number;
    percentage: number;
  };
  billing: {
    status: string;
    next_billing_date: string | null;
    monthly_total: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    count?: number;
    team_id?: string;
    days_left?: number;
    action_url: string;
  }>;
  legacy_mode: boolean;
}

interface Team {
  id: string;
  name: string;
  level: string;
  colors: { primary?: string; secondary?: string } | null;
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
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
  const [teamName, setTeamName] = useState('');
  const [teamLevel, setTeamLevel] = useState('High School');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    // Check if user is platform admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    setIsPlatformAdmin(profile?.is_platform_admin === true);

    // Fetch overview data from API
    try {
      const response = await fetch('/api/console/overview');
      if (response.ok) {
        const data = await response.json();
        setOverview(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load overview');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }

    // Also fetch teams for the teams list
    await fetchTeams(user.id);
    setLoading(false);
  }

  async function fetchTeams(userId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTeams(data);
      // Fetch stats for all teams
      data.forEach(team => fetchTeamStats(team.id));
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

    const { error } = await supabase
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

      // Refresh data
      if (user) {
        await fetchTeams(user.id);
        loadData(); // Refresh overview
      }

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
        await fetchTeams(user.id);
        loadData(); // Refresh overview
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
            <p className="text-gray-600 mb-8">Access the console.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading Console</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); loadData(); }}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Try Again
            </button>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                  {overview?.organization?.name || 'Console'}
                </h1>
                <p className="mt-2 text-gray-600">
                  {overview?.legacy_mode ? 'Manage your teams' : 'Manage your program'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Go to Team Dashboard Button */}
                {teams.length > 0 && (
                  <div className="relative">
                    {teams.length === 1 ? (
                      // Single team - direct navigation
                      <Link
                        href={`/teams/${teams[0].id}`}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Go to Team Dashboard
                      </Link>
                    ) : (
                      // Multiple teams - dropdown
                      <>
                        <button
                          onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Go to Team Dashboard
                          <ChevronDown className={`w-4 h-4 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showTeamDropdown && (
                          <>
                            {/* Backdrop to close dropdown */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowTeamDropdown(false)}
                            />
                            {/* Dropdown menu */}
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                              <div className="py-2">
                                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Select a team
                                </div>
                                {teams.map((team) => (
                                  <Link
                                    key={team.id}
                                    href={`/teams/${team.id}`}
                                    onClick={() => setShowTeamDropdown(false)}
                                    className="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="font-medium">{team.name}</div>
                                    <div className="text-xs text-gray-500">{team.level}</div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isPlatformAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Platform Admin
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Console Navigation */}
        <ConsoleNav />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Alerts Section */}
          {overview && overview.alerts.length > 0 && (
            <div className="mb-8 space-y-3">
              {overview.alerts.map((alert, index) => (
                <Link
                  key={index}
                  href={alert.action_url}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-900">{alert.message}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-600" />
                </Link>
              ))}
            </div>
          )}

          {/* Stats Grid */}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Link
                href="/console/teams"
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-gray-900 mb-1">
                  {overview.summary.teams_count}
                </div>
                <div className="text-sm text-gray-600">Teams</div>
              </Link>

              <Link
                href="/console/people"
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-gray-900 mb-1">
                  {overview.summary.active_users_count}
                </div>
                <div className="text-sm text-gray-600">Active Users</div>
              </Link>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Trophy className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-gray-900 mb-1">
                  {overview.summary.total_games}
                </div>
                <div className="text-sm text-gray-600">Games</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Film className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-gray-900 mb-1">
                  {overview.summary.total_plays_tagged.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Plays Tagged</div>
              </div>
            </div>
          )}

          {/* Users Card - Platform-wide metrics */}
          {overview?.users && (
            <div className="mb-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Platform Users</h3>
                  <UserPlus className="w-5 h-5 text-gray-400" />
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-3xl font-semibold text-gray-900 mb-1">
                      {overview.users.total}
                    </div>
                    <div className="text-sm text-gray-600">Total Users</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-green-600 mb-1">
                      +{overview.users.new_this_week}
                    </div>
                    <div className="text-sm text-gray-600">New This Week</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-blue-600 mb-1">
                      +{overview.users.new_this_month}
                    </div>
                    <div className="text-sm text-gray-600">New This Month</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Film Uploads, AI Credits & Billing Row */}
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {/* Film Uploads Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Film Uploads</h3>
                  <Upload className="w-5 h-5 text-gray-400" />
                </div>
                <div className="mb-4">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-semibold text-gray-900">
                      {overview.upload_tokens?.available || 0}
                    </span>
                    <span className="text-gray-500 mb-1">
                      available
                    </span>
                  </div>
                  {/* Progress bar - shows usage (inverted) */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        overview.upload_tokens?.percentage >= 80
                          ? 'bg-amber-500'
                          : overview.upload_tokens?.percentage >= 50
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(overview.upload_tokens?.percentage || 0, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {overview.upload_tokens?.used || 0} of {overview.upload_tokens?.total_allocation || 0} used this period
                </p>
              </div>

              {/* AI Credits Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">AI Credits</h3>
                  <Zap className="w-5 h-5 text-gray-400" />
                </div>
                <div className="mb-4">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-semibold text-gray-900">
                      {overview.ai_credits.used}
                    </span>
                    <span className="text-gray-500 mb-1">
                      / {overview.ai_credits.allowed} used
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        overview.ai_credits.percentage >= 80
                          ? 'bg-amber-500'
                          : overview.ai_credits.percentage >= 50
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(overview.ai_credits.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {overview.ai_credits.allowed - overview.ai_credits.used} credits remaining this period
                </p>
              </div>

              {/* Billing Status Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
                  <Link
                    href="/console/billing"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Manage
                  </Link>
                </div>
                <div className="mb-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    overview.billing.status === 'current' || overview.billing.status === 'waived'
                      ? 'bg-green-100 text-green-800'
                      : overview.billing.status === 'past_due'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {overview.billing.status === 'current' && 'Current'}
                    {overview.billing.status === 'waived' && 'Waived'}
                    {overview.billing.status === 'past_due' && 'Past Due'}
                    {overview.billing.status === 'none' && 'No Subscription'}
                    {overview.billing.status === 'no_payment_method' && 'No Payment Method'}
                  </span>
                </div>
                {overview.billing.next_billing_date && (
                  <p className="text-sm text-gray-600">
                    Next billing: {new Date(overview.billing.next_billing_date).toLocaleDateString()}
                  </p>
                )}
                {overview.billing.status === 'waived' && (
                  <p className="text-sm text-gray-600">
                    Billing has been waived for your teams
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Teams Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Your Teams</h2>
              {teams.length > 0 && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Team
                </button>
              )}
            </div>

            {/* Create Team Form */}
            {showForm && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create New Team</h3>
                  <button
                    onClick={() => { setShowForm(false); setMessage(''); }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      onClick={() => { setShowForm(false); setMessage(''); }}
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
              <div className={`mb-6 p-4 rounded-lg ${
                message.includes('Error')
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-green-50 text-green-800 border border-green-200'
              }`}>
                {message}
              </div>
            )}

            {/* Teams List */}
            {teams.length === 0 && !showForm ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No teams yet</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Create Your First Team
                </button>
              </div>
            ) : teams.length > 0 ? (
              <div className="space-y-3">
                {teams.map((team) => {
                  const stats = teamStats[team.id] || { games: 0, plays: 0, players: 0 };

                  return (
                    <div
                      key={team.id}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-sm rounded-full">
                              {team.level}
                            </span>
                          </div>

                          <div className="flex items-center gap-5 text-sm text-gray-600">
                            <span><span className="font-medium text-gray-900">{stats.games}</span> games</span>
                            <span><span className="font-medium text-gray-900">{stats.plays}</span> plays</span>
                            <span><span className="font-medium text-gray-900">{stats.players}</span> players</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/console/teams/${team.id}`)}
                            className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            Manage
                          </button>
                          <button
                            onClick={() => router.push(`/teams/${team.id}/settings`)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Settings"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTeam(team.id, team.name)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
