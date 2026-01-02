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
  AlertCircle,
  Plus,
  Settings,
  Trash2,
  CreditCard,
  ChevronRight,
  Upload
} from 'lucide-react';
import ConsoleNav from '@/components/console/ConsoleNav';

interface TeamData {
  id: string;
  name: string;
  level: string;
  tier: string;
  tier_display_name: string;
  subscription: {
    status: string;
    billing_waived: boolean;
    trial_days_remaining: number | null;
    current_period_end: string | null;
  };
  members_count: number;
  games_count: number;
  plays_count: number;
  upload_tokens: {
    available: number;
    used_this_period: number;
    allocation: number;
  };
}

interface TeamsResponse {
  teams: TeamData[];
  totals: {
    teams: number;
    monthly_cost: number;
  };
}

export default function ConsoleTeamsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teamsData, setTeamsData] = useState<TeamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team form state
  const [teamName, setTeamName] = useState('');
  const [teamLevel, setTeamLevel] = useState('High School');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

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

    // Fetch teams data from API
    try {
      const response = await fetch('/api/console/teams');
      if (response.ok) {
        const data = await response.json();
        setTeamsData(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load teams');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }

    setLoading(false);
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
      loadData();

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
      loadData();
    }
  }

  function getSubscriptionBadge(subscription: TeamData['subscription']) {
    const { status, billing_waived } = subscription;

    if (billing_waived || status === 'waived') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Waived
        </span>
      );
    }

    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Active
        </span>
      );
    }

    if (status === 'past_due') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3" />
          Past Due
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {status || 'None'}
      </span>
    );
  }

  function getTokensIndicator(upload_tokens: TeamData['upload_tokens']) {
    const { available, allocation } = upload_tokens;
    const usagePercent = allocation > 0 ? Math.round(((allocation - available) / allocation) * 100) : 0;

    let colorClass = 'bg-green-500';
    if (available <= 1) {
      colorClass = 'bg-red-500';
    } else if (available <= Math.ceil(allocation / 2)) {
      colorClass = 'bg-amber-500';
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${colorClass}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-600">{available}/{allocation}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading teams...</p>
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
            <p className="text-gray-600 mb-8">Please sign in to access the console.</p>
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
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading Teams</h1>
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

  const teams = teamsData?.teams || [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
              Teams
            </h1>
            <p className="text-gray-600 mt-2">
              {teams.length} team{teams.length !== 1 ? 's' : ''}
              {teamsData?.totals.monthly_cost ? ` · $${teamsData.totals.monthly_cost}/mo` : ''}
            </p>
          </div>
        </div>

        {/* Console Navigation */}
        <ConsoleNav />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Could add filters here later */}
            </div>
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
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    {/* Left side - Team info */}
                    <div className="flex-1">
                      {/* Row 1: Name, Level badge, Subscription status */}
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-lg font-semibold text-gray-900 hover:underline"
                        >
                          {team.name}
                        </Link>
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {team.level}
                        </span>
                        {getSubscriptionBadge(team.subscription)}
                      </div>

                      {/* Row 2: Tier, Stats */}
                      <div className="flex items-center gap-5 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{team.tier_display_name}</span>
                        </span>
                        <span>
                          <span className="font-medium text-gray-900">{team.members_count}</span> member{team.members_count !== 1 ? 's' : ''}
                        </span>
                        <span>
                          <span className="font-medium text-gray-900">{team.games_count}</span> game{team.games_count !== 1 ? 's' : ''}
                        </span>
                        <span>
                          <span className="font-medium text-gray-900">{team.plays_count}</span> play{team.plays_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Row 3: Film Uploads */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Film Uploads:</span>
                          {getTokensIndicator(team.upload_tokens)}
                        </div>
                      </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Link
                        href={`/console/teams/${team.id}`}
                        className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Manage
                      </Link>
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
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </AuthGuard>
  );
}
