// /api/admin/testing/issues/[completionId] - Update Issue API
// Updates the resolution status and/or admin notes on a flagged step completion.
// Requires platform admin authentication.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

type ResolutionStatus = 'open' | 'resolved' | 'wont_fix';

interface RouteContext {
  params: Promise<{ completionId: string }>;
}

/**
 * PATCH /api/admin/testing/issues/[completionId]
 * Updates resolution status and/or admin notes for a flagged issue.
 *
 * Body (all fields optional, at least one required):
 * - resolution_status: 'open' | 'resolved' | 'wont_fix'
 * - admin_notes: string
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { admin, serviceClient } = auth;

  try {
    const { completionId } = await params;

    const body = await request.json().catch(() => ({}));
    const { resolution_status, admin_notes } = body as {
      resolution_status?: ResolutionStatus;
      admin_notes?: string;
    };

    // Validate that at least one field is present
    if (resolution_status === undefined && admin_notes === undefined) {
      return NextResponse.json(
        { error: 'At least one of resolution_status or admin_notes is required' },
        { status: 400 }
      );
    }

    // Validate resolution_status value if provided
    const validStatuses: ResolutionStatus[] = ['open', 'resolved', 'wont_fix'];
    if (resolution_status !== undefined && !validStatuses.includes(resolution_status)) {
      return NextResponse.json(
        { error: `resolution_status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build a sparse update — only include provided fields
    const updatePayload: Record<string, unknown> = {};
    if (resolution_status !== undefined) updatePayload.resolution_status = resolution_status;
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;

    const { data: updatedRecord, error: updateError } = await serviceClient
      .from('test_step_completions')
      .update(updatePayload)
      .eq('id', completionId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update issue:', updateError);
      return NextResponse.json(
        { error: 'Failed to update issue' },
        { status: 500 }
      );
    }

    if (!updatedRecord) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    await logAdminAction(
      admin.id,
      admin.email,
      'testing.issue_updated',
      'test_step_completion',
      completionId,
      undefined,
      { resolution_status, admin_notes_provided: admin_notes !== undefined }
    );

    return NextResponse.json({ record: updatedRecord });
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Server error while updating issue' },
      { status: 500 }
    );
  }
}
