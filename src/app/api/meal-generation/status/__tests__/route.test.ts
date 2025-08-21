/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      in: jest.fn(() => Promise.resolve({ data: [], error: null }))
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

describe('/api/meal-generation/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock implementations
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    })
  })

  describe('GET /api/meal-generation/status', () => {
    it('returns meal generation status for authenticated user with valid plan ID', async () => {
      const planId = 'test-plan-id'
      const mockJobs = [
        {
          id: 'job-1',
          plan_name: planId,
          status: 'completed',
          progress: 100,
          current_step: 'Completed',
          total_meals_generated: 5,
          error_message: null,
          created_at: '2023-01-01T00:00:00.000Z',
          started_at: '2023-01-01T00:01:00.000Z',
          completed_at: '2023-01-01T00:05:00.000Z'
        }
      ]
      const mockMeals = [
        {
          id: 'meal-1',
          job_id: 'job-1',
          group_name: 'Test Group',
          title: 'Test Meal',
          selected: false
        }
      ]

      // Mock the jobs query
      const mockJobsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ 
                data: mockJobs, 
                error: null 
              }))
            }))
          }))
        }))
      }

      // Mock the meals query
      const mockMealsQuery = {
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({ 
            data: mockMeals, 
            error: null 
          }))
        }))
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockJobsQuery)
        .mockReturnValueOnce(mockMealsQuery)

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.jobs).toEqual(mockJobs)
      expect(data.data.meals).toEqual(mockMeals)
    })

    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('No user')
      })

      const request = new NextRequest('http://localhost:3000/api/meal-generation/status?planId=test-plan')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    it('returns 400 for missing plan ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/meal-generation/status')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Plan ID is required')
    })

    it('returns 500 when jobs query fails', async () => {
      const planId = 'test-plan-id'
      
      // Mock jobs query to fail
      const mockJobsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ 
                data: null, 
                error: new Error('Database error') 
              }))
            }))
          }))
        }))
      }

      mockSupabaseClient.from.mockReturnValueOnce(mockJobsQuery)

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch meal generation status')
    })

    it('returns 500 when meals query fails', async () => {
      const planId = 'test-plan-id'
      const mockJobs = [{ id: 'job-1', plan_name: planId }]

      // Mock jobs query to succeed
      const mockJobsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ 
                data: mockJobs, 
                error: null 
              }))
            }))
          }))
        }))
      }

      // Mock meals query to fail
      const mockMealsQuery = {
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: new Error('Database error') 
          }))
        }))
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockJobsQuery)
        .mockReturnValueOnce(mockMealsQuery)

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch generated meals')
    })

    it('returns empty arrays when no jobs or meals exist', async () => {
      const planId = 'test-plan-id'

      // Mock empty results
      const mockJobsQuery = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ 
                data: [], 
                error: null 
              }))
            }))
          }))
        }))
      }

      const mockMealsQuery = {
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({ 
            data: [], 
            error: null 
          }))
        }))
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockJobsQuery)
        .mockReturnValueOnce(mockMealsQuery)

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.jobs).toEqual([])
      expect(data.data.meals).toEqual([])
    })

    it('handles unexpected server errors gracefully', async () => {
      const planId = 'test-plan-id'
      
      // Mock Supabase client to throw an unexpected error
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })
  })
})