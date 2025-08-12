import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Mock validation functions
jest.mock('@/lib/planValidation', () => ({
  validatePlan: jest.fn(),
  validatePlanForGeneration: jest.fn(),
}))

import { validatePlan, validatePlanForGeneration } from '@/lib/planValidation'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockValidatePlan = validatePlan as jest.MockedFunction<typeof validatePlan>
const mockValidatePlanForGeneration = validatePlanForGeneration as jest.MockedFunction<typeof validatePlanForGeneration>

describe('/api/plans/[id]/generate-meals - POST', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  }

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockPlan = {
    id: 'plan-123',
    name: 'Test Plan',
    week_start: '2025-01-13',
    notes: 'Test notes',
    user_id: 'user-123',
    status: 'active',
    created_at: '2025-01-01T00:00:00.000Z',
  }

  const mockGroups = [
    {
      id: 'group-1',
      name: 'Family Group',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian'],
      user_id: 'user-123',
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockResolvedValue(mockSupabaseClient as any)
    
    // Mock successful validation by default
    mockValidatePlan.mockReturnValue({ isValid: true, errors: [] })
    mockValidatePlanForGeneration.mockReturnValue({ isValid: true, errors: [] })
  })

  const createMockRequest = (body?: any): NextRequest => {
    return {
      json: jest.fn().mockResolvedValue(body || {}),
    } as any
  }

  const createMockParams = (id: string) => Promise.resolve({ id })

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('returns 401 when authentication check fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Plan Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
    })

    it('returns 404 when plan does not exist', async () => {
      const mockFrom = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: null,
                error: { message: 'Plan not found' },
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = createMockRequest()
      const params = createMockParams('nonexistent-plan')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Plan not found or access denied')
    })

    it('returns 404 when user does not own the plan', async () => {
      const unauthorizedPlan = { ...mockPlan, user_id: 'other-user' }
      
      const mockFrom = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: unauthorizedPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Plan not found or access denied')
    })

    it('handles malformed JSON in request body', async () => {
      const mockFrom = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      // Create request with malformed JSON
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any

      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON in request body')
    })
  })

  describe('Groups Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock plan fetch
      const planQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      // Mock groups fetch
      const groupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') return planQuery
        if (table === 'groups') return groupsQuery
        return planQuery // fallback
      })
    })

    it('returns 400 when user has no active groups', async () => {
      // Override groups query to return empty array
      const emptyGroupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: mockPlan,
                  error: null,
                }),
              }),
            }),
          }),
        }
        if (table === 'groups') return emptyGroupsQuery
        return emptyGroupsQuery
      })

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No active groups found. Please create groups first.')
    })

    it('handles groups fetch error', async () => {
      const errorGroupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: mockPlan,
                  error: null,
                }),
              }),
            }),
          }),
        }
        if (table === 'groups') return errorGroupsQuery
        return errorGroupsQuery
      })

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch user groups')
    })
  })

  describe('Plan Data Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const planQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      const groupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') return planQuery
        if (table === 'groups') return groupsQuery
        return planQuery
      })
    })

    it('returns 400 when plan data validation fails', async () => {
      mockValidatePlan.mockReturnValue({
        isValid: false,
        errors: ['Name is required', 'Week start is invalid'],
      })

      const request = createMockRequest({
        group_meals: [{ group_id: 'group-1', meal_count: 7 }],
      })
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid plan data for generation')
      expect(data.details).toEqual(['Name is required', 'Week start is invalid'])
    })

    it('returns 400 when generation validation fails', async () => {
      mockValidatePlan.mockReturnValue({ isValid: true, errors: [] })
      mockValidatePlanForGeneration.mockReturnValue({
        isValid: false,
        errors: ['No meals requested for any group'],
      })

      const request = createMockRequest({
        group_meals: [{ group_id: 'group-1', meal_count: 0 }],
      })
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Plan validation failed for meal generation')
      expect(data.details).toEqual(['No meals requested for any group'])
    })
  })

  describe('Job Creation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const planQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      const groupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') return planQuery
        if (table === 'groups') return groupsQuery
        return planQuery
      })
    })

    it('successfully creates meal generation job', async () => {
      const mockJobId = 'job-456'
      
      // Mock job creation
      const jobInsertQuery = {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: mockJobId, status: 'pending' },
              error: null,
            }),
          }),
        }),
      }

      // Mock plan update
      const planUpdateQuery = {
        update: () => ({
          eq: () => Promise.resolve({
            error: null,
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans' && mockSupabaseClient.from.mock.calls.length > 2) {
          return planUpdateQuery
        }
        if (table === 'meal_generation_jobs') {
          return jobInsertQuery
        }
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: mockPlan,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return jobInsertQuery
      })

      const request = createMockRequest({
        group_meals: [{ group_id: 'group-1', meal_count: 7, notes: 'Test meals' }],
      })
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.jobId).toBe(mockJobId)
      expect(data.status).toBe('pending')
      expect(data.message).toBe('Meal generation job created successfully')
      expect(data.planId).toBe('plan-123')
    })

    it('handles job creation database error', async () => {
      const jobInsertQuery = {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { message: 'Database constraint violation' },
            }),
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_generation_jobs') {
          return jobInsertQuery
        }
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: mockPlan,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return jobInsertQuery
      })

      const request = createMockRequest({
        group_meals: [{ group_id: 'group-1', meal_count: 7 }],
      })
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create meal generation job')
    })

    it('continues when plan status update fails', async () => {
      const mockJobId = 'job-789'
      
      const jobInsertQuery = {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: mockJobId, status: 'pending' },
              error: null,
            }),
          }),
        }),
      }

      // Mock plan update failure
      const planUpdateQuery = {
        update: () => ({
          eq: () => Promise.resolve({
            error: { message: 'Update failed' },
          }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans' && mockSupabaseClient.from.mock.calls.length > 2) {
          return planUpdateQuery
        }
        if (table === 'meal_generation_jobs') {
          return jobInsertQuery
        }
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: mockPlan,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return jobInsertQuery
      })

      const request = createMockRequest({
        group_meals: [{ group_id: 'group-1', meal_count: 7 }],
      })
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      // Should still succeed even if plan update fails
      expect(response.status).toBe(201)
      expect(data.jobId).toBe(mockJobId)
    })
  })

  describe('Default Group Meals', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
    })

    it('uses default group meals when none provided in request', async () => {
      const mockJobId = 'job-default'
      
      const planQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockPlan,
                error: null,
              }),
            }),
          }),
        }),
      }

      const groupsQuery = {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      }

      const jobInsertQuery = {
        insert: jest.fn().mockReturnValue({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: mockJobId, status: 'pending' },
              error: null,
            }),
          }),
        }),
      }

      const planUpdateQuery = {
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans' && mockSupabaseClient.from.mock.calls.length > 2) {
          return planUpdateQuery
        }
        if (table === 'meal_generation_jobs') {
          return jobInsertQuery
        }
        if (table === 'meal_plans') return planQuery
        if (table === 'groups') return groupsQuery
        return jobInsertQuery
      })

      const request = createMockRequest({}) // No group_meals provided
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.jobId).toBe(mockJobId)

      // Verify that default group meals were used (7 meals for each group)
      expect(jobInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          groups_data: expect.arrayContaining([
            expect.objectContaining({
              id: 'group-1',
              name: 'Family Group',
            }),
          ]),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('handles unexpected errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()
      const params = createMockParams('plan-123')

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})