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

function getRedirectUrl(request: NextRequest, teamId: string | null, params: string): string {
  if (teamId) {
    return `/football/teams/${teamId}/communication/settings?${params}`;
  }
  return `/dashboard?${params}`;
}

export async function GET(request: NextRequest) {
  // Read teamId from cookie (set during OAuth initiation)
  const teamId = request.cookies.get('vimeo_team_id')?.value ?? null;

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
      const response = NextResponse.redirect(
        new URL(getRedirectUrl(request, teamId, 'error=vimeo_denied'), request.url)
      );
      response.cookies.delete('vimeo_oauth_state');
      response.cookies.delete('vimeo_team_id');
      return response;
    }

    if (!code || !state) {
      const response = NextResponse.redirect(
        new URL(getRedirectUrl(request, teamId, 'error=vimeo_invalid_callback'), request.url)
      );
      response.cookies.delete('vimeo_oauth_state');
      response.cookies.delete('vimeo_team_id');
      return response;
    }

    // Verify state token matches what we stored in the cookie
    const storedState = request.cookies.get('vimeo_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('Vimeo OAuth state mismatch — possible CSRF attempt');
      const response = NextResponse.redirect(
        new URL(getRedirectUrl(request, teamId, 'error=vimeo_state_mismatch'), request.url)
      );
      response.cookies.delete('vimeo_oauth_state');
      response.cookies.delete('vimeo_team_id');
      return response;
    }

    // Exchange the authorization code for an access token
    const { accessToken, user: vimeoUser } = await exchangeCodeForToken(code);

    // Vimeo returns a URI like /users/12345678 — extract the numeric ID
    const accountId = vimeoUser.uri.split('/').pop() ?? '';

    await saveVimeoConnection(user.id, accessToken, accountId, vimeoUser.name);

    // Clear cookies and redirect to settings with success indicator
    const response = NextResponse.redirect(
      new URL(getRedirectUrl(request, teamId, 'vimeo=connected'), request.url)
    );
    response.cookies.delete('vimeo_oauth_state');
    response.cookies.delete('vimeo_team_id');

    return response;
  } catch (error) {
    console.error('Vimeo OAuth callback error:', error);
    const response = NextResponse.redirect(
      new URL(getRedirectUrl(request, teamId, 'error=vimeo_callback_failed'), request.url)
    );
    response.cookies.delete('vimeo_oauth_state');
    response.cookies.delete('vimeo_team_id');
    return response;
  }
}
