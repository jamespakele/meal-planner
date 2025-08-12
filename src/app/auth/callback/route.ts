import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error && data?.user) {
        console.log('OAuth success:', data.user.email)
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.error('OAuth exchange error:', error)
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
    }
  } else {
    console.log('No OAuth code received')
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}