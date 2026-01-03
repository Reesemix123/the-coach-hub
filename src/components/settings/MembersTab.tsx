'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TeamMembershipService, TeamMemberWithUser, InviteCoachResult, PendingInvite } from '@/lib/services/team-membership.service';
import { UserPlus, Trash2, Users, Mail, Calendar, Shield, Loader2, X, AlertCircle, Copy, Check, Clock, RefreshCw } from 'lucide-react';

interface MembersTabProps {
  teamId: string;
  isOwner: boolean;
  onNavigateToSubscription?: () => void;
}

interface TeamOwner {
  id: string;
  email: string;
  full_name?: string;
}

export default function MembersTab({ teamId, isOwner, onNavigateToSubscription }: MembersTabProps) {
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [owner, setOwner] = useState<TeamOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteCoachResult | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  const membershipService = new TeamMembershipService();

  useEffect(() => {
    fetchMembers();
  }, [teamId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch all data in parallel for faster loading
      const [teamResult, teamMembersResult, pendingInvitesResult] = await Promise.all([
        supabase.from('teams').select('user_id').eq('id', teamId).single(),
        membershipService.getTeamMembers(teamId).catch(() => []),
        membershipService.getPendingInvites(teamId).catch(() => []),
      ]);

      // Set team members and pending invites immediately
      setMembers(teamMembersResult);
      setPendingInvites(pendingInvitesResult);

      // Get owner profile (needs team.user_id first, but this is fast)
      if (teamResult.data?.user_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('id', teamResult.data.user_id)
          .single();

        if (ownerProfile) {
          setOwner({
            id: ownerProfile.id,
            email: ownerProfile.email || 'Unknown',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Cancel this invitation?')) return;

    setCancellingInviteId(inviteId);
    try {
      await membershipService.cancelInvite(inviteId);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (error: any) {
      alert(error.message || 'Failed to cancel invite');
    } finally {
      setCancellingInviteId(null);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setResendingInviteId(inviteId);
    try {
      const result = await membershipService.resendInvite(inviteId);
      // Update the pending invite with new token
      setPendingInvites(prev => prev.map(i =>
        i.id === inviteId ? { ...i, token: result.token } : i
      ));
      // Copy the new link
      await navigator.clipboard.writeText(result.inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error: any) {
      alert(error.message || 'Failed to resend invite');
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError(null);
    setInviteResult(null);

    try {
      // Use the API endpoint which sends emails
      const response = await fetch(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: 'coach',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite coach');
      }

      // Map API response to InviteCoachResult format
      const inviteResult: InviteCoachResult = {
        success: result.success,
        message: result.message,
        inviteLink: result.inviteLink,
        inviteToken: result.inviteToken,
      };

      setInviteResult(inviteResult);

      if (result.success) {
        setInviteEmail('');
        await fetchMembers();
        // Only auto-close if it was an immediate add (user already existed)
        if (result.addedImmediately) {
          setTimeout(() => {
            setShowInviteModal(false);
            setInviteResult(null);
          }, 2000);
        }
        // If there's an invite link, keep modal open so user can see the result
      }
    } catch (error: any) {
      setInviteError(error.message || 'Failed to invite coach');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    setRemovingUserId(userId);

    try {
      const response = await fetch(`/api/console/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchMembers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-black text-white';
      case 'coach':
        return 'bg-gray-700 text-white';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg"></div>
        <div className="h-24 bg-gray-100 rounded-lg"></div>
        <div className="h-24 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  // Filter out owner from members list if they appear there
  const nonOwnerMembers = members.filter(m => m.user.id !== owner?.id);

  return (
    <div className="space-y-8">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Team Members</h2>
          <p className="text-gray-600 mt-1">
            Manage who has access to your team
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Coach
          </button>
        )}
      </div>

      {/* Team Owner Card */}
      {owner && (
        <div className="border border-gray-200 bg-gray-50 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-semibold">
                {owner.full_name?.charAt(0)?.toUpperCase() || owner.email?.charAt(0)?.toUpperCase() || 'O'}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {owner.full_name || owner.email}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-black text-white rounded">
                  Owner
                </span>
              </div>
              {owner.full_name && (
                <p className="text-sm text-gray-500">{owner.email}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Full control - manage team, billing, and coaches
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Role Permissions Info */}
      <div className="border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-gray-700" />
              <span className="px-2 py-0.5 text-xs font-medium bg-black text-white rounded">Owner</span>
            </div>
            <p className="text-sm text-gray-600">Full control - manage team, billing, coaches, and all content</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-gray-700" />
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-white rounded">Coach</span>
            </div>
            <p className="text-sm text-gray-600">Create/edit plays, tag film, manage games and roster</p>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Team Members ({nonOwnerMembers.length + 1})
        </h3>

        {nonOwnerMembers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No coaches yet</h4>
            <p className="text-gray-500 mb-4">
              {isOwner
                ? 'Invite coaches to help manage your team'
                : 'The team owner can invite coaches'}
            </p>
            {isOwner && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                <UserPlus className="h-4 w-4" />
                Invite Your First Coach
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {nonOwnerMembers.map((member) => (
              <div
                key={member.membership.id}
                className="border border-gray-200 rounded-lg p-4 flex items-center hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 mr-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                    {member.user.full_name?.charAt(0)?.toUpperCase() ||
                      member.user.email?.charAt(0)?.toUpperCase() ||
                      '?'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-gray-900 truncate">
                      {member.user.full_name || member.user.email}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getRoleBadgeColor(
                        member.membership.role
                      )}`}
                    >
                      {member.membership.role}
                    </span>
                  </div>
                  {member.user.full_name && (
                    <p className="text-sm text-gray-500 truncate">{member.user.email}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Joined {new Date(member.membership.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {isOwner && member.membership.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(member.user.id)}
                    disabled={removingUserId === member.user.id}
                    className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove from team"
                  >
                    {removingUserId === member.user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {isOwner && pendingInvites.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-900">Pending Invitations ({pendingInvites.length})</h3>
          </div>

          <div className="space-y-3">
            {pendingInvites.map((invite) => {
              const inviteLink = `${window.location.origin}/auth/signup?invite=${invite.token}`;
              const expiresAt = new Date(invite.expires_at);
              const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={invite.id}
                  className="bg-white border border-amber-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-gray-900">{invite.email}</span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                        {invite.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(inviteLink)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="Copy invite link"
                      >
                        {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={resendingInviteId === invite.id}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                        title="Resend invite (extends expiry)"
                      >
                        {resendingInviteId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={cancellingInviteId === invite.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Cancel invite"
                      >
                        {cancellingInviteId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600">
                    Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} • Sent {new Date(invite.invited_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info for non-owners */}
      {!isOwner && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900">Need to add coaches?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Contact the team owner to invite additional coaches to the team.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Invite Coach</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteError(null);
                  setInviteResult(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="coach@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                    disabled={inviting}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  If they already have an account, they'll be added immediately. Otherwise, an invitation email will be sent to them.
                </p>
              </div>

              {/* Error Message */}
              {inviteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{inviteError}</p>
                </div>
              )}

              {/* Result Message */}
              {inviteResult && (
                <div
                  className={`mb-4 p-3 rounded-lg ${
                    inviteResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {inviteResult.success ? (
                      <Check className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-500" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm ${
                          inviteResult.success ? 'text-green-700' : 'text-amber-700'
                        }`}
                      >
                        {inviteResult.message}
                      </p>
                      {inviteResult.buttonUrl && inviteResult.buttonText && (
                        <a
                          href={inviteResult.buttonUrl}
                          className="inline-block mt-2 text-sm font-medium text-amber-800 underline hover:no-underline"
                        >
                          {inviteResult.buttonText}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Invite Link with Copy Button */}
                  {inviteResult.inviteLink && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-green-600 mb-2">Share this link with the coach:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteResult.inviteLink}
                          className="flex-1 text-xs px-3 py-2 bg-white border border-green-300 rounded-lg text-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inviteResult.inviteLink!)}
                          className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          {copiedLink ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-green-500 mt-2">
                        This link expires in 7 days. They'll create an account and automatically join your team.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteError(null);
                    setInviteResult(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
