/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST, GET } from '../route'

// Mock validation functions
jest.mock('@/lib/groupValidation', () => ({
  validateGroup: jest.fn(),
  sanitizeGroupName: jest.fn((name: string) => name.trim())
}))

const { validateGroup: mockValidateGroup } = jest.requireMock('@/lib/groupValidation')

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
}

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => mockSupabaseClient
}))

describe('/api/groups', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful auth by default
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null
    })
  })

  describe('POST /api/groups', () => {
    it('creates a new group with valid data', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true, errors: {} })
      
      // Mock Supabase chain
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'group-123',
          name: 'Smith Family',
          adults: 2,
          teens: 1,
          kids: 2,
          toddlers: 0,
          dietary_restrictions: ['vegetarian'],
          created_at: '2024-01-01T00:00:00.000Z'
        },
        error: null
      })
      
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Smith Family',
          adults: 2,
          teens: 1,
          kids: 2,
          toddlers: 0,
          dietary_restrictions: ['vegetarian']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Smith Family')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('groups')
    })

    it('returns 400 for invalid group data', async () => {
      mockValidateGroup.mockReturnValue({
        isValid: false,
        errors: {
          name: ['Name is required'],
          adults: ['adults must be a non-negative integer']
        }
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          adults: -1,
          teens: 0,
          kids: 0,
          toddlers: 0
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors).toEqual({
        name: ['Name is required'],
        adults: ['adults must be a non-negative integer']
      })
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Smith Family',
          adults: 2,
          teens: 1,
          kids: 2,
          toddlers: 0
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('GET /api/groups', () => {
    it('returns user groups successfully', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Smith Family',
          adults: 2,
          teens: 1,
          kids: 2,
          toddlers: 0,
          dietary_restrictions: ['vegetarian'],
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockGroups,
              error: null
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/groups')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Smith Family')
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' }
      })

      const request = new NextRequest('http://localhost:3000/api/groups')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })
  })
})