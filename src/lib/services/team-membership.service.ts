// src/lib/services/team-membership.service.ts
// Multi-coach collaboration service
// Manages team invitations, memberships, and role-based access

import { createClient } from '@/utils/supabase/client';
import type { TeamMembership } from '@/types/football';

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
  role: 'coach' | 'analyst' | 'viewer';
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

    // Fetch memberships with user data
    const { data: memberships, error } = await this.supabase
      .from('team_memberships')
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch team members: ${error.message}`);

    // Transform the data
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
        id: m.user.id,
        email: m.user.email,
        full_name: m.user.raw_user_meta_data?.full_name
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

    // Fetch teams via memberships
    const { data: memberships, error } = await this.supabase
      .from('team_memberships')
      .select(`
        *,
        team:team_id (
          id,
          name,
          level
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch user teams: ${error.message}`);

    // Transform the data
    return (memberships || []).map((m: any) => ({
      team: {
        id: m.team.id,
        name: m.team.name,
        level: m.team.level
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
    }));
  }

  /**
   * Invite a coach to join a team
   * Only owners and coaches can invite
   * Cannot invite existing members
   */
  async inviteCoach(params: InviteCoachParams): Promise<{ success: boolean; message: string }> {
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
      .select('user_id')
      .eq('id', teamId)
      .single();

    const isTeamOwner = team?.user_id === user.id;
    const canInvite = isTeamOwner || ['owner', 'coach'].includes(currentMembership?.role);

    if (!canInvite) {
      throw new Error('Only owners and coaches can invite members');
    }

    // Look up user by email
    // Note: This requires a custom function or admin API
    // For now, we'll implement a simple email storage approach
    // In production, you'd send an email with an invite link

    // Check if user with this email already exists
    const { data: existingUser } = await this.supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Check if already a member
      const { data: existingMembership } = await this.supabase
        .from('team_memberships')
        .select('id, is_active')
        .eq('team_id', teamId)
        .eq('user_id', existingUser.id)
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

      // Create new membership
      const { error: insertError } = await this.supabase
        .from('team_memberships')
        .insert({
          team_id: teamId,
          user_id: existingUser.id,
          role,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          is_active: true
        });

      if (insertError) throw new Error(`Failed to create membership: ${insertError.message}`);

      return {
        success: true,
        message: 'Coach invited successfully'
      };
    }

    // User doesn't exist yet - store pending invite
    // This would be implemented with an invites table
    // For MVP, we'll return a message that they need to sign up first
    return {
      success: false,
      message: 'User must create an account first. Send them the invite link to sign up.'
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
  async updateRole(teamId: string, targetUserId: string, newRole: 'owner' | 'coach' | 'analyst' | 'viewer'): Promise<void> {
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
  async getUserRole(teamId: string, userId?: string): Promise<'owner' | 'coach' | 'analyst' | 'viewer' | null> {
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
   * @param minRole - Minimum role required ('owner', 'coach', 'analyst', 'viewer')
   */
  async hasPermission(
    teamId: string,
    minRole: 'owner' | 'coach' | 'analyst' | 'viewer',
    userId?: string
  ): Promise<boolean> {
    const userRole = await this.getUserRole(teamId, userId);
    if (!userRole) return false;

    // Role hierarchy: owner > coach > analyst > viewer
    const roleHierarchy = { owner: 4, coach: 3, analyst: 2, viewer: 1 };
    return roleHierarchy[userRole] >= roleHierarchy[minRole];
  }
}
