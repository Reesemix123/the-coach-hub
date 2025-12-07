import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error.message)
      // Include error info in redirect for better debugging
      const errorUrl = new URL(`${origin}/auth/auth-code-error`)
      errorUrl.searchParams.set('error', error.message)
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