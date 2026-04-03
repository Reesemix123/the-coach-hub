/**
 * API: POST /api/parent/deletion-request
 * Parent submits a request to delete an athlete profile.
 * Notifies platform admins via email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { athleteProfileId?: string; reason?: string };
    if (!body.athleteProfileId) {
      return NextResponse.json({ error: 'athleteProfileId is required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Verify parent
    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id, first_name, last_name, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: 'Parent profile required' }, { status: 403 });

    // Verify parent owns this athlete
    const { data: athlete } = await serviceClient
      .from('athlete_profiles')
      .select('id, athlete_first_name, athlete_last_name')
      .eq('id', body.athleteProfileId)
      .eq('created_by_parent_id', parent.id)
      .maybeSingle();

    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    // Check for existing pending request
    const { data: existing } = await serviceClient
      .from('deletion_requests')
      .select('id')
      .eq('athlete_profile_id', body.athleteProfileId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A deletion request is already pending for this athlete' },
        { status: 409 }
      );
    }

    // Insert deletion request
    const { data: request_row, error: insertError } = await serviceClient
      .from('deletion_requests')
      .insert({
        athlete_profile_id: body.athleteProfileId,
        parent_id: parent.id,
        reason: body.reason?.trim() || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[deletion-request] Insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    // Notify platform admins via email
    const athleteName = `${athlete.athlete_first_name} ${athlete.athlete_last_name}`;
    const parentName = `${parent.first_name} ${parent.last_name}`;

    try {
      const { data: admins } = await serviceClient
        .from('profiles')
        .select('email')
        .eq('is_platform_admin', true);

      const adminEmails = (admins ?? [])
        .map((a) => a.email)
        .filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: `[Action Required] Athlete Deletion Request — ${athleteName}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Athlete Deletion Request</h1>
              </div>
              <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
                <p style="margin-top: 0;"><strong>Parent:</strong> ${parentName} (${parent.email})</p>
                <p><strong>Athlete:</strong> ${athleteName}</p>
                ${body.reason ? `<p><strong>Reason:</strong> ${body.reason}</p>` : ''}
                <p style="margin-bottom: 0;"><strong>Submitted:</strong> ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
                <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
                <p style="font-size: 14px; color: #666;">
                  Review this request in the <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://youthcoachhub.com'}/admin/deletion-requests">Admin Console</a>.
                </p>
              </div>
            </div>
          `,
          tags: [
            { name: 'type', value: 'deletion-request' },
            { name: 'athlete_profile_id', value: body.athleteProfileId },
          ],
        });
      }
    } catch (emailErr) {
      console.error('[deletion-request] Admin email notification failed:', emailErr);
    }

    // Notify platform owner via SMS
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (adminPhone) {
      try {
        const twilio = await import('twilio');
        const client = twilio.default(
          process.env.TWILIO_ACCOUNT_SID!,
          process.env.TWILIO_AUTH_TOKEN!,
        );
        await client.messages.create({
          body: `[Youth Coach Hub] Deletion request: ${parentName} requested deletion of ${athleteName}'s profile. Review in admin console.`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: adminPhone,
        });
      } catch (smsErr) {
        console.error('[deletion-request] Admin SMS notification failed:', smsErr);
      }
    }

    return NextResponse.json({ requestId: request_row.id });
  } catch (error) {
    console.error('[deletion-request] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ requests: [] });

    const { data: requests } = await serviceClient
      .from('deletion_requests')
      .select('id, athlete_profile_id, status, reason, requested_at, review_notes')
      .eq('parent_id', parent.id)
      .order('requested_at', { ascending: false });

    return NextResponse.json({ requests: requests ?? [] });
  } catch (error) {
    console.error('[deletion-request] GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
