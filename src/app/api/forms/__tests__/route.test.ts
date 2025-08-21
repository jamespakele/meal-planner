import { POST, GET, DELETE } from '../route'
import { createClient } from '@/lib/supabase/server'

// Mock the Supabase client
jest.mock('@/lib/supabase/server')
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock URL shortener
jest.mock('@/lib/urlShortener', () => ({
  generateShortCode: jest.fn((role: 'co_manager' | 'other') => 
    role === 'co_manager' ? 'cm123abc' : 'ot456def'
  ),
  generatePublicUrl: jest.fn((shortCode: string) => 
    `https://app.com/f/${shortCode}`
  ),
  cacheShortCodeMapping: jest.fn()
}))

// Mock utils
jest.mock('@/lib/utils', () => ({
  generateSecureToken: jest.fn(() => 'mock-secure-token-12345'),
  successResponse: jest.fn((data, status = 200) => 
    Response.json({ success: true, data }, { status })
  ),
  errorResponse: jest.fn((message, status = 400) => 
    Response.json({ success: false, error: message }, { status })
  )
}))

describe('/api/forms', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn()
      }))
    }
    mockCreateClient.mockResolvedValue(mockSupabase)
    
    // Clear console logs for tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/forms - Generate form links', () => {
    it('should generate dual form links for authenticated user', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      // Mock plan lookup
      mockSupabase.from().single.mockResolvedValueOnce({
        data: { id: 'plan123', week_start: '2025-08-17' },
        error: null
      })

      // Mock existing links check
      mockSupabase.from().select().eq().is().mockResolvedValueOnce({
        data: [],
        error: null
      })

      // Mock form link creation
      mockSupabase.from().upsert().select().single.mockResolvedValue({
        data: { 
          id: 'link123', 
          plan_id: 'plan123',
          public_token: 'mock-secure-token-12345',
          role: 'co_manager',
          created_at: new Date().toISOString()
        },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({ plan_id: 'plan123' }),
        headers: { 'content-type': 'application/json' }
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = new NextRequest('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({ plan_id: 'plan123' }),
        headers: { 'content-type': 'application/json' }
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 for missing plan_id', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' }
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should return 404 for non-existent plan', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      mockSupabase.from().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Plan not found' }
      })

      const request = new NextRequest('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({ plan_id: 'nonexistent' }),
        headers: { 'content-type': 'application/json' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })
  })

  describe('GET /api/forms - Get existing form links', () => {
    it('should return existing form links for authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      const mockFormLinks = [
        {
          id: 'link1',
          plan_id: 'plan123',
          public_token: 'token1',
          role: 'co_manager',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: null
        },
        {
          id: 'link2',
          plan_id: 'plan123',
          public_token: 'token2',
          role: 'other',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: null
        }
      ]

      mockSupabase.from().select().eq().is().order().mockResolvedValue({
        data: mockFormLinks,
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms?plan_id=plan123')

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should return 400 for missing plan_id', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms')

      const response = await GET(request)
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/forms - Revoke form links', () => {
    it('should revoke form links for authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      mockSupabase.from().update().eq().is().select.mockResolvedValue({
        data: [
          { id: 'link1', plan_id: 'plan123', role: 'co_manager' },
          { id: 'link2', plan_id: 'plan123', role: 'other' }
        ],
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms?plan_id=plan123', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      expect(response.status).toBe(200)
    })

    it('should revoke specific role only when specified', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'link1', plan_id: 'plan123', role: 'co_manager' }],
          error: null
        })
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const request = new NextRequest('http://localhost:3000/api/forms?plan_id=plan123&role=co_manager', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      expect(response.status).toBe(200)
      expect(mockQuery.eq).toHaveBeenCalledWith('role', 'co_manager')
    })
  })

  describe('Rate limiting', () => {
    it('should enforce rate limits on form generation', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({ plan_id: 'plan123' }),
        headers: { 
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.1'
        }
      })

      // Make multiple requests rapidly
      const promises = Array(12).fill(null).map(() => POST(request))
      const responses = await Promise.all(promises)

      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })
})