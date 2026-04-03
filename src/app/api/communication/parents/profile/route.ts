/**
 * API: /api/communication/parents/profile
 * GET  - Returns the authenticated parent's profile
 * PATCH - Updates the authenticated parent's notification_preference
 *
 * Both endpoints require the caller to be authenticated and to have
 * a corresponding row in parent_profiles. The service client is used
 * so RLS does not interfere; ownership is enforced by filtering on
 * user_id from the verified session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: profile, error } = await serviceClient
      .from('parent_profiles')
      .select('id, first_name, last_name, email, phone, notification_preference, is_champion, sms_consent, sms_consent_at')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[GET /api/communication/parents/profile] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_preference } = body as { notification_preference?: string };

    const validPreferences = ['sms', 'email', 'both'] as const;
    if (
      !notification_preference ||
      !(validPreferences as readonly string[]).includes(notification_preference)
    ) {
      return NextResponse.json(
        { error: 'notification_preference must be one of: sms, email, both' },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('parent_profiles')
      .update({ notification_preference })
      .eq('user_id', user.id);

    if (error) {
      console.error('[PATCH /api/communication/parents/profile] DB error:', error);
      return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/communication/parents/profile] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
