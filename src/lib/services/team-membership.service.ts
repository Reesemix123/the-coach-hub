// src/lib/services/team-membership.service.ts
// Multi-coach collaboration service
// Manages team invitations, memberships, and role-based access

import { createClient } from '@/utils/supabase/client';
import type { TeamMembership } from '@/types/football';
import { getEffectiveLimitsClient, getLimitReachedResponseClient } from './addon-pricing.client';

export interface TeamMemberWithUser {
  membership: TeamMembership;
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface TeamWithMembership {
  team: {
    id: string;
    name: string;
    level: string;
  };
  membership: TeamMembership;
}

export interface InviteCoachParams {
  teamId: string;
  email: string;
  role: 'owner' | 'coach';
}

export interface InviteCoachResult {
  success: boolean;
  message: string;
  action?: 'purchase_addon' | 'contact_owner';
  addon_type?: 'coaches' | 'storage';
  owner_name?: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  inviteLink?: string;
  inviteToken?: string;
}

export interface PendingInvite {
  id: string;
  team_id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export class TeamMembershipService {
  private supabase = createClient();

  /**
   * Get all team members for a specific team
   * Returns members with user information
   */
  async getTeamMembers(teamId: string): Promise<TeamMemberWithUser[]> {
    // First verify the user has access to this team
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const hasAccess = await this.verifyTeamAccess(teamId, user.id);
    if (!hasAccess) throw new Error('Access denied to team');

    // Fetch memberships (without trying to join auth.users)
    const { data: memberships, error } = await this.supabase
      .from('team_memberships')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch team members: ${error.message}`);

    // For each membership, we'll use the current user's email as a placeholder
    // In production, you'd fetch user emails from auth.users via a server-side function
    return (memberships || []).map((m: any) => ({
      membership: {
        id: m.id,
        team_id: m.team_id,
        user_id: m.user_id,
        role: m.role,
        invited_by: m.invited_by,
        invited_at: m.invited_at,
        joined_at: m.joined_at,
        is_active: m.is_active,
        created_at: m.created_at,
        updated_at: m.updated_at
      },
      user: {
        id: m.user_id,
        email: m.user_id === user.id ? user.email! : 'user@example.com', // Show current user's email, others as placeholder
        full_name: m.user_id === user.id ? user.user_metadata?.full_name : undefined
      }
    }));
  }

  /**
   * Get all teams a user owns or coaches
   */
  async getUserTeams(userId?: string): Promise<TeamWithMembership[]> {
    // Get current user if not specified
    if (!userId) {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      userId = user.id;
    }

    // Fetch memberships first
    const { data: memberships, error: membershipError } = await this.supabase
      .from('team_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false });

    if (membershipError) throw new Error(`Failed to fetch user teams: ${membershipError.message}`);
    if (!memberships || memberships.length === 0) return [];

    // Fetch team details separately
    const teamIds = memberships.map(m => m.team_id);
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select('id, name, level')
      .in('id', teamIds);

    if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

    // Create a map of teams by ID
    const teamMap = new Map(teams?.map(t => [t.id, t]) || []);

    // Transform the data
    return memberships
      .filter(m => teamMap.has(m.team_id))
      .map((m: any) => {
        const team = teamMap.get(m.team_id)!;
        return {
          team: {
            id: team.id,
            name: team.name,
            level: team.level
          },
          membership: {
            id: m.id,
            team_id: m.team_id,
            user_id: m.user_id,
            role: m.role,
            invited_by: m.invited_by,
            invited_at: m.invited_at,
            joined_at: m.joined_at,
            is_active: m.is_active,
            created_at: m.created_at,
            updated_at: m.updated_at
          }
        };
      });
  }

  /**
   * Invite a coach to join a team
   * Only owners and coaches can invite
   * Cannot invite existing members
   * Enforces coach limits based on tier + add-ons
   * Trial subscriptions cannot add coaches - must request admin approval
   */
  async inviteCoach(params: InviteCoachParams): Promise<InviteCoachResult> {
    const { teamId, email, role } = params;

    // Verify current user
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify current user has permission to invite (owner or coach)
    const { data: currentMembership } = await this.supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Also check if user is team owner (backward compatibility)
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id, name')
      .eq('id', teamId)
      .single();

    const isTeamOwner = team?.user_id === user.id;
    const canInvite = isTeamOwner || ['owner', 'coach'].includes(currentMembership?.role);

    if (!canInvite) {
      throw new Error('Only owners and coaches can invite members');
    }

    // Check subscription status - trial users cannot add coaches
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('status, tier')
      .eq('team_id', teamId)
      .single();

    if (subscription?.status === 'trialing') {
      return {
        success: false,
        message: 'Trial accounts cannot add additional coaches. Please contact support to request adding coaches to your trial.',
        action: 'contact_owner',
        addon_type: 'coaches'
      };
    }

    // Check coach limit before inviting
    const limits = await getEffectiveLimitsClient(this.supabase, teamId);

    // Count current active members (including owner)
    const { count: memberCount } = await this.supabase
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_active', true);

    // Add 1 for the team owner (who may not be in team_memberships)
    const currentCoachCount = (memberCount || 0) + 1;

    if (currentCoachCount >= limits.max_coaches) {
      // Get owner's name for the message
      const { data: ownerProfile } = await this.supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', team?.user_id)
        .single();

      const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'the head coach';
      const userRole = isTeamOwner ? 'owner' : (currentMembership?.role || 'coach');

      const limitResponse = getLimitReachedResponseClient('coaches', userRole, ownerName, teamId);

      return {
        success: false,
        message: `Team has reached maximum coaches (${limits.max_coaches}) for this subscription.`,
        action: limitResponse.action,
        addon_type: 'coaches',
        owner_name: ownerName,
        buttonText: limitResponse.buttonText,
        buttonUrl: limitResponse.buttonUrl
      };
    }

    // Check if user with this email already exists via profiles table
    const { data: existingProfile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      // Check if already a member
      const { data: existingMembership } = await this.supabase
        .from('team_memberships')
        .select('id, is_active')
        .eq('team_id', teamId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (existingMembership?.is_active) {
        return {
          success: false,
          message: 'User is already a member of this team'
        };
      }

      if (existingMembership && !existingMembership.is_active) {
        // Reactivate membership
        const { error: updateError } = await this.supabase
          .from('team_memberships')
          .update({
            is_active: true,
            role,
            invited_by: user.id,
            invited_at: new Date().toISOString(),
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMembership.id);

        if (updateError) throw new Error(`Failed to reactivate membership: ${updateError.message}`);

        return {
          success: true,
          message: 'Coach re-invited successfully'
        };
      }

      // Create new membership for existing user
      const { error: insertError } = await this.supabase
        .from('team_memberships')
        .insert({
          team_id: teamId,
          user_id: existingProfile.id,
          role,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          is_active: true
        });

      if (insertError) throw new Error(`Failed to create membership: ${insertError.message}`);

      return {
        success: true,
        message: 'Coach added to team successfully'
      };
    }

    // User doesn't exist yet - check for existing pending invite
    const { data: existingInvite } = await this.supabase
      .from('team_invites')
      .select('id, token, expires_at')
      .eq('team_id', teamId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      // Check if expired
      if (new Date(existingInvite.expires_at) < new Date()) {
        // Update to expired and create new one
        await this.supabase
          .from('team_invites')
          .update({ status: 'expired' })
          .eq('id', existingInvite.id);
      } else {
        // Return existing invite link
        const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?invite=${existingInvite.token}`;
        return {
          success: true,
          message: `Invitation already sent to ${email}. Share this link with them to join.`,
          inviteLink,
          inviteToken: existingInvite.token
        };
      }
    }

