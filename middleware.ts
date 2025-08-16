import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/test') ||
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/form/') // Public meal selection forms
  ) {
    return NextResponse.next()
  }

  // Protect API routes (except public form endpoints)
  if (pathname.startsWith('/api/')) {
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
      }

      return NextResponse.next()
    } catch (error) {
      console.error('Middleware auth error:', error)
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      )
    }
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        // Redirect to login page
        const redirectUrl = new URL('/', request.url)
        redirectUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(redirectUrl)
      }

      return NextResponse.next()
    } catch (error) {
      console.error('Middleware auth error:', error)
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('error', 'auth_failed')
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}