/**
 * Parent Service
 * Handles parent invitations, profiles, and access management
 */

import { createClient } from '@/utils/supabase/client';
import type {
  ParentProfile,
  ParentInvitation,
  PlayerParentLink,
  TeamParentAccess,
  ParentConsentLog,
  ParentRelationship,
  ConsentType,
  ParentWithChildren,
} from '@/types/communication';

// ======================
// INVITATION MANAGEMENT
// ======================

export interface InviteParentInput {
  teamId: string;
  playerId: string;
  parentEmail: string;
  parentName?: string;
  relationship?: ParentRelationship;
}

export async function inviteParent(input: InviteParentInput): Promise<ParentInvitation> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('parent_invitations')
    .insert({
      team_id: input.teamId,
      player_id: input.playerId,
      invited_by: user.user.id,
      parent_email: input.parentEmail.toLowerCase().trim(),
      parent_name: input.parentName,
      relationship: input.relationship,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This email has already been invited to this team');
    }
    throw error;
  }

  return data;
}

export async function resendInvitation(invitationId: string): Promise<ParentInvitation> {
  const supabase = createClient();

  // Reset the invitation token and expiration
  const { data, error } = await supabase
    .from('parent_invitations')
    .update({
      invitation_token: crypto.randomUUID(),
      token_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      auto_resend_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      auto_resend_sent: false,
      status: 'pending',
    })
    .eq('id', invitationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('parent_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);

  if (error) throw error;
}

export async function getTeamInvitations(teamId: string): Promise<ParentInvitation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parent_invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPendingInvitations(teamId: string): Promise<ParentInvitation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parent_invitations')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ======================
// INVITATION ACCEPTANCE
// ======================

export interface AcceptInvitationInput {
  invitationToken: string;
  firstName: string;
  lastName: string;
  phone?: string;
  notificationPreference: 'sms' | 'email' | 'both';
  password: string;
  consentText: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function validateInvitationToken(token: string): Promise<ParentInvitation | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parent_invitations')
    .select('*')
    .eq('invitation_token', token)
    .eq('status', 'pending')
    .gt('token_expires_at', new Date().toISOString())
    .single();

  if (error) return null;
  return data;
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<{
  profile: ParentProfile;
  accessGranted: TeamParentAccess;
}> {
  const supabase = createClient();

  // 1. Validate the token
  const invitation = await validateInvitationToken(input.invitationToken);
  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // 2. Create the user account
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: invitation.parent_email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        user_type: 'parent',
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create account');

  // 3. Create parent profile
  const { data: profile, error: profileError } = await supabase
    .from('parent_profiles')
    .insert({
      user_id: authData.user.id,
      first_name: input.firstName,
      last_name: input.lastName,
      email: invitation.parent_email,
      phone: input.phone,
      notification_preference: input.notificationPreference,
    })
    .select()
    .single();

  if (profileError) throw profileError;

  // 4. Link parent to player
  const { error: linkError } = await supabase
    .from('player_parent_links')
    .insert({
      player_id: invitation.player_id,
      parent_id: profile.id,
      relationship: invitation.relationship || 'guardian',
      is_primary_contact: true,
    });

  if (linkError) throw linkError;

  // 5. Grant team access
  const { data: access, error: accessError } = await supabase
    .from('team_parent_access')
    .insert({
      team_id: invitation.team_id,
      parent_id: profile.id,
      access_level: 'full',
      status: 'active',
    })
    .select()
    .single();

  if (accessError) throw accessError;

  // 6. Log consent
  const { error: consentError } = await supabase
    .from('parent_consent_log')
    .insert({
      parent_id: profile.id,
      team_id: invitation.team_id,
      consent_type: 'account_creation' as ConsentType,
      consented: true,
      consent_text: input.consentText,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
    });

  if (consentError) throw consentError;

  // 7. Mark invitation as accepted
  const { error: updateError } = await supabase
    .from('parent_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  if (updateError) throw updateError;

  return { profile, accessGranted: access };
}

// ======================
// PARENT PROFILE MANAGEMENT
// ======================

export async function getParentProfile(): Promise<ParentProfile | null> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return null;

  const { data, error } = await supabase
    .from('parent_profiles')
    .select('*')
    .eq('user_id', user.user.id)
    .single();

  if (error) return null;
  return data;
}

export async function updateParentProfile(
  updates: Partial<Pick<ParentProfile, 'first_name' | 'last_name' | 'phone' | 'notification_preference' | 'avatar_url'>>
): Promise<ParentProfile> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('parent_profiles')
    .update(updates)
    .eq('user_id', user.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================
// TEAM PARENT ROSTER
// ======================

export async function getTeamParents(teamId: string): Promise<ParentWithChildren[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_parent_access')
    .select(`
      parent_id,
      access_level,
      status,
      parent_profiles!inner (
        id,
        first_name,
        last_name,
        email,
        phone,
        notification_preference,
        is_champion,
        created_at
      )
    `)
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (error) throw error;

  // Get player links for these parents
  const parentIds = data?.map(d => d.parent_id) || [];

  const { data: links, error: linksError } = await supabase
    .from('player_parent_links')
    .select(`
      parent_id,
      relationship,
      is_primary_contact,
      players!inner (
        id,
        first_name,
        last_name,
        jersey_number
      )
    `)
    .in('parent_id', parentIds);

  if (linksError) throw linksError;

  // Combine data
  return (data || []).map(item => {
    const parentData = item.parent_profiles as unknown as ParentProfile;
    const playerLinks = (links || []).filter(l => l.parent_id === item.parent_id);

    return {
      parent: parentData,
      children: playerLinks.map(link => ({
        player_id: (link.players as { id: string }).id,
        player_name: `${(link.players as { first_name: string }).first_name} ${(link.players as { last_name: string }).last_name}`,
        jersey_number: (link.players as { jersey_number: number | null }).jersey_number,
        relationship: link.relationship as ParentRelationship,
        is_primary_contact: link.is_primary_contact,
      })),
    };
  });
}

export async function getParentTeams(): Promise<Array<{
  team_id: string;
  team_name: string;
  access_level: string;
  children: Array<{ player_id: string; player_name: string }>;
}>> {
  const supabase = createClient();
  const profile = await getParentProfile();

  if (!profile) return [];

  const { data, error } = await supabase
    .from('team_parent_access')
    .select(`
      team_id,
      access_level,
      teams!inner (
        id,
        name
      )
    `)
    .eq('parent_id', profile.id)
    .eq('status', 'active');

  if (error) throw error;

  // Get children for each team
  const { data: links, error: linksError } = await supabase
    .from('player_parent_links')
    .select(`
      players!inner (
        id,
        first_name,
        last_name,
        team_id
      )
    `)
    .eq('parent_id', profile.id);

  if (linksError) throw linksError;

  return (data || []).map(item => {
    const team = item.teams as unknown as { id: string; name: string };
    const teamChildren = (links || [])
      .filter(l => (l.players as { team_id: string }).team_id === team.id)
      .map(l => ({
        player_id: (l.players as { id: string }).id,
        player_name: `${(l.players as { first_name: string }).first_name} ${(l.players as { last_name: string }).last_name}`,
      }));

    return {
      team_id: team.id,
      team_name: team.name,
      access_level: item.access_level,
      children: teamChildren,
    };
  });
}

// ======================
// PARENT CHAMPION MANAGEMENT
// ======================

export async function setParentChampion(parentId: string, isChampion: boolean): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('parent_profiles')
    .update({ is_champion: isChampion })
    .eq('id', parentId);

  if (error) throw error;
}

export async function getTeamChampions(teamId: string): Promise<ParentProfile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('team_parent_access')
    .select(`
      parent_profiles!inner (*)
    `)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .eq('parent_profiles.is_champion', true);

  if (error) throw error;

  return (data || []).map(d => d.parent_profiles as unknown as ParentProfile);
}

// ======================
// PARENT ACCESS MANAGEMENT
// ======================

export async function removeParentFromTeam(teamId: string, parentId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('team_parent_access')
    .update({ status: 'removed' })
    .eq('team_id', teamId)
    .eq('parent_id', parentId);

  if (error) throw error;
}

export async function linkParentToPlayer(input: {
  parentId: string;
  playerId: string;
  relationship: ParentRelationship;
  isPrimaryContact?: boolean;
}): Promise<PlayerParentLink> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('player_parent_links')
    .insert({
      parent_id: input.parentId,
      player_id: input.playerId,
      relationship: input.relationship,
      is_primary_contact: input.isPrimaryContact || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlinkParentFromPlayer(parentId: string, playerId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('player_parent_links')
    .delete()
    .eq('parent_id', parentId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// ======================
// CONSENT LOGGING
// ======================

export async function logConsent(input: {
  parentId: string;
  teamId: string;
  consentType: ConsentType;
  consented: boolean;
  consentText: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ParentConsentLog> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parent_consent_log')
    .insert({
      parent_id: input.parentId,
      team_id: input.teamId,
      consent_type: input.consentType,
      consented: input.consented,
      consent_text: input.consentText,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getParentConsents(parentId: string): Promise<ParentConsentLog[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parent_consent_log')
    .select('*')
    .eq('parent_id', parentId)
    .order('consented_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
