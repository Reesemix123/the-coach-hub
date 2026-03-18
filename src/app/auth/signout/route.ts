/**
 * API: /auth/signout
 * POST - Sign out the current user and redirect to login
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), {
    status: 302,
  });
}
