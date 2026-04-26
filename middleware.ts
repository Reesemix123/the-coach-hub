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

  // Auth routes - allow access for everyone (desktop /auth/* and mobile /m/auth/*)
  const isAuthRoute = url.pathname.startsWith('/auth') || url.pathname.startsWith('/m/auth')

  // API routes - allow access
  const isApiRoute = url.pathname.startsWith('/api')

  // If public route, auth route, or API route, allow through
  if (isAuthRoute || isApiRoute) {
    return supabaseResponse
  }

  // Protected routes require authentication
  if (!user && !isPublicRoute) {
    const redirectUrl = url.clone()
    // Mobile paths redirect to mobile auth page
    const isMobilePath = url.pathname.startsWith('/m/') || url.pathname.startsWith('/p/')
    redirectUrl.pathname = isMobilePath ? '/m/auth' : '/auth/login'
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Mobile redirect: Capacitor WebView or explicit ?mobile=1
  // Capacitor injects a custom user-agent substring; we also allow a query param override
  const isMobileRoute = url.pathname.startsWith('/m/')
  if (user && !isMobileRoute) {
    const ua = request.headers.get('user-agent') ?? ''
    const isCapacitor = ua.includes('CapacitorHTTP') || ua.includes('capacitor')
    const hasMobileParam = url.searchParams.get('mobile') === '1'

    if (isCapacitor || hasMobileParam) {
      // Map coach dashboard entry points to mobile equivalents
      const mobileEntryPoints = ['/', '/dashboard']
      if (mobileEntryPoints.includes(url.pathname)) {
        const redirectUrl = url.clone()
        redirectUrl.pathname = '/m/home'
        redirectUrl.searchParams.delete('mobile')
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // Logged-in user visiting home page → redirect to primary team or parent dashboard
  if (user && url.pathname === '/') {
    // Check if user is a parent
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (parentProfile) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/parent'
      return NextResponse.redirect(redirectUrl)
    }

    const primaryTeamId = await getPrimaryTeam(supabase, user.id)

    if (primaryTeamId) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    } else {
      // No teams → redirect to team creation
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/setup'
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
        redirectUrl.pathname = `/football/teams/${primaryTeamId}/film`
      } else if (url.pathname === '/playbook') {
        redirectUrl.pathname = `/football/teams/${primaryTeamId}/playbook`
      }
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirect pure parents from /guide to /parent/guide
  // Dual-role users (coach + parent) can still access /guide for coach docs
  if (user && url.pathname.startsWith('/guide')) {
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!coachProfile) {
      // Pure parent — no coach profile — redirect to parent guide
      const { data: parentProfile } = await supabase
        .from('parent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (parentProfile) {
        const redirectUrl = url.clone()
        redirectUrl.pathname = url.pathname.replace(/^\/guide/, '/parent/guide')
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // Gate /test-hub routes — require is_tester or is_platform_admin
  if (user && url.pathname.startsWith('/test-hub')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_tester, is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_tester && !profile?.is_platform_admin) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Gate /film-capture routes — require film_capture_access on profiles or parent_profiles
  if (user && url.pathname.startsWith('/film-capture')) {
    const [{ data: coachProfile }, { data: parentProfile }] = await Promise.all([
      supabase.from('profiles').select('film_capture_access').eq('id', user.id).maybeSingle(),
      supabase.from('parent_profiles').select('film_capture_access').eq('user_id', user.id).maybeSingle(),
    ])

    if (!coachProfile?.film_capture_access && !parentProfile?.film_capture_access) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/dashboard'
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