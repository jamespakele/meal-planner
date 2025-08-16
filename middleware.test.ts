import { middleware } from './middleware'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

// Mock NextResponse static methods
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => new Response()),
    json: jest.fn((data: any, init: any) => 
      new Response(JSON.stringify(data), { status: init?.status || 200 })
    ),
    redirect: jest.fn((url: string) => 
      new Response(null, { status: 302, headers: { Location: url } })
    )
  }
}))

describe('Middleware Authentication', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    }
    mockCreateClient.mockResolvedValue(mockSupabase)
    jest.clearAllMocks()
  })

  describe('Public routes', () => {
    const publicRoutes = [
      'http://localhost:3000/',
      'http://localhost:3000/_next/static/chunks/main.js',
      'http://localhost:3000/auth/login',
      'http://localhost:3000/auth/callback',
      'http://localhost:3000/api/test',
      'http://localhost:3000/form/abc123',
      'http://localhost:3000/favicon.ico'
    ]

    publicRoutes.forEach(url => {
      it(`should allow access to public route: ${url}`, async () => {
        const request = new NextRequest(url)
        
        const response = await middleware(request)
        
        expect(NextResponse.next).toHaveBeenCalled()
        expect(mockSupabase.auth.getUser).not.toHaveBeenCalled()
      })
    })
  })

  describe('Protected API routes', () => {
    it('should allow authenticated users to access API routes', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/groups')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1)
    })

    it('should return 401 for unauthenticated API requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const request = new NextRequest('http://localhost:3000/api/groups')
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    })

    it('should handle auth service errors for API routes', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/plans')
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      )
    })
  })

  describe('Protected dashboard routes', () => {
    it('should allow authenticated users to access dashboard', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/dashboard')
      
      const response = await middleware(request)
      
      expect(NextResponse.next).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1)
    })

    it('should redirect unauthenticated users to login page', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const request = new NextRequest('http://localhost:3000/dashboard')
      
      const response = await middleware(request)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/?redirectTo=%2Fdashboard', 'http://localhost:3000')
      )
    })

    it('should redirect to login with error on auth service failure', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/dashboard/plans')
      
      const response = await middleware(request)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/?error=auth_failed', 'http://localhost:3000')
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle auth errors gracefully for API routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null // No user but no error either
      })

      const request = new NextRequest('http://localhost:3000/api/meal-generation/jobs')
      
      const response = await middleware(request)
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    })

    it('should handle auth errors gracefully for dashboard routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null // No user but no error either
      })

      const request = new NextRequest('http://localhost:3000/dashboard/groups')
      
      const response = await middleware(request)
      
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/?redirectTo=%2Fdashboard%2Fgroups', 'http://localhost:3000')
      )
    })
  })
})