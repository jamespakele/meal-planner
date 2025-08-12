import { NextRequest } from 'next/server'
import { POST } from '../route'
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
})