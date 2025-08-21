/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardContent from '../DashboardContent'

// Mock the AuthProvider
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false
  })
}))

// Mock the supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    }))
  }
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock user context
const mockUser = { id: 'test-user-id', email: 'test@example.com' }

describe('DashboardContent - checkGeneratedMealsForPlans', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API responses by default
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
      }
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: [
              {
                id: 'test-plan-1',
                name: 'Test Plan',
                week_start: '2023-01-01',
                group_meals: [
                  {
                    group_id: 'test-group-1',
                    meal_count: 5
                  }
                ]
              }
            ]
          })
        })
      }
      if (url.includes('/api/meal-generation/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              jobs: [
                {
                  id: 'job-1',
                  plan_name: 'Test Plan',
                  status: 'completed',
                  total_meals_generated: 5
                }
              ],
              meals: [
                {
                  id: 'meal-1',
                  job_id: 'job-1',
                  title: 'Test Meal'
                }
              ]
            }
          })
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      })
    })
  })

  it('should use API route instead of direct Supabase calls for checking meal generation status', async () => {
    render(<DashboardContent user={mockUser} />)

    // Wait for component to load and call meal status check
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/plans')
    })

    // Verify that it should call the meal generation status API for each plan
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/meal-generation/status?planId=')
      )
    }, { timeout: 3000 })
  })

  it('should handle API errors gracefully when checking meal generation status', async () => {
    // Mock API to return error
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
      }
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: [
              {
                id: 'test-plan-1',
                name: 'Test Plan',
                week_start: '2023-01-01',
                group_meals: [
                  {
                    group_id: 'test-group-1',
                    meal_count: 5
                  }
                ]
              }
            ]
          })
        })
      }
      if (url.includes('/api/meal-generation/status')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Database error' })
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      })
    })

    render(<DashboardContent user={mockUser} />)

    // Wait for component to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/plans')
    })

    // Should not crash when API returns error
    await waitFor(() => {
      expect(screen.getByText('My Groups')).toBeInTheDocument()
    })
  })

  it('should set meal status correctly when meals exist', async () => {
    // Mock API to return meal data
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
      }
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: [
              {
                id: 'test-plan-1',
                name: 'Test Plan',
                week_start: '2023-01-01',
                group_meals: [
                  {
                    group_id: 'test-group-1',
                    meal_count: 5
                  }
                ]
              }
            ]
          })
        })
      }
      if (url.includes('/api/meal-generation/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              jobs: [
                {
                  id: 'job-1',
                  plan_name: 'Test Plan',
                  status: 'completed',
                  total_meals_generated: 5
                }
              ],
              meals: [
                {
                  id: 'meal-1',
                  job_id: 'job-1',
                  title: 'Test Meal'
                }
              ]
            }
          })
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      })
    })

    render(<DashboardContent user={mockUser} />)

    // Wait for component to load and process meal status
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/meal-generation/status?planId=')
      )
    }, { timeout: 3000 })

    // Should show "View Generated Meals" button when meals exist
    await waitFor(() => {
      expect(screen.getByText('View Generated Meals')).toBeInTheDocument()
    })
  })

  it('should set meal status correctly when no meals exist', async () => {
    // Mock API to return empty meal data
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/groups')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
      }
      if (url.includes('/api/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: [
              {
                id: 'test-plan-1',
                name: 'Test Plan',
                week_start: '2023-01-01',
                group_meals: [
                  {
                    group_id: 'test-group-1',
                    meal_count: 5
                  }
                ]
              }
            ]
          })
        })
      }
      if (url.includes('/api/meal-generation/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              jobs: [],
              meals: []
            }
          })
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      })
    })

    render(<DashboardContent user={mockUser} />)

    // Wait for component to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/plans')
    })

    // Should show "Generate Meals" button when no meals exist
    await waitFor(() => {
      expect(screen.getByText('Generate Meals')).toBeInTheDocument()
    })
  })
})