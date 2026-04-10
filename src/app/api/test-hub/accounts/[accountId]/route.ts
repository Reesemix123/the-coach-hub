/**
 * API: DELETE /api/test-hub/accounts/[accountId]
 * Permanently deletes a test account: removes the auth user from Supabase Auth
 * (which cascades to all auth-scoped data) and removes the test_accounts row.
 * Admin only.
 *
 * Returns: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function DELETE(
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

    // 1. Fetch the test account record to get the auth_user_id
    const { data: account, error: fetchError } = await serviceClient
      .from('test_accounts')
      .select('id, auth_user_id')
      .eq('id', accountId)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Test account not found' }, { status: 404 });
    }

    const authUserId = account.auth_user_id as string;

    // 2. Delete the auth user — this cascades to all Supabase Auth-scoped data
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(authUserId);

    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError);
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 });
    }

    // 3. Delete the test_accounts row
    const { error: deleteRowError } = await serviceClient
      .from('test_accounts')
      .delete()
      .eq('id', accountId);

    if (deleteRowError) {
      console.error('Failed to delete test_accounts row:', deleteRowError);
      return NextResponse.json({ error: 'Failed to delete account record' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/test-hub/accounts/[accountId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
