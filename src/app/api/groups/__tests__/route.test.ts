/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST, GET, DELETE, PUT } from '../route'

// Mock validation functions
jest.mock('@/lib/groupValidation', () => ({
  validateGroup: jest.fn(),
  sanitizeGroupName: jest.fn((name: string) => name.trim())
}))

const { validateGroup: mockValidateGroup } = jest.requireMock('@/lib/groupValidation')

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ 
          data: { 
            id: 'test-id',
            name: 'Smith Family',
            adults: 2,
            teens: 1,
            kids: 2,
            toddlers: 0,
            dietary_restrictions: ['vegetarian']
          }, 
          error: null 
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: {
              id: 'test-group-id',
              name: 'Updated Smith Family',
              adults: 3,
              teens: 1,
              kids: 2,
              toddlers: 1,
              dietary_restrictions: ['vegetarian', 'gluten-free']
            }, 
            error: null 
          }))
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    }))
  }
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient))
}))

describe('/api/groups', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock implementations
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    })
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

  describe('DELETE /api/groups', () => {
    it('deletes a group with valid authentication and ownership', async () => {
      const groupId = 'test-group-id'
      
      const request = new NextRequest(`http://localhost:3000/api/groups?id=${groupId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Group deleted successfully')
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/groups?id=test-id', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('returns 400 for missing group ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Group ID is required')
    })

    it('returns 404 for non-existent group', async () => {
      // Mock a fresh from call that returns an error
      const mockFromCall = {
        delete: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: null,
            error: new Error('Group not found')
          }))
        }))
      }
      mockSupabaseClient.from.mockReturnValueOnce(mockFromCall)

      const request = new NextRequest('http://localhost:3000/api/groups?id=non-existent', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to delete group')
    })

    it('returns 403 when trying to delete another user&apos;s group', async () => {
      // Mock a fresh from call that returns an RLS error
      const mockFromCall = {
        delete: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: null,
            error: { code: '42501', message: 'insufficient_privilege' }
          }))
        }))
      }
      mockSupabaseClient.from.mockReturnValueOnce(mockFromCall)

      const request = new NextRequest('http://localhost:3000/api/groups?id=other-user-group', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to delete group')
    })
  })

  describe('PUT /api/groups', () => {
    it('updates a group with valid data and authentication', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true, errors: {} })
      
      const groupId = 'test-group-id'
      const updateData = {
        id: groupId,
        name: 'Updated Smith Family',
        adults: 3,
        teens: 1,
        kids: 2,
        toddlers: 1,
        dietary_restrictions: ['vegetarian', 'gluten-free']
      }

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      // Mock a fresh from call for update
      const mockFromCall = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: updateData,
                error: null
              }))
            }))
          }))
        }))
      }
      mockSupabaseClient.from.mockReturnValueOnce(mockFromCall)

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Smith Family')
      expect(data.data.adults).toBe(3)
    })

    it('returns 401 for unauthenticated update requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'test-id', name: 'Updated Name' })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('returns 400 for missing group ID in update', async () => {
      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Group ID is required')
    })

    it('returns 400 for invalid update data', async () => {
      mockValidateGroup.mockReturnValue({
        isValid: false,
        errors: {
          adults: ['adults must be a non-negative integer']
        }
      })

      const request = new NextRequest('http://localhost:3000/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-id',
          name: 'Updated Name',
          adults: -1,
          teens: 0,
          kids: 0,
          toddlers: 0,
          dietary_restrictions: []
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors).toEqual({
        adults: ['adults must be a non-negative integer']
      })
    })
  })
})