import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

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

    // If there's an explicit next URL, use it
    if (next) {
      return NextResponse.redirect(`${origin}${next}`)
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