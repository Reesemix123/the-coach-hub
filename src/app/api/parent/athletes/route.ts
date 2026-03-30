/**
 * API: POST /api/parent/athletes
 * Creates an athlete_profiles row owned by the requesting parent.
 * Does NOT create athlete_seasons — that happens when roster link is established.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify parent
    const serviceClient = createServiceClient();
    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: 'Parent profile required' }, { status: 403 });

    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      graduationYear?: number;
      photoPath?: string;
    };

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    if (body.graduationYear != null && (body.graduationYear < currentYear || body.graduationYear > currentYear + 8)) {
      return NextResponse.json({ error: 'Graduation year must be between this year and 8 years from now' }, { status: 400 });
    }

    const { data: athlete, error: insertError } = await serviceClient
      .from('athlete_profiles')
      .insert({
        athlete_first_name: body.firstName.trim(),
        athlete_last_name: body.lastName.trim(),
        graduation_year: body.graduationYear ?? null,
        profile_photo_url: body.photoPath ?? null,
        created_by_parent_id: parent.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[create-athlete] Insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to create athlete profile' }, { status: 500 });
    }

    return NextResponse.json({ athleteProfileId: athlete.id });
  } catch (error) {
    console.error('[create-athlete] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
