// /api/coach-requests/[requestId] - Individual coach request management
// Admins can approve or deny coach access requests

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ requestId: string }>;
}

/**
 * PATCH /api/coach-requests/[requestId]
 * Approve or deny a coach access request (admin only)
 *
 * Request body:
 * {
 *   action: 'approve' | 'deny',
 *   coach_slots?: number (optional, for approved requests),
 *   admin_notes?: string (optional)
 * }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { requestId } = await context.params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, coach_slots, admin_notes } = body;

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "deny".' },
        { status: 400 }
      );
    }

    // Fetch the request
    const { data: coachRequest, error: fetchError } = await supabase
      .from('coach_requests')
      .select('*, teams:team_id (id, name, user_id)')
      .eq('id', requestId)
      .single();

    if (fetchError || !coachRequest) {
      return NextResponse.json(
        { error: 'Coach request not found' },
        { status: 404 }
      );
    }

    if (coachRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // Update the request
    const updateData: any = {
      status: action === 'approve' ? 'approved' : 'denied',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: admin_notes || null
    };

    if (action === 'approve') {
      updateData.granted_coach_slots = coach_slots || 3; // Default to 3 coach slots
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('coach_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating coach request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      );
    }

    // If approved, update the subscription to allow adding coaches
    // This is done by adding coach slots to the team's limits
    if (action === 'approve' && coachRequest.teams?.id) {
      // Check if team has addons record, create or update
      const { data: existingAddons } = await supabase
        .from('team_addons')
        .select('id, additional_coaches')
        .eq('team_id', coachRequest.teams.id)
        .single();

      if (existingAddons) {
        // Update existing addons
        await supabase
          .from('team_addons')
          .update({
            additional_coaches: (existingAddons.additional_coaches || 0) + (coach_slots || 3),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAddons.id);
      } else {
        // Create new addons record
        await supabase
          .from('team_addons')
          .insert({
            team_id: coachRequest.teams.id,
            additional_coaches: coach_slots || 3,
            additional_ai_credits: 0,
            additional_storage_gb: 0,
            monthly_cost_cents: 0 // Free for trial approval
          });
      }
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      message: action === 'approve'
        ? `Coach access approved with ${coach_slots || 3} coach slots`
        : 'Coach access request denied'
    });

  } catch (error) {
    console.error('Error processing coach request:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
