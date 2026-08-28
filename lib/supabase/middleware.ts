import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line.
  // getSession() reads the JWT from cookies without a network call, which is
  // appropriate here: middleware only needs to know whether a session exists
  // for routing. Server Components and API routes call getUser() for
  // cryptographic validation where it matters.
  let user = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    user = session?.user ?? null
  } catch (err) {
    console.error('[middleware] getSession failed:', err)
  }

  const { pathname, searchParams } = request.nextUrl

  // Routes that are always accessible — including the invite/recovery landing page.
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/set-password') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  // Supabase appends ?type=invite or ?type=recovery to email links.
  const authType = searchParams.get('type')
  const isInviteOrRecovery = authType === 'invite' || authType === 'recovery'

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Invite/recovery: always land on set-password, never dashboard.
    // Guard: skip if already there to prevent /auth/set-password → /auth/set-password loop.
    if (isInviteOrRecovery && pathname !== '/auth/set-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/set-password'
      // Preserve the type param so the set-password page knows why it's there.
      url.searchParams.set('type', authType!)
      return NextResponse.redirect(url)
    }

    // Normal logged-in user on /login: send to dashboard.
    // Skip for invite/recovery flows (handled above) and /auth/set-password
    // (already where they need to be) — both guards prevent looping.
    if (pathname === '/login' && !isInviteOrRecovery) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
