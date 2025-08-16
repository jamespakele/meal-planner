import { GET } from '../callback/route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Next.js cookies function
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }))
}))

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock NextResponse redirect
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    redirect: jest.fn((url: string) => 
      new Response(null, { status: 302, headers: { Location: url } })
    )
  }
}))

describe('/api/auth/callback', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn()
      }
    }
    mockCreateClient.mockResolvedValue(mockSupabase)
    jest.clearAllMocks()
  })

  it('should redirect to dashboard on successful OAuth exchange', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'token' } },
      error: null
    })

    const url = 'http://localhost:3000/auth/callback?code=oauth_code_123'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth_code_123')
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard')
  })

  it('should redirect to dashboard with custom next parameter', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'token' } },
      error: null
    })

    const url = 'http://localhost:3000/auth/callback?code=oauth_code_123&next=/dashboard/groups'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth_code_123')
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard/groups')
  })

  it('should redirect to error page when OAuth exchange fails', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid OAuth code' }
    })

    const url = 'http://localhost:3000/auth/callback?code=invalid_code'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('invalid_code')
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/auth-code-error')
  })

  it('should redirect to error page when no OAuth code is provided', async () => {
    const url = 'http://localhost:3000/auth/callback'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/auth-code-error')
  })

  it('should redirect to error page when user is null despite successful exchange', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: { access_token: 'token' } },
      error: null
    })

    const url = 'http://localhost:3000/auth/callback?code=oauth_code_123'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth_code_123')
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/auth-code-error')
  })

  it('should handle Supabase client creation errors', async () => {
    mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

    const url = 'http://localhost:3000/auth/callback?code=oauth_code_123'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/auth-code-error')
  })

  it('should handle OAuth exchange exceptions', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockRejectedValue(
      new Error('OAuth service unavailable')
    )

    const url = 'http://localhost:3000/auth/callback?code=oauth_code_123'
    const request = new NextRequest(url)
    
    const response = await GET(request)
    
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/auth-code-error')
  })
})