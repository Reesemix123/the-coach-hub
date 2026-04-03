/**
 * API: /api/admin/deletion-requests
 * GET  — list all deletion requests with athlete + parent info
 * PATCH — approve or reject a request (does NOT execute deletion)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendNotification, getCommHubEmailTemplate, formatSmsBody } from '@/lib/services/communication/notification.service';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_platform_admin) return null;
  return user;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const serviceClient = createServiceClient();

    const { data: requests, error } = await serviceClient
      .from('deletion_requests')
      .select(`
        id, athlete_profile_id, parent_id, reason, status,
        requested_at, reviewed_by, reviewed_at, review_notes,
        completed_at, error_message, deletion_summary
      `)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('[admin-deletion] Fetch failed:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // Enrich with athlete + parent names
    const enriched = await Promise.all(
      (requests ?? []).map(async (req) => {
        const [{ data: athlete }, { data: parent }] = await Promise.all([
          serviceClient.from('athlete_profiles').select('athlete_first_name, athlete_last_name').eq('id', req.athlete_profile_id).maybeSingle(),
          serviceClient.from('parent_profiles').select('first_name, last_name, email').eq('id', req.parent_id).single(),
        ]);

        return {
          ...req,
          athleteName: athlete
            ? `${athlete.athlete_first_name} ${athlete.athlete_last_name}`
            : '(deleted)',
          parentName: parent ? `${parent.first_name} ${parent.last_name}` : 'Unknown',
          parentEmail: parent?.email ?? '',
        };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (error) {
    console.error('[admin-deletion] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as {
      requestId?: string;
      action?: 'approve' | 'reject';
      reviewNotes?: string;
    };

    if (!body.requestId || !body.action) {
      return NextResponse.json({ error: 'requestId and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(body.action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Verify request exists and is pending
    const { data: req } = await serviceClient
      .from('deletion_requests')
      .select('id, status, parent_id, athlete_profile_id')
      .eq('id', body.requestId)
      .single();

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') {
      return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 409 });
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

    const { error: updateError } = await serviceClient
      .from('deletion_requests')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: body.reviewNotes?.trim() || null,
      })
      .eq('id', body.requestId);

    if (updateError) {
      console.error('[admin-deletion] Update failed:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // Notify parent on rejection
    if (newStatus === 'rejected') {
      try {
        const [{ data: parent }, { data: athlete }] = await Promise.all([
          serviceClient.from('parent_profiles').select('id, email, phone, first_name, notification_preference').eq('id', req.parent_id).single(),
          serviceClient.from('athlete_profiles').select('athlete_first_name, athlete_last_name').eq('id', req.athlete_profile_id).maybeSingle(),
        ]);

        if (parent) {
          const athleteName = athlete ? `${athlete.athlete_first_name} ${athlete.athlete_last_name}` : 'your athlete';
          const notesText = body.reviewNotes ? `<p><strong>Notes from the team:</strong> ${body.reviewNotes}</p>` : '';

          sendNotification({
            teamId: '',
            recipientId: parent.id,
            recipientType: 'parent',
            channel: (parent.notification_preference as 'sms' | 'email' | 'both') ?? 'email',
            notificationType: 'announcement',
            subject: `Deletion request update for ${athleteName}`,
            body: getCommHubEmailTemplate({
              title: 'Deletion Request Not Approved',
              body: `<p>Hi ${parent.first_name ?? 'there'},</p><p>Your request to delete ${athleteName}'s profile has been reviewed and was not approved at this time.</p>${notesText}<p>If you have questions, please contact support.</p>`,
            }),
            smsBody: formatSmsBody('Youth Coach Hub', `Your deletion request for ${athleteName}'s profile was not approved. Contact support if you have questions.`),
            recipientEmail: parent.email,
            recipientPhone: parent.phone ?? undefined,
          }).catch(err => console.error('[admin-deletion] Parent rejection notification failed:', err));
        }
      } catch (notifyErr) {
        console.error('[admin-deletion] Parent notification error:', notifyErr);
      }
    }

    return NextResponse.json({ status: newStatus });
  } catch (error) {
    console.error('[admin-deletion] PATCH error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
