// /api/user/tos - Terms of Service acceptance API
// Allows users to accept/view TOS status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const CURRENT_TOS_VERSION = '2024-12-01';

/**
 * GET /api/user/tos
 * Get current user's TOS acceptance status
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tos_accepted_at, tos_version')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    accepted: !!profile?.tos_accepted_at,
    accepted_at: profile?.tos_accepted_at,
    accepted_version: profile?.tos_version,
    current_version: CURRENT_TOS_VERSION,
    needs_update: profile?.tos_version !== CURRENT_TOS_VERSION,
  });
}

/**
 * POST /api/user/tos
 * Accept Terms of Service
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || null;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      tos_accepted_at: new Date().toISOString(),
      tos_version: CURRENT_TOS_VERSION,
      tos_accepted_ip: clientIp,
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('TOS acceptance error:', updateError);
    return NextResponse.json(
      { error: 'Failed to accept Terms of Service' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    accepted_at: new Date().toISOString(),
    version: CURRENT_TOS_VERSION,
  });
}
