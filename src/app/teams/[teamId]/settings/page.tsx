// src/app/teams/[teamId]/settings/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { TeamMembershipService } from '@/lib/services/team-membership.service';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics.service';
import type { Team, TeamMembership, TeamAnalyticsConfig, AnalyticsTier } from '@/types/football';
import TeamNavigation from '@/components/TeamNavigation';

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
  const [settingsTab, setSettingsTab] = useState<'tier' | 'members'>('tier');
  const [savingTier, setSavingTier] = useState(false);
  const [tierSaveMessage, setTierSaveMessage] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'coach' | 'analyst' | 'viewer'>('coach');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        enable_drive_analytics: ['hs_basic', 'hs_advanced', 'ai_powered'].includes(newTier),
        enable_player_attribution: ['hs_basic', 'hs_advanced', 'ai_powered'].includes(newTier),
        enable_ol_tracking: ['hs_advanced', 'ai_powered'].includes(newTier),
        enable_defensive_tracking: ['hs_advanced', 'ai_powered'].includes(newTier),
        enable_situational_splits: ['hs_advanced', 'ai_powered'].includes(newTier),
        default_tagging_mode: newTier === 'little_league' ? 'quick' :
                             newTier === 'hs_basic' ? 'standard' : 'advanced'
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

  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'coach' | 'analyst' | 'viewer') => {
    try {
      await membershipService.updateRole(teamId, userId, newRole);
      await fetchData(); // Refresh members list
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
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
    little_league: {
      name: 'Little League',
      description: 'Basic play tracking for youth teams',
      features: ['Basic play tagging', 'Win/loss tracking', 'Simple play counts']
    },
    hs_basic: {
      name: 'High School - Basic',
      description: 'Essential analytics for high school teams',
      features: ['Drive analytics (PPD, 3-and-outs)', 'Player attribution (QB/RB/WR)', 'Down/distance splits', 'Success rate metrics']
    },
    hs_advanced: {
      name: 'High School - Advanced',
      description: 'Comprehensive analytics for competitive programs',
      features: ['All Basic features', 'Offensive line tracking', 'Defensive player stats', 'Situational splits (motion, PA, blitz)', 'Havoc rate']
    },
    ai_powered: {
      name: 'AI-Powered (Coming Soon)',
      description: 'Automated film tagging and advanced insights',
      features: ['All Advanced features', 'AI auto-tagging', 'Predictive analytics', 'Opponent scouting reports']
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
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {settingsTab === 'tier' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Choose Your Analytics Tier</h2>
              <p className="text-gray-600">
                Select the level of analytics that matches your team's needs. You can change this anytime.
              </p>
              {tierSaveMessage && (
                <div className={`mt-4 p-4 rounded-lg text-sm ${
                  tierSaveMessage.includes('successfully')
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
                const isSelected = config.tier === tier;
                const isDisabled = tier === 'ai_powered'; // Not yet available

                return (
                  <div
                    key={tier}
                    className={`border-2 rounded-lg p-6 transition-all ${
                      isSelected
                        ? 'border-gray-900 bg-gray-50'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : savingTier
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && !isSelected && !savingTier && handleTierUpdate(tier)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                          {isSelected && (
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

                      {isSelected && (
                        <div className="ml-4">
                          <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

            {/* Invite Form */}
            {userRole === 'owner' || userRole === 'coach' ? (
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
      </div>
    </div>
  );
}