    // Create new pending invite
    const { data: newInvite, error: inviteError } = await this.supabase
      .from('team_invites')
      .insert({
        team_id: teamId,
        email,
        role,
        invited_by: user.id,
      })
      .select('token')
      .single();

    if (inviteError) throw new Error(`Failed to create invitation: ${inviteError.message}`);

    const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?invite=${newInvite.token}`;

    return {
      success: true,
      message: `Invitation created! Share this link with ${email} to join your team.`,
      inviteLink,
      inviteToken: newInvite.token
    };
  }

  /**
   * Remove a coach from a team
   * Only owners can remove coaches
   * Owners cannot remove themselves (transfer ownership first)
   */
  async removeCoach(teamId: string, targetUserId: string): Promise<void> {
    // Verify current user
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify current user has permission (must be owner)
    const { data: currentMembership } = await this.supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Also check if user is team owner (backward compatibility)
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    const isTeamOwner = team?.user_id === user.id;
    const canRemove = isTeamOwner || currentMembership?.role === 'owner';

    if (!canRemove) {
      throw new Error('Only owners can remove team members');
    }

    // Cannot remove yourself
    if (targetUserId === user.id) {
      throw new Error('Cannot remove yourself from the team');
    }

    // Deactivate membership (soft delete)
    const { error } = await this.supabase
      .from('team_memberships')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('team_id', teamId)
      .eq('user_id', targetUserId);

    if (error) throw new Error(`Failed to remove coach: ${error.message}`);
  }

  /**
   * Update a coach's role
   * Only owners can change roles
   * Cannot change own role
   */
  async updateRole(teamId: string, targetUserId: string, newRole: 'owner' | 'coach'): Promise<void> {
    // Verify current user
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify current user has permission (must be owner)
    const { data: currentMembership } = await this.supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Also check if user is team owner (backward compatibility)
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    const isTeamOwner = team?.user_id === user.id;
    const canUpdateRole = isTeamOwner || currentMembership?.role === 'owner';

    if (!canUpdateRole) {
      throw new Error('Only owners can change roles');
    }

    // Cannot change own role
    if (targetUserId === user.id) {
      throw new Error('Cannot change your own role');
    }

    // Update role
    const { error } = await this.supabase
      .from('team_memberships')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to update role: ${error.message}`);
  }

  /**
   * Get current user's role for a team
   * Returns null if not a member
   */
  async getUserRole(teamId: string, userId?: string): Promise<'owner' | 'coach' | null> {
    // Get current user if not specified
    if (!userId) {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return null;
      userId = user.id;
    }

    // Check team ownership first (backward compatibility)
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (team?.user_id === userId) return 'owner';

    // Check membership
    const { data: membership } = await this.supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    return membership?.role || null;
  }

  /**
   * Check if user has access to a team
   * Helper method for authorization checks
   */
  private async verifyTeamAccess(teamId: string, userId: string): Promise<boolean> {
    // Check team ownership
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (team?.user_id === userId) return true;

    // Check membership
    const { data: membership } = await this.supabase
      .from('team_memberships')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    return !!membership;
  }

  /**
   * Check if user has specific permission level
   * @param teamId - Team to check
   * @param userId - User to check (defaults to current user)
   * @param minRole - Minimum role required ('owner', 'coach')
   */
  async hasPermission(
    teamId: string,
    minRole: 'owner' | 'coach',
    userId?: string
  ): Promise<boolean> {
    const userRole = await this.getUserRole(teamId, userId);
    if (!userRole) return false;

    // Role hierarchy: owner > coach
    const roleHierarchy = { owner: 2, coach: 1 };
    return roleHierarchy[userRole] >= roleHierarchy[minRole];
  }

  /**
   * Get pending invites for a team
   */
  async getPendingInvites(teamId: string): Promise<PendingInvite[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const hasAccess = await this.verifyTeamAccess(teamId, user.id);
    if (!hasAccess) throw new Error('Access denied to team');

    const { data: invites, error } = await this.supabase
      .from('team_invites')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch pending invites: ${error.message}`);

    return invites || [];
  }

  /**
   * Cancel a pending invite
   */
  async cancelInvite(inviteId: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get the invite to verify ownership
    const { data: invite } = await this.supabase
      .from('team_invites')
      .select('team_id')
      .eq('id', inviteId)
      .single();

    if (!invite) throw new Error('Invite not found');

    // Check if user is owner of the team
    const { data: team } = await this.supabase
      .from('teams')
      .select('user_id')
      .eq('id', invite.team_id)
      .single();

    const isTeamOwner = team?.user_id === user.id;
    if (!isTeamOwner) {
      const { data: membership } = await this.supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', invite.team_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (membership?.role !== 'owner') {
        throw new Error('Only owners can cancel invites');
      }
    }

    const { error } = await this.supabase
      .from('team_invites')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) throw new Error(`Failed to cancel invite: ${error.message}`);
  }

  /**
   * Get invite details by token (for signup flow)
   */
  async getInviteByToken(token: string): Promise<{ invite: PendingInvite; teamName: string } | null> {
    const { data: invite, error } = await this.supabase
      .from('team_invites')
      .select('*, teams(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (error || !invite) return null;

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return null;
    }

    return {
      invite: {
        id: invite.id,
        team_id: invite.team_id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        invited_by: invite.invited_by,
        invited_at: invite.invited_at,
        expires_at: invite.expires_at,
        status: invite.status
      },
      teamName: invite.teams?.name || 'Unknown Team'
    };
  }

  /**
   * Accept an invite after user signs up
   * Called when a new user completes signup with an invite token
   */
  async acceptInvite(token: string, userId: string): Promise<{ success: boolean; teamId?: string; message: string }> {
    // Get the invite
    const { data: invite, error: inviteError } = await this.supabase
      .from('team_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      return { success: false, message: 'Invalid or expired invitation' };
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await this.supabase
        .from('team_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      return { success: false, message: 'This invitation has expired' };
    }

    // Check if user is already a member
    const { data: existingMembership } = await this.supabase
      .from('team_memberships')
      .select('id, is_active')
      .eq('team_id', invite.team_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMembership?.is_active) {
      // Mark invite as accepted anyway
      await this.supabase
        .from('team_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);
      return { success: true, teamId: invite.team_id, message: 'You are already a member of this team' };
    }

    // Create or reactivate membership
    if (existingMembership) {
      const { error: updateError } = await this.supabase
        .from('team_memberships')
        .update({
          is_active: true,
          role: invite.role,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMembership.id);

      if (updateError) {
        return { success: false, message: 'Failed to join team' };
      }
    } else {
      const { error: insertError } = await this.supabase
        .from('team_memberships')
        .insert({
          team_id: invite.team_id,
          user_id: userId,
          role: invite.role,
          invited_by: invite.invited_by,
          invited_at: invite.invited_at,
          joined_at: new Date().toISOString(),
          is_active: true
        });

      if (insertError) {
        return { success: false, message: 'Failed to join team' };
      }
    }

    // Mark invite as accepted
    await this.supabase
      .from('team_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return { success: true, teamId: invite.team_id, message: 'Successfully joined team!' };
  }

  /**
   * Resend an invite (regenerate token and extend expiry)
   */
  async resendInvite(inviteId: string): Promise<{ inviteLink: string; token: string }> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get the invite
    const { data: invite, error: getError } = await this.supabase
      .from('team_invites')
      .select('team_id, email')
      .eq('id', inviteId)
      .single();

    if (getError || !invite) throw new Error('Invite not found');

    // Verify access
    const hasAccess = await this.verifyTeamAccess(invite.team_id, user.id);
    if (!hasAccess) throw new Error('Access denied');

    // Generate new token and extend expiry
    const newToken = crypto.randomUUID();
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await this.supabase
      .from('team_invites')
      .update({
        token: newToken,
        expires_at: newExpiry,
        updated_at: new Date().toISOString()
      })
      .eq('id', inviteId);

    if (updateError) throw new Error(`Failed to resend invite: ${updateError.message}`);

    const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?invite=${newToken}`;

    return { inviteLink, token: newToken };
  }
}
