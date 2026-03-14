/**
 * API: GET /api/auth/vimeo
 * Initiates the Vimeo OAuth flow by redirecting the user to Vimeo's
 * authorization page. Generates a CSRF state token and stores it in a
 * short-lived httpOnly cookie for verification on the callback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getVimeoAuthUrl } from '@/lib/services/communication/vimeo.service';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Generate a random state token to prevent CSRF attacks
    const state = crypto.randomBytes(32).toString('hex');
    const authUrl = getVimeoAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('vimeo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — enough time to complete the Vimeo authorization page
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Vimeo OAuth initiation error:', error);
    return NextResponse.redirect(new URL('/teams?error=vimeo_auth_failed', request.url));
  }
}
