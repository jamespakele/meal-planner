import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Create a response that clears all cookies and redirects
  const response = NextResponse.redirect(new URL('/', request.url))
  
  // Clear all potential Supabase cookies
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token', 
    'supabase-auth-token',
    'supabase.auth.token',
    'sb-meal-planner-auth-token'
  ]
  
  cookiesToClear.forEach(cookie => {
    response.cookies.set(cookie, '', { 
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: false
    })
  })
  
  // Also clear any potential localStorage items via a script
  const clearStorageScript = `
    <script>
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    </script>
  `
  
  return new Response(clearStorageScript, {
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': response.headers.getSetCookie().join(', ')
    }
  })
}