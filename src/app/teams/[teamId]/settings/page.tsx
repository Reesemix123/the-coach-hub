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
import TokenBalanceCard from '@/components/TokenBalanceCard';

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
  const [userRole, setUserRole] = useState<'owner' | 'coach' | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'team' | 'members' | 'usage_tokens' | 'onboarding'>('team');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF');
  const [savingColors, setSavingColors] = useState(false);
  const onboarding = useGlobalOnboardingSafe();

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

      // Initialize colors from team data
      if (teamData.colors?.primary) {
        setPrimaryColor(teamData.colors.primary.startsWith('#') ? teamData.colors.primary : '#000000');
      }
      if (teamData.colors?.secondary) {
        setSecondaryColor(teamData.colors.secondary.startsWith('#') ? teamData.colors.secondary : '#FFFFFF');
      }

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

  // Note: Team member management (invite, remove, update role) is now done from the Console
  // The settings page is now read-only for members - showing informational view only

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
      alert('Error saving team colors');
    } finally {
      setSavingColors(false);
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

      {/* Quick Stats Banner */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Team Settings</h2>
            <div className="flex gap-8">
              <button
                onClick={() => setSettingsTab('team')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                  settingsTab === 'team'
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Team Info
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
                Team Members
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
                Usage & Tokens
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
        {settingsTab === 'team' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Team Information</h2>
              <p className="text-gray-600">
                Customize your team's appearance.
              </p>
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
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Team Members</h2>
              <p className="text-gray-600">
                View team members and their roles.
              </p>
            </div>

            {/* Team Owner Card */}
            {(() => {
              const owner = members.find(m => m.membership.role === 'owner');
              return (
                <div className="border border-gray-200 bg-gray-50 rounded-lg p-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-lg font-semibold">
                        {owner?.user.full_name?.charAt(0)?.toUpperCase() || owner?.user.email?.charAt(0)?.toUpperCase() || 'O'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {owner?.user.full_name || owner?.user.email || 'Team Owner'}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-black text-white rounded">
                          Owner
                        </span>
                      </div>
                      {owner?.user.full_name && (
                        <p className="text-sm text-gray-500 mb-3">{owner.user.email}</p>
                      )}

                      {userRole === 'owner' ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            You are the owner of this team. Manage coaches and billing from your{' '}
                            <a
                              href={`/console/teams/${teamId}`}
                              className="font-medium underline hover:text-blue-900"
                            >
                              Console
                            </a>.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-700">
                            Contact {owner?.user.full_name || 'the team owner'} to add new coaches or manage billing.
                            Coaches are managed through the owner's Console.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Role Permissions Info */}
            <div className="border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Permissions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-black text-white rounded">Owner</span>
                  </div>
                  <p className="text-sm text-gray-600">Full control - manage team, billing, and coaches</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-white rounded">Coach</span>
                  </div>
                  <p className="text-sm text-gray-600">Create/edit plays, tag film, manage games and roster</p>
                </div>
              </div>
            </div>

            {/* Current Members List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Members ({members.length})</h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.membership.id}
                    className="border border-gray-200 rounded-lg p-4 flex items-center"
                  >
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                        {member.user.full_name?.charAt(0)?.toUpperCase() || member.user.email?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    </div>
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
                  </div>
                ))}
              </div>
            </div>

            {members.length === 0 && (
              <div className="text-center py-16 bg-gray-50 rounded-lg">
                <div className="text-gray-400 mb-4">No team members yet</div>
                <p className="text-sm text-gray-500">The team owner can add coaches from the Console</p>
              </div>
            )}
          </div>
        )}

        {settingsTab === 'usage_tokens' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Usage & Tokens</h2>
              <p className="text-gray-600">
                Track your game upload tokens and manage your usage.
              </p>
            </div>

            {/* Token Balance Card */}
            <div className="max-w-md">
              <TokenBalanceCard teamId={teamId} variant="full" />
            </div>

            {/* How Tokens Work */}
            <div className="mt-8 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How Tokens Work</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  <strong>Upload tokens</strong> are used when you create a new game in the Film section.
                  Each game you create uses one token, whether it's for your own team's film or opponent scouting film.
                </p>
                <p>
                  Your tokens refresh at the start of each billing period. Unused tokens can roll over
                  up to a cap based on your plan.
                </p>
                <p>
                  Need more tokens? You can purchase additional token packs from the{' '}
                  <a href={`/teams/${teamId}/settings/addons`} className="text-gray-900 underline hover:no-underline">
                    Add-ons page
                  </a>.
                </p>
              </div>
            </div>
          </div>
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
