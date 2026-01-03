// src/app/teams/[teamId]/settings/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { Team, TeamMembership, TeamAnalyticsConfig } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';
import { Play, RefreshCw } from 'lucide-react';
import { useGlobalOnboardingSafe } from '@/components/onboarding/GlobalOnboardingProvider';
import SubscriptionBanner from '@/components/settings/SubscriptionBanner';
import SubscriptionTab from '@/components/settings/SubscriptionTab';
import MembersTab from '@/components/settings/MembersTab';
import UsageTab from '@/components/settings/UsageTab';

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

// Shared data from /api/console/teams/${teamId} - fetched once and passed to child components
interface TeamDetailData {
  team: {
    id: string;
    name: string;
    level: string;
    created_at: string;
  };
  subscription: {
    tier: string;
    tier_display_name: string;
    status: string;
    billing_waived: boolean;
    billing_waived_reason: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    trial_days_remaining: number | null;
    monthly_cost_cents: number;
  };
  upload_tokens: {
    available: number;
    used_this_period: number;
    allocation: number;
  };
  usage: {
    games_count: number;
    plays_count: number;
    players_count: number;
    members_count: number;
  };
}

export default function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [config, setConfig] = useState<TeamAnalyticsConfig | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'coach' | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamDetailData, setTeamDetailData] = useState<TeamDetailData | null>(null);
  const [settingsTab, setSettingsTab] = useState<'billing' | 'team' | 'members' | 'usage_tokens' | 'onboarding'>('billing');
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF');
  const [savingColors, setSavingColors] = useState(false);
  const [teamLevel, setTeamLevel] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);
  const onboarding = useGlobalOnboardingSafe();

  const router = useRouter();
  const supabase = createClient();
  const membershipService = new TeamMembershipService();
  const analyticsService = new AdvancedAnalyticsService();

  useEffect(() => {
    fetchData();
  }, [teamId]);

  // Reset showChangePlanModal after it's been used
  useEffect(() => {
    if (showChangePlanModal) {
      // Reset after a short delay so the modal has time to open
      const timer = setTimeout(() => setShowChangePlanModal(false), 100);
      return () => clearTimeout(timer);
    }
  }, [showChangePlanModal]);

  const fetchData = async () => {
    try {
      // Fetch ALL data in parallel for fastest load
      const [teamResult, analyticsConfig, role, teamDetailResponse, gamesResult, teamMembers] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        analyticsService.getTeamTier(teamId),
        membershipService.getUserRole(teamId),
        fetch(`/api/console/teams/${teamId}`).then(r => r.ok ? r.json() : null),
        supabase.from('games').select('id, game_result').eq('team_id', teamId),
        membershipService.getTeamMembers(teamId),
      ]);

      if (teamResult.error) throw teamResult.error;
      const teamData = teamResult.data;

      // Only owners and coaches can view settings - check early
      if (!role || !['owner', 'coach'].includes(role)) {
        router.push(`/teams/${teamId}`);
        return;
      }

      // Set all state at once
      setTeam(teamData);
      setConfig(analyticsConfig);
      setUserRole(role);
      setGames(gamesResult.data || []);
      setMembers(teamMembers);
      if (teamDetailResponse) {
        setTeamDetailData(teamDetailResponse);
      }

      // Initialize colors and level from team data
      if (teamData.colors?.primary) {
        setPrimaryColor(teamData.colors.primary.startsWith('#') ? teamData.colors.primary : '#000000');
      }
      if (teamData.colors?.secondary) {
        setSecondaryColor(teamData.colors.secondary.startsWith('#') ? teamData.colors.secondary : '#FFFFFF');
      }
      if (teamData.level) {
        setTeamLevel(teamData.level);
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Team member management will be handled directly in the Members tab (Phase 3)

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

  const handleSaveColors = async () => {
    setSavingColors(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          colors: {
            primary: primaryColor,
            secondary: secondaryColor
          }
        })
        .eq('id', teamId);

      if (error) throw error;

      // Update local team state
      if (team) {
        setTeam({
          ...team,
          colors: { primary: primaryColor, secondary: secondaryColor }
        });
      }

      alert('Team colors saved!');
    } catch (error) {
      console.error('Error saving colors:', error);
      alert('Failed to save colors');
    } finally {
      setSavingColors(false);
    }
  };

  const handleSaveLevel = async () => {
    if (!teamLevel) return;
    setSavingLevel(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({ level: teamLevel })
        .eq('id', teamId);

      if (error) throw error;

      // Update local team state
      if (team) {
        setTeam({ ...team, level: teamLevel });
      }

      alert('Team level saved!');
    } catch (error) {
      console.error('Error saving level:', error);
      alert('Failed to save team level');
    } finally {
      setSavingLevel(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-black text-white';
      case 'coach': return 'bg-gray-700 text-white';
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

      {/* Subscription Banner */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <SubscriptionBanner
          teamId={teamId}
          isOwner={userRole === 'owner'}
          onManagePlan={() => {
            setSettingsTab('billing');
            setShowChangePlanModal(true);
          }}
          initialData={teamDetailData?.subscription}
        />
      </div>

      {/* Settings Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
            <div className="flex gap-6">
              <button
                onClick={() => setSettingsTab('billing')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'billing'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Billing and Subscription
                {settingsTab === 'billing' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('team')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'team'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Team
                {settingsTab === 'team' && (
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
                Members
                {settingsTab === 'members' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('usage_tokens')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'usage_tokens'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Usage
                {settingsTab === 'usage_tokens' && (
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
        {settingsTab === 'billing' && (
          <SubscriptionTab
            teamId={teamId}
            isOwner={userRole === 'owner'}
            initialData={teamDetailData}
            showChangePlanOnMount={showChangePlanModal}
          />
        )}

        {settingsTab === 'team' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Team Information</h2>
              <p className="text-gray-600">
                Update your team's details and appearance.
              </p>
            </div>

            {/* Team Details */}
            <div className="border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Team Name (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={team?.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Contact support to change team name</p>
                </div>

                {/* Team Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age / Level
                  </label>
                  <select
                    value={teamLevel}
                    onChange={(e) => setTeamLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select level...</option>
                    <option value="Youth">Youth</option>
                    <option value="JV">JV</option>
                    <option value="Varsity">Varsity</option>
                    <option value="College">College</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">The competition level of your team</p>
                </div>
              </div>

              <button
                onClick={handleSaveLevel}
                disabled={savingLevel || !teamLevel}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 font-medium"
              >
                {savingLevel ? 'Saving...' : 'Save Details'}
              </button>
            </div>

            {/* Team Colors */}
            <div className="border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Colors</h3>
              <p className="text-sm text-gray-600 mb-6">
                Set your team's colors. The primary color is used for the team icon throughout the app.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Primary Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 uppercase"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used for your team icon</p>
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 uppercase"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Secondary accent color</p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-lg"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{team.name}</h4>
                    <p className="text-sm text-gray-600">{team.level}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveColors}
                disabled={savingColors}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 font-medium"
              >
                {savingColors ? 'Saving...' : 'Save Colors'}
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'members' && (
          <MembersTab
            teamId={teamId}
            isOwner={userRole === 'owner'}
            onNavigateToSubscription={() => setSettingsTab('billing')}
          />
        )}

        {settingsTab === 'usage_tokens' && (
          <UsageTab teamId={teamId} isOwner={userRole === 'owner'} />
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
    </div>
  );
}
