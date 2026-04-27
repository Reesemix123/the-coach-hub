/**
 * API: POST /api/parent/profile/create
 *
 * Idempotent parent profile creation for the in-app mobile onboarding flow.
 * If a profile already exists for this user, returns 200 with the existing id
 * so a stuck user can re-submit Step 1 without breakage.
 *
 * Auth: requires a Supabase session (the user must already exist via auth.signUp).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as {
      firstName?: string
      lastName?: string
      phone?: string
      smsConsent?: boolean
      smsConsentText?: string
    }

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 },
      )
    }

    const serviceClient = createServiceClient()

    // Idempotent: if a profile already exists, return the existing id
    const { data: existing } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        parentProfileId: existing.id,
        alreadyExisted: true,
      })
    }

    const phone = body.phone?.trim() || null
    // SMS opt-in only if both consent and phone are present
    const smsConsent = !!body.smsConsent && !!phone
    const notification_preference = smsConsent ? 'both' : 'email'

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    const userAgent = request.headers.get('user-agent') ?? null
    const nowIso = new Date().toISOString()

    const { data: profile, error: insertError } = await serviceClient
      .from('parent_profiles')
      .insert({
        user_id: user.id,
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        email: user.email ?? '',
        phone,
        notification_preference,
        sms_consent: smsConsent,
        sms_consent_at: smsConsent ? nowIso : null,
        sms_consent_ip: smsConsent ? ip : null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[parent-profile-create] Insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    // Audit: log account creation (always)
    await serviceClient
      .from('parent_consent_log')
      .insert({
        parent_id: profile.id,
        team_id: null,
        consent_type: 'account_creation',
        consented: true,
        consent_text: 'Parent account created via mobile onboarding',
        ip_address: ip,
        user_agent: userAgent,
      })
      .then(({ error }) => {
        if (error)
          console.error('[parent-profile-create] Account consent log failed:', error)
      })

    // Audit: log SMS consent state (only when phone given — captures both opt-in and opt-out)
    if (phone) {
      await serviceClient
        .from('parent_consent_log')
        .insert({
          parent_id: profile.id,
          team_id: null,
          consent_type: 'sms_consent',
          consented: smsConsent,
          consent_text: body.smsConsentText ?? '',
          ip_address: ip,
          user_agent: userAgent,
        })
        .then(({ error }) => {
          if (error)
            console.error('[parent-profile-create] SMS consent log failed:', error)
        })
    }

    return NextResponse.json({
      parentProfileId: profile.id,
      alreadyExisted: false,
    })
  } catch (error) {
    console.error('[parent-profile-create] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
