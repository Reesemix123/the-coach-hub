'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SubscriptionTier } from '@/types/admin';
import { TIER_DISPLAY_NAMES } from '@/lib/feature-access';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: Record<string, string>;
  created_at: string;
}

function SetupForm() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamLevel, setTeamLevel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'info' | 'success'>('error');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = createClient();

  // Get URL params
  const tierParam = searchParams.get('tier') as SubscriptionTier | null;
  const canceled = searchParams.get('canceled') === 'true';

  // Validate tier param
  const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium', 'ai_powered'];
  const selectedTier = tierParam && validTiers.includes(tierParam) ? tierParam : null;
  const tierDisplayName = selectedTier ? TIER_DISPLAY_NAMES[selectedTier] : null;

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        setTeams(data || []);
      }
      setLoading(false);
    }
    checkUser();
  }, []);

  // Show canceled message
  useEffect(() => {
    if (canceled) {
      setMessage('Checkout was canceled. You can try again when ready.');
      setMessageType('info');
    }
  }, [canceled]);

  // Auto-show form if tier is selected and no teams exist
  useEffect(() => {
    if (selectedTier && !loading && teams.length === 0) {
      setShowForm(true);
    }
  }, [selectedTier, loading, teams.length]);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!teamName.trim()) {
      setMessage('Please enter a team name');
      setMessageType('error');
      return;
    }

    setCreating(true);
    setMessage('');

    const { data, error } = await supabase
      .from('teams')
      .insert([{
        name: teamName.trim(),
        level: teamLevel.trim() || 'High School',
        colors: { primary: 'Blue', secondary: 'White' },
        user_id: user?.id
      }])
      .select()
      .single();

    if (error) {
      setMessage('Error: ' + error.message);
      setMessageType('error');
      setCreating(false);
      return;
    }

    // Team created successfully
    const newTeamId = data.id;

    // If a tier was selected, redirect to checkout
    if (selectedTier && selectedTier !== 'basic') {
      // Redirect to Stripe checkout
      setMessage('Redirecting to checkout...');
      setMessageType('info');

      try {
        const response = await fetch('/api/console/billing/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: newTeamId,
            tier: selectedTier
          })
        });

        const result = await response.json();

        if (result.url) {
          // Redirect to Stripe checkout
          window.location.href = result.url;
          return;
        } else {
          // Checkout failed, but team was created
          console.error('Checkout error:', result.error);
          setMessage('Team created, but checkout failed. You can set up billing later in team settings.');
          setMessageType('error');
          setCreating(false);

          // Refresh teams list
          const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
          setTeams(updatedTeams || []);
          setShowForm(false);
          setTeamName('');
          setTeamLevel('');
        }
      } catch (err) {
        console.error('Checkout error:', err);
        setMessage('Team created, but checkout failed. You can set up billing later in team settings.');
        setMessageType('error');
        setCreating(false);

        // Refresh teams list
        const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        setTeams(updatedTeams || []);
        setShowForm(false);
        setTeamName('');
        setTeamLevel('');
      }
    } else if (selectedTier === 'basic') {
      // Basic tier - free, no checkout needed
      // Just redirect to the team dashboard
      router.push(`/teams/${newTeamId}?subscription=success`);
    } else {
      // No tier selected - just refresh and show team list
      setMessage('');
      setTeamName('');
      setTeamLevel('');
      setShowForm(false);
      setCreating(false);
      const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
      setTeams(updatedTeams || []);
    }
  }

  async function deleteTeam(teamId: string, teamName: string) {
    if (!confirm(`Are you sure you want to delete ${teamName}?`)) return;

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      alert('Error deleting team: ' + error.message);
    } else {
      const { data: updatedTeams } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
      setTeams(updatedTeams || []);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
          <p className="text-gray-600 mb-8">Create and manage your teams.</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-semibold text-gray-900 mb-3">
            {selectedTier ? 'Set Up Your Team' : 'Teams'}
          </h1>
          {selectedTier ? (
            <p className="text-xl text-gray-600">
              Create your team to get started with the <span className="font-semibold">{tierDisplayName}</span> plan.
            </p>
          ) : (
            <p className="text-xl text-gray-600">Organize and manage your coaching teams.</p>
          )}
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`max-w-2xl mx-auto mb-8 p-4 rounded-lg text-sm ${
            messageType === 'error' ? 'bg-red-50 text-red-700' :
            messageType === 'success' ? 'bg-green-50 text-green-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {message}
          </div>
        )}

        {/* Create Team Section */}
        {!showForm ? (
          <div className="max-w-2xl mx-auto mb-16">
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-6 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
            >
              + Create New Team
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto mb-16 bg-gray-50 rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create New Team</h2>

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
                  disabled={creating}
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
                  disabled={creating}
                >
                  <option value="">Select level...</option>
                  <option value="Youth">Youth</option>
                  <option value="Middle School">Middle School</option>
                  <option value="JV">JV</option>
                  <option value="Varsity">Varsity</option>
                  <option value="College">College</option>
                </select>
              </div>

              {selectedTier && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">Selected Plan:</span> {tierDisplayName}
                  </p>
                  {selectedTier !== 'basic' && (
                    <p className="text-xs text-gray-500 mt-1">
                      You&apos;ll be redirected to complete payment after creating your team.
                    </p>
                  )}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setTeamName('');
                    setTeamLevel('');
                    setMessage('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : selectedTier && selectedTier !== 'basic' ? 'Create & Continue to Payment' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Teams List */}
        {teams.length === 0 ? (
          !showForm && (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <p className="text-2xl font-semibold text-gray-900 mb-3">No teams yet</p>
                <p className="text-gray-600 mb-8">Create your first team to get started.</p>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Teams</h2>

              <div className="space-y-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{team.level || 'High School'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/teams/${team.id}`}
                          className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => deleteTeam(team.id, team.name)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="max-w-4xl mx-auto border-t border-gray-200 pt-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  href="/playbook"
                  className="block px-6 py-4 text-center bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Manage Playbook
                </Link>
                <Link
                  href="/film"
                  className="block px-6 py-4 text-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Manage Film
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SetupLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupLoading />}>
      <SetupForm />
    </Suspense>
  );
}
