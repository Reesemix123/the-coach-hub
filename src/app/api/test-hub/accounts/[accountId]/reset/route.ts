/**
 * API: POST /api/test-hub/accounts/[accountId]/reset
 * Resets a test account to a clean state by wiping all user-generated data:
 * team memberships, owned teams, and parent profiles. Coach accounts get a
 * fresh empty team re-created to match the original provisioning state.
 * Admin only.
 *
 * Returns: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Admin auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // 1. Fetch the test account record
    const { data: account, error: fetchError } = await serviceClient
      .from('test_accounts')
      .select('id, auth_user_id, account_type, team_name')
      .eq('id', accountId)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Test account not found' }, { status: 404 });
    }

    const authUserId = account.auth_user_id as string;

    // 2. Delete team memberships for this auth user
    const { error: membershipsError } = await serviceClient
      .from('team_memberships')
      .delete()
      .eq('user_id', authUserId);

    if (membershipsError) {
      console.error('Failed to delete team_memberships:', membershipsError);
      return NextResponse.json({ error: 'Failed to reset team memberships' }, { status: 500 });
    }

    // 3. Delete owned teams
    const { error: teamsError } = await serviceClient
      .from('teams')
      .delete()
      .eq('user_id', authUserId);

    if (teamsError) {
      console.error('Failed to delete teams:', teamsError);
      return NextResponse.json({ error: 'Failed to reset owned teams' }, { status: 500 });
    }

    // 4. Delete parent profiles
    const { error: parentError } = await serviceClient
      .from('parent_profiles')
      .delete()
      .eq('user_id', authUserId);

    if (parentError) {
      console.error('Failed to delete parent_profiles:', parentError);
      return NextResponse.json({ error: 'Failed to reset parent profiles' }, { status: 500 });
    }

    // 5. Re-create a fresh team for coach accounts
    if (account.account_type === 'coach') {
      const teamName = (account.team_name as string | null) || 'Test Team';

      const { data: newTeam, error: teamCreateError } = await serviceClient
        .from('teams')
        .insert({
          name: teamName,
          sport: 'football',
          level: 'Youth',
          colors: { primary: '#000000', secondary: '#FFFFFF' },
          user_id: authUserId,
          default_tier: 'basic',
        })
        .select('id')
        .single();

      if (teamCreateError) {
        console.error('Failed to re-create team after reset:', teamCreateError);
        return NextResponse.json({ error: 'Failed to recreate team' }, { status: 500 });
      }

      // Update the test_account row with the new team_id
      const { error: updateError } = await serviceClient
        .from('test_accounts')
        .update({ team_id: newTeam?.id ?? null })
        .eq('id', accountId);

      if (updateError) {
        console.error('Failed to update test_account team_id:', updateError);
        return NextResponse.json({ error: 'Failed to update account team reference' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/test-hub/accounts/[accountId]/reset error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
