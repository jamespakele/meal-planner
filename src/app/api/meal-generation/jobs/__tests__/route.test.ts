import { NextRequest } from 'next/server'

// Mock the Supabase client before importing the route
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

jest.mock('@/lib/planValidation', () => ({
  validatePlan: jest.fn(),
  sanitizePlanName: jest.fn(name => name)
}))

jest.mock('@/lib/mealGenerator', () => ({
  validatePlanForGeneration: jest.fn(),
  buildGroupContexts: jest.fn()
}))

jest.mock('@/lib/mockStorage', () => ({
  getStoredGroups: jest.fn()
}))

describe('API Route: /api/meal-generation/jobs', () => {
  let mockSupabaseClient: any
  let mockValidatePlan: any
  let mockValidatePlanForGeneration: any
  let mockBuildGroupContexts: any
  let mockGetStoredGroups: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup mock implementations
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis()
    }

    const { createClient } = require('@/lib/supabase/server')
    createClient.mockReturnValue(mockSupabaseClient)

    mockValidatePlan = require('@/lib/planValidation').validatePlan
    mockValidatePlanForGeneration = require('@/lib/mealGenerator').validatePlanForGeneration
    mockBuildGroupContexts = require('@/lib/mealGenerator').buildGroupContexts
    mockGetStoredGroups = require('@/lib/mockStorage').getStoredGroups
  })

  describe('Missing Dependencies', () => {
    test('should handle missing Supabase client gracefully', async () => {
      // Simulate missing Supabase client by making createClient throw
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockImplementation(() => {
        throw new Error("Module not found: Can't resolve '@/lib/supabase/server'")
      })

      // Import the route handler after setting up the mock
      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    test('should handle missing validation functions', async () => {
      // Setup auth to succeed
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Make validatePlan throw (simulating missing dependency)
      mockValidatePlan.mockImplementation(() => {
        throw new Error("Module not found: Can't resolve '@/lib/planValidation'")
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    test('should handle missing meal generator functions', async () => {
      // Setup successful auth and validation
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })

      // Make validatePlanForGeneration throw
      mockValidatePlanForGeneration.mockImplementation(() => {
        throw new Error("Module not found: Can't resolve '@/lib/mealGenerator'")
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    test('should handle missing storage functions', async () => {
      // Setup successful auth and validation
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })
      mockValidatePlanForGeneration.mockReturnValue({ isValid: true, errors: [] })

      // Make getStoredGroups throw
      mockGetStoredGroups.mockImplementation(() => {
        throw new Error("Module not found: Can't resolve '@/lib/mockStorage'")
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('Successful Flow', () => {
    test('should create job successfully when all dependencies are available', async () => {
      // Setup all mocks for successful flow
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })
      mockValidatePlanForGeneration.mockReturnValue({ isValid: true, errors: [] })
      mockGetStoredGroups.mockReturnValue([
        { id: 'test-group', name: 'Test Group', adults: 2, teens: 1, kids: 0, toddlers: 0, dietary_restrictions: [] }
      ])
      mockBuildGroupContexts.mockReturnValue([
        {
          group_id: 'test-group',
          group_name: 'Test Group',
          demographics: { adults: 2, teens: 1, kids: 0, toddlers: 0 },
          dietary_restrictions: [],
          meal_count_requested: 3,
          adult_equivalent: 3.2
        }
      ])

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'job-123', status: 'pending' },
        error: null
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: 'Test notes'
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.jobId).toBe('job-123')
      expect(data.status).toBe('pending')
      expect(data.message).toBe('Meal generation job started successfully')
    })
  })

  describe('Authentication Errors', () => {
    test('should return 401 for missing authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user')
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: 'Test Plan',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Validation Errors', () => {
    test('should return 400 for invalid plan data', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockValidatePlan.mockReturnValue({
        isValid: false,
        errors: { name: ['Plan name is required'] }
      })

      const { POST } = require('../route')

      const mockRequest = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({
          planData: {
            name: '',
            week_start: '2024-01-01',
            group_meals: [{ group_id: 'test-group', meal_count: 3 }],
            notes: ''
          }
        })
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid plan data')
      expect(data.details).toEqual({ name: ['Plan name is required'] })
    })
  })
})