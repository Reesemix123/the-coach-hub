'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SubscriptionTier } from '@/types/admin';
import { TIER_DISPLAY_NAMES } from '@/lib/feature-access';
import { Check } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  level: string;
  colors: Record<string, string>;
  created_at: string;
  default_tier?: string;
}

interface TierOption {
  id: SubscriptionTier;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  aiPowered?: boolean;
}

const TIER_OPTIONS: TierOption[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    description: 'Get started with film review basics',
    features: ['1 team + 1 opponent game/month', '1 camera angle', '30-day video storage']
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 29,
    description: 'Full analytics for serious coaches',
    features: ['2 team + 2 opponent games/month', '3 camera angles', '180-day video storage', 'Play tagging & stats'],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 79,
    description: 'Complete coaching toolkit',
    features: ['4 team + 4 opponent games/month', '5 camera angles', '1-year video storage', 'Advanced analytics', 'AI play detection']
  }
];

// Token education content for each tier
const TOKEN_INFO: Record<SubscriptionTier, { team: number; opponent: number }> = {
  basic: { team: 1, opponent: 1 },
  plus: { team: 2, opponent: 2 },
  premium: { team: 4, opponent: 4 }
};

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
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = createClient();

  // Get URL params
  const tierParam = searchParams.get('tier') as SubscriptionTier | null;
  const canceled = searchParams.get('canceled') === 'true';

  // Validate tier param and set initial selected tier
  const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium'];

  // Initialize selectedTier from URL param on mount
  useEffect(() => {
    if (tierParam && validTiers.includes(tierParam)) {
      setSelectedTier(tierParam);
    }
  }, [tierParam]);

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
    if (tierParam && !loading && teams.length === 0) {
      setShowForm(true);
    }
  }, [tierParam, loading, teams.length]);

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
        user_id: user?.id,
        default_tier: selectedTier || 'basic'  // Pass selected tier for subscription/token initialization
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

    // Check if user has a pending subscription (from signup flow - paid before team creation)
    const { data: pendingSubscription } = await supabase
      .from('subscriptions')
      .select('id, tier, status')
      .eq('user_id', user?.id)
      .is('team_id', null)
      .single();

    if (pendingSubscription) {
      // Link the pending subscription to this new team
      const { error: linkError } = await supabase
        .from('subscriptions')
        .update({ team_id: newTeamId })
        .eq('id', pendingSubscription.id);

      if (linkError) {
        console.error('Error linking subscription to team:', linkError);
        setMessage('Team created, but there was an issue linking your subscription. Please contact support.');
        setMessageType('error');
      } else {
        console.log(`Linked subscription ${pendingSubscription.id} to team ${newTeamId}`);
      }

      // Redirect to team dashboard
      router.push(`/teams/${newTeamId}`);
      return;
    }

    // If a tier was selected that requires payment (and no pending subscription), redirect to checkout
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
      // Basic tier - redirect to team dashboard
      router.push(`/teams/${newTeamId}`);
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

              {/* Tier Selection */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Your Plan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      disabled={creating}
                      className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                        selectedTier === tier.id
                          ? 'border-black bg-gray-50 ring-1 ring-black'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      } ${creating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {/* Popular Badge */}
                      {tier.popular && (
                        <span className="absolute -top-2 right-2 inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                          Popular
                        </span>
                      )}

                      {/* Selected check */}
                      {selectedTier === tier.id && (
                        <div className="absolute top-2 left-2">
                          <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Tier name and price */}
                      <div className={`w-full ${selectedTier === tier.id ? 'pl-6' : ''}`}>
                        <h4 className="font-semibold text-gray-900">{tier.name}</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-gray-900">${tier.price}</span>
                          {tier.price > 0 && <span className="text-sm text-gray-500">/mo</span>}
                          {tier.price === 0 && <span className="text-sm text-gray-500">Free</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{tier.description}</p>
                        <ul className="mt-3 space-y-1">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-xs text-gray-600">
                              <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedTier && selectedTier !== 'basic' && (
                  <p className="text-xs text-gray-500 mt-3">
                    You&apos;ll be redirected to complete payment after creating your team.
                  </p>
                )}

                {/* Token Education - shows when a tier is selected */}
                {selectedTier && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2 text-sm">How Film Uploads Work</h4>
                    <ul className="text-sm text-blue-800 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">&#8226;</span>
                        <span>Each game you create uses one upload token</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">&#8226;</span>
                        <span>
                          <strong>{TOKEN_INFO[selectedTier].team} team</strong> game{TOKEN_INFO[selectedTier].team !== 1 ? 's' : ''} + <strong>{TOKEN_INFO[selectedTier].opponent} opponent</strong> scouting game{TOKEN_INFO[selectedTier].opponent !== 1 ? 's' : ''} per month
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">&#8226;</span>
                        <span>Team tokens upload your team&apos;s games</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">&#8226;</span>
                        <span>Opponent tokens scout upcoming matchups</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">&#8226;</span>
                        <span>Need more? Purchase additional tokens anytime</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>

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
