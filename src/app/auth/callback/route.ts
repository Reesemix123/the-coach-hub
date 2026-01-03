import { createClient, createServiceClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { logAuthEvent, getClientIp, getUserAgent } from '@/lib/services/logging.service'

/**
 * Processes a team invitation after successful authentication.
 * Adds the user to the team and marks the invite as accepted.
 */
async function processTeamInvite(userId: string, inviteToken: string): Promise<{ success: boolean; teamId?: string }> {
  try {
    const serviceClient = createServiceClient();

    // Get the pending invite
    const { data: invite, error: inviteError } = await serviceClient
      .from('team_invites')
      .select('*')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      console.log('Invite not found or already used:', inviteToken);
      return { success: false };
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await serviceClient
        .from('team_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      console.log('Invite expired:', inviteToken);
      return { success: false };
    }

    // Check if already a member
    const { data: existingMembership } = await serviceClient
      .from('team_memberships')
      .select('id, is_active')
      .eq('team_id', invite.team_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMembership?.is_active) {
      // Already a member, just mark invite as accepted
      await serviceClient
        .from('team_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);
      return { success: true, teamId: invite.team_id };
    }

    // Create or reactivate membership
    if (existingMembership) {
      const { error: updateError } = await serviceClient
        .from('team_memberships')
        .update({
          is_active: true,
          role: invite.role,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMembership.id);

      if (updateError) {
        console.error('Failed to reactivate membership:', updateError);
        return { success: false };
      }
    } else {
      const { error: insertError } = await serviceClient
        .from('team_memberships')
        .insert({
          team_id: invite.team_id,
          user_id: userId,
          role: invite.role,
          invited_by: invite.invited_by,
          invited_at: invite.invited_at,
          joined_at: new Date().toISOString(),
          is_active: true
        });

      if (insertError) {
        console.error('Failed to create membership:', insertError);
        return { success: false };
      }
    }

    // Mark invite as accepted
    await serviceClient
      .from('team_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    console.log('Successfully processed invite for user:', userId, 'to team:', invite.team_id);
    return { success: true, teamId: invite.team_id };
  } catch (error) {
    console.error('Error processing team invite:', error);
    return { success: false };
  }
}

/**
 * Ensures a profile exists for the user and updates last_active_at.
 * Also updates user_status for login tracking.
 * This is a fallback in case the database trigger fails.
 */
async function ensureProfileExists(
  userId: string,
  email: string,
  fullName?: string,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  try {
    const serviceClient = createServiceClient();

    // Check if profile exists
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error } = await serviceClient
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: fullName || '',
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to create profile in callback:', error);
      } else {
        console.log('Profile created successfully for user:', userId);
      }
    } else {
      // Profile exists - update last_active_at to mark login
      const { error } = await serviceClient
        .from('profiles')
        .update({
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to update last_active_at:', error);
      }
    }

    // Update user_status table (login count, first/last login)
    const { error: statusError } = await serviceClient.rpc('update_user_login_status', {
      p_user_id: userId,
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent || null
    });

    if (statusError) {
      console.error('Failed to update user_status:', statusError);
      // Don't fail - this is supplementary tracking
    }
  } catch (error) {
    console.error('Error ensuring profile exists:', error);
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Check for error params from Supabase redirect (email verification errors)
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // If Supabase returned an error directly (e.g., from email verification)
  if (error) {
    console.error('Auth callback error from Supabase:', error, errorDescription)

    // Check if this is a PKCE error (email confirmed but opened in different browser)
    if (error === 'access_denied' || errorDescription?.includes('code verifier')) {
      // Email was confirmed but PKCE failed - redirect to login with success message
      const loginUrl = new URL(`${origin}/auth/login`)
      loginUrl.searchParams.set('message', 'Email confirmed! Please sign in with your password.')
      loginUrl.searchParams.set('type', 'success')
      if (next) {
        loginUrl.searchParams.set('next', next)
      }
      return NextResponse.redirect(loginUrl.toString())
    }

    // Other errors - show error page
    const errorUrl = new URL(`${origin}/auth/auth-code-error`)
    errorUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(errorUrl.toString())
  }

  if (code) {
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Auth callback exchange error:', exchangeError.message)

      // Check if this is a PKCE/code verifier error
      // This happens when email link is clicked in different browser than signup
      if (exchangeError.message.includes('code verifier') ||
          exchangeError.message.includes('PKCE') ||
          exchangeError.message.includes('invalid request')) {
        // The email was likely confirmed, redirect to login
        const loginUrl = new URL(`${origin}/auth/login`)
        loginUrl.searchParams.set('message', 'Email confirmed! Please sign in with your password.')
        loginUrl.searchParams.set('type', 'success')
        if (next) {
          loginUrl.searchParams.set('next', next)
        }
        return NextResponse.redirect(loginUrl.toString())
      }

      // Include error info in redirect for better debugging
      const errorUrl = new URL(`${origin}/auth/auth-code-error`)
      errorUrl.searchParams.set('error', exchangeError.message)
      return NextResponse.redirect(errorUrl.toString())
    }

    // Successfully authenticated - determine where to route the user
    const user = data?.user
    const selectedTier = user?.user_metadata?.selected_tier
    const fullName = user?.user_metadata?.full_name

    // Ensure profile exists (fallback in case trigger failed)
    if (user?.id && user?.email) {
      const ipAddress = getClientIp(new Headers(request.headers));
      const userAgent = getUserAgent(new Headers(request.headers));
      await ensureProfileExists(user.id, user.email, fullName, ipAddress, userAgent);
    }

    // Log successful auth event (signup or login via OAuth/magic link)
    const isNewUser = user?.created_at &&
      (new Date().getTime() - new Date(user.created_at).getTime()) < 60000; // Created within last minute

    await logAuthEvent({
      userId: user?.id || null,
      userEmail: user?.email || null,
      action: isNewUser ? 'signup' : 'login',
      status: 'success',
      ipAddress: getClientIp(new Headers(request.headers)) || undefined,
      userAgent: getUserAgent(new Headers(request.headers)) || undefined,
      metadata: {
        auth_provider: user?.app_metadata?.provider || 'email',
        via_callback: true,
        selected_tier: selectedTier || null,
      },
    });

    // Check for invite code in user metadata or next URL
    const inviteCode = user?.user_metadata?.invite_code;
    let inviteRedirectTeamId: string | undefined;

    if (inviteCode && user?.id) {
      console.log('Processing invite code:', inviteCode);
      const inviteResult = await processTeamInvite(user.id, inviteCode);
      if (inviteResult.success && inviteResult.teamId) {
        inviteRedirectTeamId = inviteResult.teamId;
      }
    }

    // If there's an explicit next URL, check if it contains invite param
    if (next) {
      // Check if next URL has an invite param
      const nextUrl = new URL(next, origin);
      const nextInvite = nextUrl.searchParams.get('invite');
      if (nextInvite && user?.id && !inviteCode) {
        const inviteResult = await processTeamInvite(user.id, nextInvite);
        if (inviteResult.success && inviteResult.teamId) {
          inviteRedirectTeamId = inviteResult.teamId;
        }
      }

      // If invite was processed, redirect to team page instead of next URL
      if (inviteRedirectTeamId) {
        return NextResponse.redirect(`${origin}/teams/${inviteRedirectTeamId}?welcome=invited`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    // If invite was processed, redirect to team page
    if (inviteRedirectTeamId) {
      return NextResponse.redirect(`${origin}/teams/${inviteRedirectTeamId}?welcome=invited`)
    }

    // Route based on selected tier
    if (selectedTier && selectedTier !== 'basic') {
      // Paid tier - redirect to checkout
      return NextResponse.redirect(`${origin}/checkout?tier=${selectedTier}`)
    } else {
      // Free tier (basic) or no tier - go to setup to create team
      return NextResponse.redirect(`${origin}/setup`)
    }
  }

  // No code provided
  console.error('Auth callback: No code provided in URL')
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
}