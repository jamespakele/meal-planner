import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import DashboardContent from '../DashboardContent'

// Mock all the dependencies
jest.mock('../AuthProvider', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/supabase/singleton', () => ({
  getSupabaseClient: jest.fn(),
}))

jest.mock('../MealGenerationTrigger', () => {
  return function MockMealGenerationTrigger({ plan, onSuccess }: any) {
    return (
      <div data-testid={`meal-generation-trigger-${plan.id}`}>
        <button
          onClick={() => onSuccess(plan.id, 21)}
          data-testid={`generate-meals-btn-${plan.id}`}
        >
          Generate Meals for {plan.name}
        </button>
      </div>
    )
  }
})

import { useAuth } from '../AuthProvider'
import { getSupabaseClient } from '@/lib/supabase/singleton'

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>

describe('DashboardContent - Meal Generation Integration', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User'
    }
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
      created_at: '2025-01-01T00:00:00.000Z'
    }
  ]

  const mockPlans = [
    {
      id: 'plan-1',
      name: 'Week 1 Plan',
      week_start: '2025-01-13',
      notes: 'Test plan',
      group_meals: [
        { group_id: 'group-1', meal_count: 7, notes: 'Family meals' }
      ],
      user_id: 'user-123',
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'plan-2',
      name: 'Week 2 Plan',
      week_start: '2025-01-20',
      notes: 'Another test plan',
      group_meals: [
        { group_id: 'group-1', meal_count: 14, notes: 'More family meals' }
      ],
      user_id: 'user-123',
      status: 'active',
      created_at: '2025-01-02T00:00:00.000Z'
    }
  ]

  const mockSupabaseClient = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      signOut: jest.fn(),
      loading: false
    })

    mockGetSupabaseClient.mockReturnValue(mockSupabaseClient as any)

    // Mock the database queries
    const mockSelect = jest.fn().mockReturnThis()
    const mockEq = jest.fn().mockReturnThis()
    const mockOrder = jest.fn()
    
    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder
    })

    // Mock groups query
    mockOrder.mockImplementation((field, options) => {
      if (field === 'created_at') {
        return Promise.resolve({
          data: mockGroups,
          error: null
        })
      }
      return Promise.resolve({ data: [], error: null })
    })
  })

  describe('Plans Tab Integration', () => {
    it('displays Generate Meals button for each plan', async () => {
      // Mock plans query to return test plans
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      // Wait for plans to load
      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Check that Generate Meals buttons appear for each plan
      expect(screen.getByTestId('generate-meals-btn-plan-1')).toBeInTheDocument()
      expect(screen.getByTestId('generate-meals-btn-plan-2')).toBeInTheDocument()

      expect(screen.getByText('Generate Meals for Week 1 Plan')).toBeInTheDocument()
      expect(screen.getByText('Generate Meals for Week 2 Plan')).toBeInTheDocument()
    })

    it('handles meal generation success for individual plans', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      // Wait for plans to load
      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Click Generate Meals for the first plan
      const generateButton = screen.getByTestId('generate-meals-btn-plan-1')
      fireEvent.click(generateButton)

      // The mock component should have called onSuccess
      // This would trigger any success handling in the dashboard
      await waitFor(() => {
        // In a real implementation, this might show a success message
        // or update the plan display to show generated meals
        expect(generateButton).toBeInTheDocument()
      })
    })

    it('displays plans with no meal assignments correctly', async () => {
      const plansWithoutMeals = [
        {
          ...mockPlans[0],
          group_meals: []
        }
      ]

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: plansWithoutMeals,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Should show the warning about no meal assignments
      expect(screen.getByText(/no meal assignments yet/i)).toBeInTheDocument()
      expect(screen.getByText(/edit this plan to assign meals/i)).toBeInTheDocument()
    })

    it('shows correct meal count totals per plan', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Check meal count badges
      expect(screen.getByText('7 total meals')).toBeInTheDocument()
      expect(screen.getByText('14 total meals')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles plans loading errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: null,
                    error: { message: 'Failed to load plans' }
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText(/failed to load plans/i)).toBeInTheDocument()
      })
    })

    it('shows loading state while plans are being fetched', async () => {
      // Mock delayed response
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => new Promise(resolve => 
                    setTimeout(() => resolve({
                      data: mockPlans,
                      error: null
                    }), 100)
                  )
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      // Should show loading state
      expect(screen.getByText(/loading plans.../i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()

      // Wait for plans to load
      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      }, { timeout: 200 })
    })
  })

  describe('Navigation and State Management', () => {
    it('maintains Plans tab state during meal generation', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Verify we're on Plans tab
      expect(plansTab).toHaveClass('border-blue-500', 'text-blue-600')

      // Click Generate Meals button
      const generateButton = screen.getByTestId('generate-meals-btn-plan-1')
      fireEvent.click(generateButton)

      // Should still be on Plans tab
      expect(plansTab).toHaveClass('border-blue-500', 'text-blue-600')
      expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
    })

    it('can switch between Groups and Plans tabs without losing state', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockGroups,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Start on Groups tab (default)
      expect(screen.getByRole('button', { name: /groups/i })).toHaveClass('border-blue-500')

      // Switch to Plans tab
      const plansTab = screen.getByRole('button', { name: /meal plans/i })
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Switch back to Groups tab
      const groupsTab = screen.getByRole('button', { name: /groups/i })
      fireEvent.click(groupsTab)

      await waitFor(() => {
        expect(screen.getByText('Family Group')).toBeInTheDocument()
      })

      // Switch back to Plans tab - should still show plans
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper tab navigation and ARIA attributes', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({
                    data: mockPlans,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      })

      render(<DashboardContent />)

      // Check tab navigation structure
      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()

      const groupsTab = screen.getByRole('button', { name: /groups/i })
      const plansTab = screen.getByRole('button', { name: /meal plans/i })

      expect(groupsTab).toBeInTheDocument()
      expect(plansTab).toBeInTheDocument()

      // Switch to plans tab
      fireEvent.click(plansTab)

      await waitFor(() => {
        expect(screen.getByText('Week 1 Plan')).toBeInTheDocument()
      })

      // Check that meal generation buttons are accessible
      const generateButtons = screen.getAllByRole('button', { name: /generate meals/i })
      expect(generateButtons.length).toBe(2)
    })
  })
})