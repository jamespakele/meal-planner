import { POST } from '../route'
import { NextRequest } from 'next/server'
import { validateFormLinkToken } from '@/lib/utils'
import { resolveShortCode } from '@/lib/urlShortener'
import { createClient } from '@/lib/supabase/server'

// Mock dependencies
jest.mock('@/lib/utils')
jest.mock('@/lib/urlShortener')
jest.mock('@/lib/supabase/server')

const mockValidateFormLinkToken = validateFormLinkToken as jest.MockedFunction<typeof validateFormLinkToken>
const mockResolveShortCode = resolveShortCode as jest.MockedFunction<typeof resolveShortCode>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('/api/form-responses POST', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
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

  describe('Successful submissions', () => {
    it('should accept valid form submission with direct token', async () => {
      const mockFormLink = {
        id: 'link123',
        plan_id: 'plan123',
        role: 'co_manager',
        public_token: 'direct-token-123'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'response123',
          form_link_id: 'link123',
          form_link_role: 'co_manager',
          submitted_at: new Date().toISOString(),
          selections: [{ meal_id: 'meal1', selected: true }]
        },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000',
          'x-forwarded-for': '192.168.1.1'
        },
        body: JSON.stringify({
          token: 'direct-token-123',
          selections: [{ meal_id: 'meal1', selected: true }],
          comments: 'Looks great!'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.response.role).toBe('co_manager')
      expect(responseData.data.next_steps.thank_you_url).toBe('/f/direct-token-123/thank-you')
    })

    it('should accept valid form submission with short code', async () => {
      const mockFormLink = {
        id: 'link456',
        plan_id: 'plan456',
        role: 'other',
        public_token: 'full-token-456'
      }

      mockResolveShortCode.mockReturnValue({
        shortCode: 'ot456def',
        publicToken: 'full-token-456',
        role: 'other',
        createdAt: new Date(),
        views: 5
      })

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'response456',
          form_link_id: 'link456',
          form_link_role: 'other',
          submitted_at: new Date().toISOString(),
          selections: [{ meal_id: 'meal2', selected: true }]
        },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000',
          'x-forwarded-for': '192.168.1.1'
        },
        body: JSON.stringify({
          token: 'ot456def',
          selections: [{ meal_id: 'meal2', selected: true }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.response.role).toBe('other')
    })

    it('should handle duplicate submissions with idempotency', async () => {
      const mockFormLink = {
        id: 'link789',
        plan_id: 'plan789',
        role: 'co_manager',
        public_token: 'token-789'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      // Mock existing response found
      mockSupabase.from().select().eq().eq().gte().limit.mockResolvedValue({
        data: [{
          id: 'existing-response',
          submitted_at: new Date().toISOString()
        }],
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'token-789',
          selections: [{ meal_id: 'meal3', selected: true }],
          idempotency_key: 'unique-key-123'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.data.duplicate).toBe(true)
    })
  })

  describe('Validation and security', () => {
    it('should reject submissions with invalid token', async () => {
      mockValidateFormLinkToken.mockResolvedValue({
        valid: false,
        formLink: null,
        error: 'Invalid token'
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'invalid-token',
          selections: [{ meal_id: 'meal1', selected: true }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should reject submissions with missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'valid-token'
          // missing selections
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should reject submissions with invalid selections format', async () => {
      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'valid-token',
          selections: 'not-an-array'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should sanitize comments to prevent XSS', async () => {
      const mockFormLink = {
        id: 'link-xss',
        plan_id: 'plan-xss',
        role: 'other',
        public_token: 'token-xss'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      let capturedComments: string | null = null
      mockSupabase.from().insert().select().single.mockImplementation((data: any) => {
        capturedComments = data.comments
        return Promise.resolve({
          data: {
            id: 'response-xss',
            form_link_id: 'link-xss',
            form_link_role: 'other',
            submitted_at: new Date().toISOString()
          },
          error: null
        })
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'token-xss',
          selections: [{ meal_id: 'meal1', selected: true }],
          comments: 'Great meal! <script>alert("xss")</script> Love it!'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      // Check that script tags were removed
      expect(capturedComments).toBe('Great meal!  Love it!')
      expect(capturedComments).not.toContain('<script>')
    })

    it('should enforce CSRF protection with invalid origin', async () => {
      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://evil.com',
          'host': 'localhost:3000'
        },
        body: JSON.stringify({
          token: 'valid-token',
          selections: [{ meal_id: 'meal1', selected: true }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('should truncate very long comments', async () => {
      const mockFormLink = {
        id: 'link-long',
        plan_id: 'plan-long',
        role: 'co_manager',
        public_token: 'token-long'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      let capturedComments: string | null = null
      mockSupabase.from().insert().select().single.mockImplementation((data: any) => {
        capturedComments = data.comments
        return Promise.resolve({
          data: {
            id: 'response-long',
            form_link_id: 'link-long',
            form_link_role: 'co_manager',
            submitted_at: new Date().toISOString()
          },
          error: null
        })
      })

      const longComment = 'A'.repeat(1500) // 1500 characters
      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'token-long',
          selections: [{ meal_id: 'meal1', selected: true }],
          comments: longComment
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)

      // Check that comments were truncated to 1000 characters
      expect(capturedComments).toHaveLength(1000)
      expect(capturedComments).toBe('A'.repeat(1000))
    })
  })

  describe('Rate limiting', () => {
    it('should enforce rate limits', async () => {
      const mockFormLink = {
        id: 'link-rate',
        plan_id: 'plan-rate',
        role: 'other',
        public_token: 'token-rate'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'response-rate',
          form_link_id: 'link-rate',
          form_link_role: 'other',
          submitted_at: new Date().toISOString()
        },
        error: null
      })

      const createRequest = () => new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'test-agent'
        },
        body: JSON.stringify({
          token: 'token-rate',
          selections: [{ meal_id: 'meal1', selected: true }]
        })
      })

      // Make 6 rapid requests (limit is 5)
      const promises = Array(6).fill(null).map(() => POST(createRequest()))
      const responses = await Promise.all(promises)

      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Database errors', () => {
    it('should handle database insertion errors gracefully', async () => {
      const mockFormLink = {
        id: 'link-error',
        plan_id: 'plan-error',
        role: 'co_manager',
        public_token: 'token-error'
      }

      mockValidateFormLinkToken.mockResolvedValue({
        valid: true,
        formLink: mockFormLink,
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      const request = new NextRequest('http://localhost:3000/api/form-responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          token: 'token-error',
          selections: [{ meal_id: 'meal1', selected: true }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const responseData = await response.json()
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to submit response')
    })
  })
})