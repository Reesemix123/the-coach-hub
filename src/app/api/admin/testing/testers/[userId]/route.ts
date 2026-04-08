// /api/admin/testing/testers/[userId] - Update Tester Status API
// Grants or revokes tester access for a specific user profile.
// Requires platform admin authentication.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * PATCH /api/admin/testing/testers/[userId]
 * Grants or revokes tester access for a user.
 *
 * Body:
 * - is_tester: boolean (required) - Whether to grant or revoke tester access
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { admin, serviceClient } = auth;

  try {
    const { userId } = await params;

    const body = await request.json().catch(() => ({}));

    if (typeof body.is_tester !== 'boolean') {
      return NextResponse.json(
        { error: 'is_tester must be a boolean' },
        { status: 400 }
      );
    }

    const { is_tester } = body as { is_tester: boolean };

    const { data: updatedProfile, error: updateError } = await serviceClient
      .from('profiles')
      .update({ is_tester })
      .eq('id', userId)
      .select('id, email, full_name, is_tester, created_at, last_active_at')
      .single();

    if (updateError) {
      console.error('Failed to update tester status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update tester status' },
        { status: 500 }
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await logAdminAction(
      admin.id,
      admin.email,
      is_tester ? 'testing.tester_granted' : 'testing.tester_revoked',
      'user',
      userId,
      updatedProfile.email ?? 'Unknown',
      { is_tester }
    );

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error updating tester status:', error);
    return NextResponse.json(
      { error: 'Server error while updating tester status' },
      { status: 500 }
    );
  }
}
