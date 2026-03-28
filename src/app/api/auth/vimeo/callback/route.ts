/**
 * API: GET /api/auth/vimeo/callback
 * Handles the Vimeo OAuth callback after the user authorizes (or denies) access.
 * Verifies the CSRF state cookie, exchanges the authorization code for an access
 * token, persists the connection, and redirects the coach to their settings page.
 *
 * Error query params surfaced on redirect:
 *   - vimeo_denied         — user rejected the Vimeo permission prompt
 *   - vimeo_invalid_callback — code or state missing from callback URL
 *   - vimeo_state_mismatch — state cookie missing or does not match (possible CSRF)
 *   - vimeo_callback_failed  — token exchange or DB write failed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  exchangeCodeForToken,
  saveVimeoConnection,
} from '@/lib/services/communication/vimeo.service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    // User clicked "Deny" on the Vimeo permissions page
    if (oauthError) {
      console.warn('Vimeo OAuth denied:', oauthError);
      return NextResponse.redirect(new URL('/football/teams?error=vimeo_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/football/teams?error=vimeo_invalid_callback', request.url));
    }

    // Verify state token matches what we stored in the cookie
    const storedState = request.cookies.get('vimeo_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('Vimeo OAuth state mismatch — possible CSRF attempt');
      return NextResponse.redirect(new URL('/football/teams?error=vimeo_state_mismatch', request.url));
    }

    // Exchange the authorization code for an access token
    const { accessToken, user: vimeoUser } = await exchangeCodeForToken(code);

    // Vimeo returns a URI like /users/12345678 — extract the numeric ID
    const accountId = vimeoUser.uri.split('/').pop() ?? '';

    await saveVimeoConnection(user.id, accessToken, accountId, vimeoUser.name);

    // Clear the state cookie and send the coach to their settings page
    const response = NextResponse.redirect(new URL('/football/teams?vimeo=connected', request.url));
    response.cookies.delete('vimeo_oauth_state');

    return response;
  } catch (error) {
    console.error('Vimeo OAuth callback error:', error);
    return NextResponse.redirect(new URL('/football/teams?error=vimeo_callback_failed', request.url));
  }
}
