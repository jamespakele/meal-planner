import { GET, POST } from '../route'
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

describe('/api/groups Authentication', () => {
  let mockSupabase: any
  let mockRequest: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: {}, error: null }))
          }))
        }))
      }))
    }
    mockCreateClient.mockResolvedValue(mockSupabase)

    // Mock request object
    mockRequest = {
      json: jest.fn(),
      headers: new Map(),
      url: 'http://localhost:3000/api/groups'
    }

    jest.clearAllMocks()
  })

  describe('GET /api/groups', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const response = await GET(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('should return groups when user is authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockGroups = [
        { id: 'group-1', name: 'Test Group 1', user_id: 'user-123' },
        { id: 'group-2', name: 'Test Group 2', user_id: 'user-123' }
      ]

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockGroups,
              error: null
            })
          })
        })
      })

      const response = await GET(mockRequest as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockGroups)
      expect(mockSupabase.from).toHaveBeenCalledWith('groups')
    })

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/groups')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch groups')
    })
  })

  describe('POST /api/groups', () => {
    const validGroupData = {
      name: 'Test Group',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian']
    }

    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        body: JSON.stringify(validGroupData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('should create group when user is authenticated and data is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockCreatedGroup = {
        id: 'group-123',
        ...validGroupData,
        user_id: 'user-123',
        status: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedGroup,
              error: null
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        body: JSON.stringify(validGroupData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockCreatedGroup)
      expect(mockSupabase.from).toHaveBeenCalledWith('groups')
    })

    it('should return 400 for invalid input data', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const invalidData = {
        name: 'Test Group',
        adults: -1, // Invalid negative value
        teens: 1,
        kids: 2,
        toddlers: 0
      }

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors).toBeDefined()
    })

    it('should handle database insertion errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database insertion failed' }
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        body: JSON.stringify(validGroupData)
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to create group')
    })
  })
})