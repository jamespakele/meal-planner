/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../../app/api/meal-generation/status/route'

// Test for the parameter mismatch between frontend and API
describe('API Parameter Mismatch Tests', () => {
  // Mock Supabase client
  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      })),
      in: jest.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      }))
    }
  }

  // Mock the Supabase server module
  jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(() => Promise.resolve(mockSupabaseClient))
  }))

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    })
  })

  describe('Plan ID vs Plan Name Parameter Issue', () => {
    it('should currently fail because frontend sends plan.id but API expects plan_name', async () => {
      // This test demonstrates the current bug:
      // Frontend: plan.id (UUID like "6b2aca5a-791f-4574-b679-a61258045977")
      // API: .eq('plan_name', planId) - looks up by plan_name field instead of ID
      
      const planId = '6b2aca5a-791f-4574-b679-a61258045977' // This is a plan ID (UUID)
      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${planId}`)
      
      const response = await GET(request)
      const data = await response.json()

      console.log('Current API response with plan ID:', { status: response.status, data })

      // Currently this will succeed but return empty results because:
      // - It's looking for plan_name = "6b2aca5a-791f-4574-b679-a61258045977" 
      // - But plan_name should be something like "Week of 2025-08-17"
      // - So it finds no matching jobs
      
      expect(response.status).toBe(200) // API doesn't fail, just returns empty
      expect(data.success).toBe(true)
      expect(data.data.jobs).toEqual([]) // Empty because wrong field lookup
    })

    it('should work correctly when API is fixed to use proper field mapping', async () => {
      // This test shows what should happen:
      // We should either:
      // 1. Change API to look up by plan ID, or  
      // 2. Change frontend to send plan name
      
      const planName = 'Week of 2025-08-17' // This is what should be sent
      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${encodeURIComponent(planName)}`)
      
      // Mock some matching jobs for this plan name
      const mockJobs = [
        {
          id: 'job-1',
          plan_name: planName,
          status: 'completed',
          progress: 100,
          total_meals_generated: 5,
          created_at: '2023-01-01T00:00:00.000Z'
        }
      ]

      // Update mock to return the jobs
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockJobs, error: null }))
            }))
          }))
        }))
      }).mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })
      
      const response = await GET(request)
      const data = await response.json()

      console.log('Fixed API response with plan name:', { status: response.status, data })

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.jobs).toEqual(mockJobs) // Should find the jobs
    })

    it('should demonstrate the frontend parameter format issue', () => {
      // This test documents the exact issue:
      // Frontend code in DashboardContent.tsx line 445:
      // `planId=${encodeURIComponent(plan.id)}`
      // 
      // But plan.id is a UUID, not the plan_name field that jobs are stored with
      
      const frontendPlan = {
        id: '6b2aca5a-791f-4574-b679-a61258045977',  // This is the UUID
        name: 'Week of 2025-08-17',                   // This is what jobs.plan_name contains
        week_start: '2025-08-17',
        group_meals: []
      }

      // Frontend currently sends plan.id:
      const frontendSentValue = frontendPlan.id
      console.log('Frontend sends:', frontendSentValue)
      
      // API looks for plan_name equal to this value:
      console.log('API looks for plan_name =', frontendSentValue)
      
      // But jobs table has plan_name =', frontendPlan.name
      console.log('Jobs table actually has plan_name =', frontendPlan.name)
      
      // This is why the lookup fails!
      expect(frontendSentValue).not.toBe(frontendPlan.name)
    })
  })

  describe('API Query Chain Issue', () => {
    it('should handle the double .eq() chain correctly', async () => {
      // Test that the query chain works without TypeScript/runtime errors
      // The issue was: .eq('user_id', user.id).eq('plan_name', planId)
      
      const request = new NextRequest('http://localhost:3000/api/meal-generation/status?planId=test-plan')
      
      const response = await GET(request)
      const data = await response.json()

      console.log('Query chain test:', { status: response.status, data })

      // Should not get "eq is not a function" error
      expect(response.status).not.toBe(500)
      expect(data.error).not.toContain('eq is not a function')
    })
  })
})