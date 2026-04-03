/**
 * API: POST /api/parent/sms-consent
 * Handles SMS consent withdrawal and re-consent for TCPA compliance.
 *
 * Actions:
 *   withdraw — revokes SMS consent, forces notification_preference to email,
 *              logs withdrawal to parent_consent_log
 *   consent  — grants SMS consent, sets notification_preference to both,
 *              logs consent with full TCPA text to parent_consent_log
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// IMPORTANT: This text must match src/app/auth/parent-signup/page.tsx
// SMS_CONSENT_TEXT exactly. Update both locations if this text changes.
const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Youth Coach Hub, including game alerts, coaching updates, and team notifications. Message & data rates may apply. Reply STOP at any time to opt out.';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { action?: string };
    if (!body.action || !['withdraw', 'consent'].includes(body.action)) {
      return NextResponse.json({ error: 'action must be withdraw or consent' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id, phone, sms_consent')
      .eq('user_id', user.id)
      .single();

    if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    if (body.action === 'withdraw') {
      // Revoke consent + force preference to email
      await serviceClient
        .from('parent_profiles')
        .update({
          sms_consent: false,
          sms_consent_at: null,
          notification_preference: 'email',
        })
        .eq('id', parent.id);

      // Log withdrawal
      await serviceClient.from('parent_consent_log').insert({
        parent_id: parent.id,
        team_id: null,
        consent_type: 'sms_consent',
        consented: false,
        consent_text: 'SMS consent withdrawn by parent via settings',
        ip_address: ip,
        user_agent: userAgent,
      });

      return NextResponse.json({
        success: true,
        sms_consent: false,
        notification_preference: 'email',
      });
    }

    // Re-consent
    if (!parent.phone) {
      return NextResponse.json(
        { error: 'A phone number is required before consenting to SMS' },
        { status: 400 }
      );
    }

    await serviceClient
      .from('parent_profiles')
      .update({
        sms_consent: true,
        sms_consent_at: new Date().toISOString(),
        sms_consent_ip: ip,
        notification_preference: 'both',
      })
      .eq('id', parent.id);

    // Log re-consent with full TCPA text
    await serviceClient.from('parent_consent_log').insert({
      parent_id: parent.id,
      team_id: null,
      consent_type: 'sms_consent',
      consented: true,
      consent_text: SMS_CONSENT_TEXT,
      ip_address: ip,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      sms_consent: true,
      notification_preference: 'both',
    });
  } catch (error) {
    console.error('[sms-consent] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
