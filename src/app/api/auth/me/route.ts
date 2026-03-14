/**
 * API: /api/auth/me
 * GET - Returns the current authenticated user's ID and parent profile ID if applicable.
 * Used by client components that need to know the current user identity without
 * embedding it in server-rendered HTML.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Check if this user also has a parent profile
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      parentProfileId: parentProfile?.id ?? null,
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
