// src/app/teams/[teamId]/settings/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { Team, TeamMembership, TeamAnalyticsConfig, AnalyticsTier } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { SubscriptionTier } from '@/types/admin';
import {
  TIER_DISPLAY_NAMES,
  TIER_LEVELS,
  isUpgrade,
  getStatusMessage
} from '@/lib/feature-access';
import { Play, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { useGlobalOnboardingSafe } from '@/components/onboarding/GlobalOnboardingProvider';
import AICreditsUsage from '@/components/AICreditsUsage';
import CancelSubscriptionModal from '@/components/CancelSubscriptionModal';

interface TeamMemberWithUser {
  membership: TeamMembership;
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface Game {
  id: string;
  game_result: 'win' | 'loss' | 'tie' | null;
}

export default function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [config, setConfig] = useState<TeamAnalyticsConfig | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'coach' | 'analyst' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'tier' | 'members' | 'ai_credits' | 'onboarding'>('tier');
  const onboarding = useGlobalOnboardingSafe();
  const [savingTier, setSavingTier] = useState(false);
  const [tierSaveMessage, setTierSaveMessage] = useState<string | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  // Subscription hook for tier enforcement
  const {
    subscription,
    tier: subscriptionTier,
    status: subscriptionStatus,
    showUpgradePrompt,
    showPaymentWarning,
    statusMessage,
    tierDisplayName,
    isTrialing,
    trialDaysRemaining,
    loading: subscriptionLoading,
    error: subscriptionError
  } = useFeatureAccess(teamId);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'coach' | 'analyst' | 'viewer'>('coach');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Coach request state (for trial users)
  const [requestingCoaches, setRequestingCoaches] = useState(false);
  const [coachRequestMessage, setCoachRequestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contentSummary, setContentSummary] = useState<any>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [reactivatingSubscription, setReactivatingSubscription] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const membershipService = new TeamMembershipService();
  const analyticsService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch games for record
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, game_result')
        .eq('team_id', teamId);

      setGames(gamesData || []);

      // Get user's role
      const role = await membershipService.getUserRole(teamId);
      setUserRole(role);

      // Only owners and coaches can view settings
      if (!role || !['owner', 'coach'].includes(role)) {
        router.push(`/teams/${teamId}`);
        return;
      }

      // Fetch team members
      const teamMembers = await membershipService.getTeamMembers(teamId);
      setMembers(teamMembers);

      // Fetch analytics config
      const analyticsConfig = await analyticsService.getTeamTier(teamId);
      setConfig(analyticsConfig);

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTierUpdate = async (newTier: AnalyticsTier) => {
    if (!config || savingTier) return;

    setSavingTier(true);
    setTierSaveMessage(null);

    try {
      // Update tier and auto-enable appropriate features
      const updates: Partial<TeamAnalyticsConfig> = {
        tier: newTier,
        enable_drive_analytics: ['plus', 'premium', 'ai_powered'].includes(newTier),
        enable_player_attribution: ['plus', 'premium', 'ai_powered'].includes(newTier),
        enable_ol_tracking: ['premium', 'ai_powered'].includes(newTier),
        enable_defensive_tracking: ['premium', 'ai_powered'].includes(newTier),
        enable_situational_splits: ['premium', 'ai_powered'].includes(newTier),
        default_tagging_mode: newTier === 'basic' ? 'quick' :
                             newTier === 'plus' ? 'standard' : 'advanced'
      };

      await analyticsService.updateTeamTier(teamId, updates);
      setConfig({ ...config, ...updates });
      setTierSaveMessage('Analytics tier updated successfully!');

      // Clear message after 3 seconds
      setTimeout(() => setTierSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating tier:', error);
      setTierSaveMessage('Failed to update analytics tier');
    } finally {
      setSavingTier(false);
    }
  };

  // Handle subscription upgrade - redirect to Stripe checkout
  const handleUpgrade = async (targetTier: SubscriptionTier) => {
    setCreatingCheckout(true);
    setTierSaveMessage(null);

    try {
      const response = await fetch('/api/console/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          tier: targetTier
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      setTierSaveMessage(error.message || 'Failed to start upgrade process');
    } finally {
      setCreatingCheckout(false);
    }
  };

  // Handle tier change (for existing subscribers)
  const handleChangeTier = async (targetTier: SubscriptionTier) => {
    if (!subscriptionTier || targetTier === subscriptionTier) return;

    setCreatingCheckout(true);
    setTierSaveMessage(null);

    try {
      const response = await fetch(`/api/console/teams/${teamId}/change-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_tier: targetTier })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change tier');
      }

      setTierSaveMessage(data.message || 'Subscription updated successfully!');

      // Refresh subscription data
      window.location.reload();
    } catch (error: any) {
      console.error('Error changing tier:', error);
      setTierSaveMessage(error.message || 'Failed to change subscription tier');
    } finally {
      setCreatingCheckout(false);
    }
  };

  // Open Stripe billing portal for payment method management
  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/console/billing/stripe/portal', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error opening billing portal:', error);
      setTierSaveMessage(error.message || 'Failed to open billing portal');
    }
  };

  const handleInviteCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMessage(null);

    try {
      const result = await membershipService.inviteCoach({
        teamId: teamId,
        email: inviteEmail,
        role: inviteRole
      });

      if (result.success) {
        setInviteMessage({ type: 'success', text: result.message });
        setInviteEmail('');
        await fetchData(); // Refresh members list
      } else {
        setInviteMessage({ type: 'error', text: result.message });
      }
    } catch (error: any) {
      setInviteMessage({ type: 'error', text: error.message || 'Failed to invite coach' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this team member? They will lose access to the team.')) return;

    try {
      await membershipService.removeCoach(teamId, userId);
      await fetchData(); // Refresh members list
    } catch (error: any) {
      alert(error.message || 'Failed to remove member');
    }
  };

  // Handle coach request for trial users
  const handleRequestCoaches = async () => {
    setRequestingCoaches(true);
    setCoachRequestMessage(null);

    try {
      const response = await fetch('/api/coach-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          reason: 'Requesting ability to add coaches during trial period'
        })
      });

      const result = await response.json();

      if (response.ok) {
        setCoachRequestMessage({
          type: 'success',
          text: 'Request submitted! An admin will review your request and get back to you.'
        });
      } else {
        setCoachRequestMessage({
          type: 'error',
          text: result.error || 'Failed to submit request'
        });
      }
    } catch (error) {
      setCoachRequestMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.'
      });
    } finally {
      setRequestingCoaches(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'coach' | 'analyst' | 'viewer') => {
    try {
      await membershipService.updateRole(teamId, userId, newRole);
      await fetchData(); // Refresh members list
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    }
  };

  // Fetch content summary for cancel modal
  const fetchContentSummary = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setContentSummary(data.content_summary);
      }
    } catch (error) {
      console.error('Error fetching content summary:', error);
    }
  };

  // Open cancel modal
  const handleOpenCancelModal = async () => {
    await fetchContentSummary();
    setShowCancelModal(true);
  };

  // Handle subscription cancellation
  const handleCancelSubscription = async (reason: string, details: string) => {
    setCancellingSubscription(true);

    try {
      const response = await fetch(`/api/teams/${teamId}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reason_details: details })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Close modal and refresh page to show updated status
      setShowCancelModal(false);
      window.location.reload();
    } catch (error: any) {
      throw error;
    } finally {
      setCancellingSubscription(false);
    }
  };

  // Handle subscription reactivation
  const handleReactivateSubscription = async () => {
    setReactivatingSubscription(true);
    setTierSaveMessage(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/subscription/reactivate`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate subscription');
      }

      setTierSaveMessage(data.message || 'Subscription reactivated successfully!');
      // Refresh page to show updated status
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      setTierSaveMessage(error.message || 'Failed to reactivate subscription');
    } finally {
      setReactivatingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  if (!team || !config) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Settings not available</div>
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

  const tierInfo = {
    basic: {
      name: 'Basic',
      description: 'Basic play tracking for youth teams',
      features: ['Basic play tagging', 'Win/loss tracking', 'Simple play counts']
    },
    plus: {
      name: 'Plus',
      description: 'Essential analytics for high school teams',
      features: ['Drive analytics (PPD, 3-and-outs)', 'Player attribution (QB/RB/WR)', 'Down/distance splits', 'Success rate metrics']
    },
    premium: {
      name: 'Premium',
      description: 'Comprehensive analytics for competitive programs',
      features: ['All Plus features', 'Offensive line tracking', 'Defensive player stats', 'Situational splits (motion, PA, blitz)', 'Havoc rate']
    },
    ai_powered: {
      name: 'AI-Powered (Coming Soon)',
      description: 'Automated film tagging and advanced insights',
      features: ['All Premium features', 'AI auto-tagging', 'Predictive analytics', 'Opponent scouting reports']
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-black text-white';
      case 'coach': return 'bg-gray-700 text-white';
      case 'analyst': return 'bg-gray-500 text-white';
      case 'viewer': return 'bg-gray-300 text-gray-700';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  const getWinLossRecord = () => {
    const wins = games.filter(g => g.game_result === 'win').length;
    const losses = games.filter(g => g.game_result === 'loss').length;
    const ties = games.filter(g => g.game_result === 'tie').length;
    return { wins, losses, ties };
  };

  const record = getWinLossRecord();
  const winPercentage = record.wins + record.losses > 0
    ? ((record.wins / (record.wins + record.losses)) * 100).toFixed(0)
    : '0';

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Tabs */}
      <TeamNavigation
        team={team}
        teamId={teamId}
        currentPage="settings"
        wins={record.wins}
        losses={record.losses}
        ties={record.ties}
      />

      {/* Quick Stats Banner */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Team Settings</h2>
            <div className="flex gap-8">
              <button
                onClick={() => setSettingsTab('tier')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'tier'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Analytics Tier
                {settingsTab === 'tier' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('members')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'members'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Team Members
                {settingsTab === 'members' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('ai_credits')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                  settingsTab === 'ai_credits'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                AI Credits
                {settingsTab === 'ai_credits' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('onboarding')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'onboarding'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Onboarding
                {settingsTab === 'onboarding' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {settingsTab === 'tier' && (
          <div>
            {/* Subscription Error */}
            {subscriptionError && (
              <div className="mb-8 p-4 rounded-lg border bg-red-50 border-red-200">
                <p className="text-red-800">
                  Error loading subscription: {subscriptionError}
                </p>
              </div>
            )}

            {/* Subscription Status Banner */}
            {!subscriptionLoading && !subscriptionError && (
              <div className={`mb-8 p-4 rounded-lg border ${
                showPaymentWarning
                  ? 'bg-yellow-50 border-yellow-200'
                  : showUpgradePrompt
                  ? 'bg-blue-50 border-blue-200'
                  : subscription?.billing_waived
                  ? 'bg-green-50 border-green-200'
                  : isTrialing
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        showPaymentWarning
                          ? 'bg-yellow-100 text-yellow-800'
                          : showUpgradePrompt
                          ? 'bg-blue-100 text-blue-800'
                          : subscription?.billing_waived
                          ? 'bg-green-100 text-green-800'
                          : isTrialing
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {statusMessage}
                      </span>
                      {isTrialing && trialDaysRemaining !== null && (
                        <span className="text-sm text-purple-600">
                          {trialDaysRemaining} days remaining
                        </span>
                      )}
                    </div>
                    {subscriptionTier && (
                      <p className="mt-2 text-sm text-gray-600">
                        Current plan: <strong>{tierDisplayName}</strong>
                        {subscription?.current_period_end && subscriptionStatus === 'active' && (
                          <span className="ml-2 text-gray-500">
                            (renews {new Date(subscription.current_period_end).toLocaleDateString()})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {(subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due') && (
                    <button
                      onClick={handleManageBilling}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Manage Billing
                    </button>
                  )}
                </div>
                {showPaymentWarning && (
                  <div className="mt-3 text-sm text-yellow-700">
                    Your payment is past due. Please update your payment method to continue using all features.
                    <button
                      onClick={handleManageBilling}
                      className="ml-2 underline hover:text-yellow-800"
                    >
                      Update now
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {showUpgradePrompt ? 'Subscribe to Unlock Analytics' : 'Your Analytics Tier'}
              </h2>
              <p className="text-gray-600">
                {showUpgradePrompt
                  ? 'Choose a plan to unlock advanced analytics features for your team.'
                  : 'Your subscription determines which analytics features are available.'}
              </p>
              {tierSaveMessage && (
                <div className={`mt-4 p-4 rounded-lg text-sm ${
                  tierSaveMessage.includes('successfully') || tierSaveMessage.includes('updated')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {tierSaveMessage}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {(Object.keys(tierInfo) as AnalyticsTier[]).map((tier) => {
                const info = tierInfo[tier];
                const tierAsSubscription = tier as SubscriptionTier;
                const isCurrentTier = subscriptionTier === tierAsSubscription;
                const isDisabled = tier === 'ai_powered'; // Not yet available
                const canUpgrade = subscriptionTier && isUpgrade(subscriptionTier, tierAsSubscription);
                const canDowngrade = subscriptionTier && !isUpgrade(subscriptionTier, tierAsSubscription) && !isCurrentTier;
                const needsSubscription = showUpgradePrompt && !isDisabled;

                return (
                  <div
                    key={tier}
                    className={`border-2 rounded-lg p-6 transition-all ${
                      isCurrentTier
                        ? 'border-gray-900 bg-gray-50'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                          {isCurrentTier && (
                            <span className="px-2 py-1 text-xs font-medium bg-black text-white rounded">
                              Current Plan
                            </span>
                          )}
                          {isDisabled && (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-300 text-gray-600 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-4">{info.description}</p>
                        <ul className="space-y-2">
                          {info.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="ml-4 flex flex-col items-end gap-2">
                        {isCurrentTier && (
                          <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        )}

                        {/* Subscribe button for users without subscription */}
                        {needsSubscription && (
                          <button
                            onClick={() => handleUpgrade(tierAsSubscription)}
                            disabled={creatingCheckout}
                            className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                          >
                            {creatingCheckout ? 'Loading...' : 'Subscribe'}
                          </button>
                        )}

                        {/* Upgrade button for existing subscribers */}
                        {canUpgrade && !isDisabled && (
                          <button
                            onClick={() => handleChangeTier(tierAsSubscription)}
                            disabled={creatingCheckout}
                            className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                          >
                            {creatingCheckout ? 'Loading...' : 'Upgrade'}
                          </button>
                        )}

                        {/* Downgrade button for existing subscribers */}
                        {canDowngrade && !isDisabled && (
                          <button
                            onClick={() => handleChangeTier(tierAsSubscription)}
                            disabled={creatingCheckout}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            {creatingCheckout ? 'Loading...' : 'Downgrade'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Billing waived info */}
            {subscription?.billing_waived && subscription.billing_waived_reason && (
              <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Billing waived:</strong> {subscription.billing_waived_reason}
                </p>
              </div>
            )}

            {/* Pending Cancellation Banner */}
            {subscription?.cancel_at_period_end && (
              <div className="mt-8 border border-amber-200 bg-amber-50 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-900 mb-2">
                      Subscription Ending Soon
                    </h3>
                    <p className="text-sm text-amber-700 mb-4">
                      Your subscription will end on{' '}
                      <strong>
                        {subscription.current_period_end
                          ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'the end of your billing period'}
                      </strong>.
                      After this date, you'll have 30 days to resubscribe and keep access to your data.
                    </p>
                    <button
                      onClick={handleReactivateSubscription}
                      disabled={reactivatingSubscription}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-400 transition-colors font-medium"
                    >
                      {reactivatingSubscription ? 'Reactivating...' : 'Keep My Subscription'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cancel Subscription Section - Only for active subscribers who haven't already canceled */}
            {userRole === 'owner' &&
             (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') &&
             !subscription?.cancel_at_period_end &&
             !subscription?.billing_waived && (
              <div className="mt-8 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cancel Subscription
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  If you need to cancel, you'll have access until the end of your current billing period
                  {subscription?.current_period_end && (
                    <span>
                      {' '}({new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })})
                    </span>
                  )}. After that, you'll have 30 days to resubscribe and regain full access to your data.
                </p>
                <button
                  onClick={handleOpenCancelModal}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        )}

        {settingsTab === 'members' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Team Members</h2>
              <p className="text-gray-600">
                Invite coaches and analysts to collaborate on your team.
              </p>
            </div>

            {/* Trial Restriction Banner */}
            {isTrialing && (userRole === 'owner' || userRole === 'coach') && (
              <div className="border border-purple-200 bg-purple-50 rounded-lg p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-purple-900 mb-2">Trial Account Restriction</h3>
                    <p className="text-sm text-purple-700 mb-4">
                      Adding additional coaches is not available during the trial period. If you need to add coaches to evaluate the platform with your team, you can request access from our admin team.
                    </p>
                    {coachRequestMessage && (
                      <div className={`p-3 rounded-lg text-sm mb-4 ${
                        coachRequestMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {coachRequestMessage.text}
                      </div>
                    )}
                    {!coachRequestMessage?.type || coachRequestMessage.type !== 'success' ? (
                      <button
                        onClick={handleRequestCoaches}
                        disabled={requestingCoaches}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors text-sm font-medium"
                      >
                        {requestingCoaches ? 'Requesting...' : 'Request Coach Access'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Invite Form - Only show for non-trial users */}
            {(userRole === 'owner' || userRole === 'coach') && !isTrialing ? (
              <div className="border border-gray-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
                <form onSubmit={handleInviteCoach} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="coach@example.com"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'coach' | 'analyst' | 'viewer')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <option value="coach">Coach</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>

                  {inviteMessage && (
                    <div
                      className={`p-4 rounded-lg text-sm ${
                        inviteMessage.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {inviteMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                  >
                    {inviting ? 'Inviting...' : 'Send Invite'}
                  </button>
                </form>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Role Permissions:</strong>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    <li><strong>Coach:</strong> Create/edit plays, tag film, manage games</li>
                    <li><strong>Analyst:</strong> Tag film, view analytics (cannot edit plays)</li>
                    <li><strong>Viewer:</strong> View-only access to all team data</li>
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Members List */}
            <div className="space-y-3">
              {members.map((member) => {
                const canManage = userRole === 'owner' && member.user.id !== supabase.auth.getUser().then(r => r.data.user?.id);

                return (
                  <div
                    key={member.membership.id}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-base font-medium text-gray-900">
                          {member.user.full_name || member.user.email}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(member.membership.role)}`}>
                          {member.membership.role}
                        </span>
                      </div>
                      {member.user.full_name && (
                        <div className="text-sm text-gray-500 mt-1">{member.user.email}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        Joined {new Date(member.membership.joined_at).toLocaleDateString()}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.membership.role}
                          onChange={(e) => handleUpdateRole(member.user.id, e.target.value as any)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                          <option value="owner">Owner</option>
                          <option value="coach">Coach</option>
                          <option value="analyst">Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.user.id)}
                          className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {members.length === 0 && (
              <div className="text-center py-16 bg-gray-50 rounded-lg">
                <div className="text-gray-400 mb-4">No team members yet</div>
                <p className="text-sm text-gray-500">Invite coaches to collaborate on this team</p>
              </div>
            )}
          </div>
        )}

        {settingsTab === 'ai_credits' && (
          <AICreditsUsage teamId={teamId} isOwner={userRole === 'owner'} />
        )}

        {settingsTab === 'onboarding' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Onboarding Settings</h2>
              <p className="text-gray-600">
                Manage the onboarding tour and getting started checklist.
              </p>
            </div>

            {/* Onboarding State */}
            <div className="space-y-6">
              {/* Tour Status */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Onboarding Tour</h3>
                    <p className="text-sm text-gray-600">
                      {onboarding?.state.tourCompleted
                        ? 'Tour completed'
                        : onboarding?.state.tourSkipped
                        ? 'Tour skipped'
                        : 'Tour not started'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onboarding?.startTour()}
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Watch Tour
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist Status */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Getting Started Checklist</h3>
                    <p className="text-sm text-gray-600">
                      {onboarding?.state.checklistDismissed
                        ? 'Checklist dismissed'
                        : onboarding?.state.completionCount === onboarding?.state.totalItems
                        ? 'All tasks complete!'
                        : `${onboarding?.state.completionCount || 0} of ${onboarding?.state.totalItems || 4} tasks complete`}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm">
                      <li className={onboarding?.state.completedItems.hasPlayers ? 'text-green-600' : 'text-gray-500'}>
                        {onboarding?.state.completedItems.hasPlayers ? '✓' : '○'} Add your first player
                      </li>
                      <li className={onboarding?.state.completedItems.hasGames ? 'text-green-600' : 'text-gray-500'}>
                        {onboarding?.state.completedItems.hasGames ? '✓' : '○'} Schedule a game
                      </li>
                      <li className={onboarding?.state.completedItems.hasPlays ? 'text-green-600' : 'text-gray-500'}>
                        {onboarding?.state.completedItems.hasPlays ? '✓' : '○'} Create your first play
                      </li>
                      <li className={onboarding?.state.completedItems.hasVideos ? 'text-green-600' : 'text-gray-500'}>
                        {onboarding?.state.completedItems.hasVideos ? '✓' : '○'} Upload game film
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {onboarding?.state.checklistDismissed && (
                      <button
                        onClick={() => onboarding?.resetChecklist()}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Show Checklist
                      </button>
                    )}
                    {!onboarding?.state.checklistDismissed && onboarding?.state.completionCount !== onboarding?.state.totalItems && (
                      <button
                        onClick={() => onboarding?.toggleChecklist()}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {onboarding?.showChecklist ? 'Hide Checklist' : 'Show Checklist'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSubscription}
        subscriptionEndsAt={subscription?.current_period_end || null}
        contentSummary={contentSummary}
        teamName={team?.name || 'Your Team'}
      />
    </div>
  );
}
