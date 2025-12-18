/**
 * GET /api/teams/:teamId/coaches
 * Returns all coaches for a team (from team_memberships + team owner)
 * Used for practice planning coach selection
 */

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface Coach {
  id: string;
  name: string;
  role: 'owner' | 'coach';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user has access to this team (owner or member)
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check if user owns the team or is a member
  let hasAccess = team.user_id === user.id;

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    hasAccess = !!membership;
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'You do not have access to this team' },
      { status: 403 }
    );
  }

  const coaches: Coach[] = [];

  // Get team owner's profile
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', team.user_id)
    .single();

  if (ownerProfile) {
    // Prefer full_name, but extract first name from email if needed
    let coachName = ownerProfile.full_name;
    if (!coachName && ownerProfile.email) {
      // Extract name from email (e.g., "john.smith@..." -> "John Smith")
      const emailName = ownerProfile.email.split('@')[0];
      coachName = emailName
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    }
    coaches.push({
      id: ownerProfile.id,
      name: coachName || 'Head Coach',
      role: 'owner'
    });
  }

  // Get team members (coaches) from team_memberships
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('user_id, role')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .neq('user_id', team.user_id); // Exclude owner, already added

  if (memberships && memberships.length > 0) {
    // Get profiles for all members
    const memberIds = memberships.map(m => m.user_id);
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', memberIds);

    const profileMap = new Map(
      memberProfiles?.map(p => [p.id, p]) || []
    );

    for (const membership of memberships) {
      const profile = profileMap.get(membership.user_id);
      if (profile) {
        // Prefer full_name, but extract first name from email if needed
        let coachName = profile.full_name;
        if (!coachName && profile.email) {
          // Extract name from email (e.g., "john.smith@..." -> "John Smith")
          const emailName = profile.email.split('@')[0];
          coachName = emailName
            .replace(/[._-]/g, ' ')
            .split(' ')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
        }
        coaches.push({
          id: profile.id,
          name: coachName || 'Assistant Coach',
          role: membership.role as 'owner' | 'coach'
        });
      }
    }
  }

  return NextResponse.json({ coaches });
}
