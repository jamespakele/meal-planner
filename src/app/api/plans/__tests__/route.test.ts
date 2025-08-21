import { NextRequest } from 'next/server'
import { POST, GET, DELETE, PUT } from '../route'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('/api/plans API Route', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }
    
    mockCreateClient.mockResolvedValue(mockSupabase)
  })

  describe('POST /api/plans - Plan Creation Only', () => {
    it('should create plan successfully with valid authentication', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      })

      // Mock successful plan creation
      const mockPlanData = {
        id: 'plan-123',
        name: 'Test Plan',
        week_start: '2024-01-01',
        notes: 'Test notes',
        user_id: 'user-123',
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockPlanData,
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01',
          notes: 'Test notes'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(201)
      expect(responseData.plan).toEqual(mockPlanData)
      expect(responseData.message).toBe('Plan created successfully')

      // Verify database operations
      expect(mockSupabase.from).toHaveBeenCalledWith('meal_plans')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        name: 'Test Plan',
        week_start: '2024-01-01',
        notes: 'Test notes',
        user_id: 'user-123',
        status: 'draft'
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      // Mock authentication failure
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Authentication required')

      // Should not attempt database operations
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
          notes: 'Just notes'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Plan name and week_start are required')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock database error
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to create plan')
      expect(responseData.details).toBe('Database connection failed')
    })

    it('should sanitize plan name', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'plan-123' },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '  Test Plan with Extra Spaces  ',
          week_start: '2024-01-01'
        })
      })

      await POST(request)

      // Should insert with trimmed name
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Plan with Extra Spaces'
        })
      )
    })

    it('should handle optional notes field', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'plan-123' },
        error: null
      })

      // Test without notes
      const requestWithoutNotes = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      await POST(requestWithoutNotes)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: undefined
        })
      )

      jest.clearAllMocks()

      // Test with notes
      const requestWithNotes = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01',
          notes: 'Some notes'
        })
      })

      await POST(requestWithNotes)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Some notes'
        })
      )
    })
  })

  describe('Authentication Edge Cases', () => {
    it('should handle Supabase client creation errors', async () => {
      // Mock client creation failure
      mockCreateClient.mockRejectedValue(new Error('Failed to create Supabase client'))

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Internal server error')
    })

    it('should handle malformed JSON requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{'
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Invalid JSON in request body')
    })

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toContain('request body')
    })
  })

  describe('Response Format', () => {
    it('should return consistent response format for success', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockPlanData = {
        id: 'plan-123',
        name: 'Test Plan',
        status: 'draft'
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockPlanData,
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      // Should have consistent structure
      expect(responseData).toHaveProperty('plan')
      expect(responseData).toHaveProperty('message')
      expect(responseData.plan).toEqual(mockPlanData)
      expect(typeof responseData.message).toBe('string')
    })

    it('should return consistent error format', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Plan',
          week_start: '2024-01-01'
        })
      })

      const response = await POST(request)
      const responseData = await response.json()

      // Should have consistent error structure
      expect(responseData).toHaveProperty('error')
      expect(typeof responseData.error).toBe('string')
    })
  })

  describe('DELETE /api/plans - Plan Deletion', () => {
    it('should delete a plan with valid authentication and ownership', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock successful deletion
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/plans?id=plan-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Plan deleted successfully')
    })

    it('should return 401 for unauthenticated deletion requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/plans?id=plan-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Authentication required')
    })

    it('should return 400 for missing plan ID', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Plan ID is required')
    })

    it('should handle RLS policy violations', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock RLS policy violation
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { code: '42501', message: 'insufficient_privilege' }
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/plans?id=other-user-plan', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to delete plan')
    })
  })

  describe('PUT /api/plans - Plan Updates', () => {
    it('should update a plan with valid data and authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const updateData = {
        id: 'plan-123',
        name: 'Updated Plan Name',
        week_start: '2024-02-01',
        notes: 'Updated notes'
      }

      // Mock successful update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: updateData,
                error: null
              })
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      const response = await PUT(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(updateData)
    })

    it('should return 401 for unauthenticated update requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'plan-123', name: 'Updated Name' })
      })

      const response = await PUT(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Authentication required')
    })

    it('should return 400 for missing plan ID in update', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' })
      })

      const response = await PUT(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Plan ID is required')
    })

    it('should validate required fields for update', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'plan-123'
          // Missing required fields
        })
      })

      const response = await PUT(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Plan name and week_start are required')
    })

    it('should handle database errors during update', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock database error
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'plan-123',
          name: 'Updated Plan',
          week_start: '2024-02-01'
        })
      })

      const response = await PUT(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to update plan')
    })
  })

  describe('GET /api/plans - Plan Listing', () => {
    it('should list user plans with valid authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockPlans = [
        {
          id: 'plan-1',
          name: 'Plan 1',
          week_start: '2024-01-01',
          status: 'draft'
        },
        {
          id: 'plan-2',
          name: 'Plan 2',
          week_start: '2024-01-08',
          status: 'finalized'
        }
      ]

      // Mock plans query
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockPlans,
              error: null
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'GET'
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.plans).toEqual(mockPlans)
    })

    it('should return 401 for unauthenticated GET requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'GET'
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Authentication required')
    })
  })
})