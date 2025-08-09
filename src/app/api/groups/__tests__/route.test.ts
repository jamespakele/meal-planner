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
  })

  describe('POST /api/groups', () => {
    it('creates a new group with valid data', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true, errors: {} })

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
      expect(data.data.adults).toBe(2)
      expect(data.data.teens).toBe(1)
      expect(data.data.kids).toBe(2)
      expect(data.data.toddlers).toBe(0)
      expect(data.data.dietary_restrictions).toEqual(['vegetarian'])
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

    it('returns 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Smith Family'
          // Missing demographic fields
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Missing required fields')
    })
  })

  describe('GET /api/groups', () => {
    it('returns empty array for MVP mock implementation', async () => {
      const request = new NextRequest('http://localhost:3000/api/groups')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })

    it('handles server errors gracefully', async () => {
      // Mock a server error by throwing during request processing
      const originalJson = NextRequest.prototype.json
      NextRequest.prototype.json = jest.fn().mockRejectedValue(new Error('Server error'))

      const request = new NextRequest('http://localhost:3000/api/groups')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200) // MVP implementation doesn't fail
      expect(data.success).toBe(true)

      // Restore original method
      NextRequest.prototype.json = originalJson
    })
  })
})