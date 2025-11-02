import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

async function getPrimaryTeam(supabase: any, userId: string): Promise<string | null> {
  // Try to get most recently accessed team (we could store this in a cookie later)
  // For now, just get the first team the user owns or is a member of

  // Check owned teams first
  const { data: ownedTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (ownedTeams && ownedTeams.length > 0) {
    return ownedTeams[0].id;
  }

  // Check team memberships
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('team_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1);

  if (memberships && memberships.length > 0) {
    return memberships[0].team_id;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Public routes (marketing pages) - allow access for everyone
  const publicRoutes = ['/', '/about', '/contact', '/pricing']
  const isPublicRoute = publicRoutes.includes(url.pathname)

  // Auth routes - allow access for everyone
  const isAuthRoute = url.pathname.startsWith('/auth')

  // API routes - allow access
  const isApiRoute = url.pathname.startsWith('/api')

  // If public route, auth route, or API route, allow through
  if (isAuthRoute || isApiRoute) {
    return supabaseResponse
  }

  // Protected routes require authentication
  if (!user && !isPublicRoute) {
    const redirectUrl = url.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Logged-in user visiting home page → redirect to primary team
  if (user && url.pathname === '/') {
    const primaryTeamId = await getPrimaryTeam(supabase, user.id)

    if (primaryTeamId) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = `/teams/${primaryTeamId}`
      return NextResponse.redirect(redirectUrl)
    } else {
      // No teams → redirect to team creation
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/teams/new'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirect old top-level routes to team context
  if (user && (url.pathname === '/film' || url.pathname === '/playbook')) {
    const primaryTeamId = await getPrimaryTeam(supabase, user.id)

    if (primaryTeamId) {
      const redirectUrl = url.clone()
      // Map old routes to new team-scoped routes
      if (url.pathname === '/film') {
        redirectUrl.pathname = `/teams/${primaryTeamId}/film`
      } else if (url.pathname === '/playbook') {
        redirectUrl.pathname = `/teams/${primaryTeamId}/playbook`
      }
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}