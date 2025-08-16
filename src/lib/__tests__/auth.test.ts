import { getAuthenticatedUser, validateFormLinkToken } from '../utils'
import { createClient } from '../supabase/server'

// Mock the Next.js cookies function
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }))
}))

// Mock the Supabase client
jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('Auth Utilities', () => {
  let mockRequest: any
  let mockSupabase: any

  beforeEach(() => {
    mockRequest = { url: 'http://localhost:3000/api/test' }
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }
    mockCreateClient.mockResolvedValue(mockSupabase)
    jest.clearAllMocks()
  })

  describe('getAuthenticatedUser', () => {
    it('should return user when authentication is successful', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const result = await getAuthenticatedUser(mockRequest)

      expect(result.user).toEqual(mockUser)
      expect(result.error).toBeNull()
      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1)
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' }
      })

      const result = await getAuthenticatedUser(mockRequest)

      expect(result.user).toBeNull()
      expect(result.error).toBe('User not found')
    })

    it('should return error when no user is present but no auth error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const result = await getAuthenticatedUser(mockRequest)

      expect(result.user).toBeNull()
      expect(result.error).toBe('Authentication required')
    })

    it('should handle Supabase client creation errors', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

      const result = await getAuthenticatedUser(mockRequest)

      expect(result.user).toBeNull()
      expect(result.error).toBe('Authentication failed')
    })

    it('should handle auth.getUser errors', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth service unavailable'))

      const result = await getAuthenticatedUser(mockRequest)

      expect(result.user).toBeNull()
      expect(result.error).toBe('Authentication failed')
    })
  })

  describe('validateFormLinkToken', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
          })
        })
      })
    })

    it('should return valid token when token is found and not expired', async () => {
      const mockFormLink = {
        id: 'link-123',
        plan_id: 'plan-456',
        public_token: 'valid-token',
        role: 'co_manager',
        expires_at: new Date(Date.now() + 60000).toISOString() // 1 minute from now
      }

      const mockQuery = {
        single: jest.fn().mockResolvedValue({
          data: mockFormLink,
          error: null
        })
      }
      mockSupabase.from().select().eq.mockReturnValue(mockQuery)

      const result = await validateFormLinkToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.formLink).toEqual(mockFormLink)
      expect(result.error).toBeNull()
      expect(mockSupabase.from).toHaveBeenCalledWith('form_links')
    })

    it('should return invalid when token is not found', async () => {
      const mockQuery = {
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'No rows returned' }
        })
      }
      mockSupabase.from().select().eq.mockReturnValue(mockQuery)

      const result = await validateFormLinkToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.formLink).toBeNull()
      expect(result.error).toBe('Invalid token')
    })

    it('should return invalid when token is expired', async () => {
      const mockFormLink = {
        id: 'link-123',
        plan_id: 'plan-456',
        public_token: 'expired-token',
        role: 'other',
        expires_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      }

      const mockQuery = {
        single: jest.fn().mockResolvedValue({
          data: mockFormLink,
          error: null
        })
      }
      mockSupabase.from().select().eq.mockReturnValue(mockQuery)

      const result = await validateFormLinkToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.formLink).toBeNull()
      expect(result.error).toBe('Token expired')
    })

    it('should handle tokens without expiration date', async () => {
      const mockFormLink = {
        id: 'link-123',
        plan_id: 'plan-456',
        public_token: 'no-expiry-token',
        role: 'co_manager',
        expires_at: null
      }

      const mockQuery = {
        single: jest.fn().mockResolvedValue({
          data: mockFormLink,
          error: null
        })
      }
      mockSupabase.from().select().eq.mockReturnValue(mockQuery)

      const result = await validateFormLinkToken('no-expiry-token')

      expect(result.valid).toBe(true)
      expect(result.formLink).toEqual(mockFormLink)
      expect(result.error).toBeNull()
    })

    it('should handle database errors', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

      const result = await validateFormLinkToken('some-token')

      expect(result.valid).toBe(false)
      expect(result.formLink).toBeNull()
      expect(result.error).toBe('Token validation failed')
    })
  })
})