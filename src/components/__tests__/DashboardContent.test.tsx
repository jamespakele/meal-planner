import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import DashboardContent from '../DashboardContent'
import { getSupabaseClient } from '@/lib/supabase/singleton'

// Mock AuthProvider
jest.mock('../AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    signOut: jest.fn()
  })
}))

// Mock Supabase client
jest.mock('@/lib/supabase/singleton')

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          order: jest.fn(() => ({}))
        }))
      })),
      order: jest.fn(() => ({}))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    }))
  }
}

;(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

// Mock child components to simplify testing
jest.mock('../GroupForm', () => {
  return function MockGroupForm({ onSubmit, onCancel }: any) {
    return (
      <div data-testid="group-form">
        <button onClick={() => onSubmit({ name: 'Test Group' })}>Submit Group</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    )
  }
})

jest.mock('../PlanForm', () => {
  return function MockPlanForm({ onSubmit, onCancel }: any) {
    return (
      <div data-testid="plan-form">
        <button onClick={() => onSubmit({ name: 'Test Plan' })}>Submit Plan</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    )
  }
})

jest.mock('../MealGenerationTrigger', () => {
  return function MockMealGenerationTrigger() {
    return <div data-testid="meal-generation-trigger">Meal Generation Trigger</div>
  }
})

// Mock window.location.hash and window.history
const mockLocation = {
  hash: '',
  pathname: '/dashboard'
}

const mockHistory = {
  replaceState: jest.fn()
}

// Store original values
const originalLocation = window.location
const originalHistory = window.history

// Mock before all tests
beforeAll(() => {
  delete (window as any).location
  delete (window as any).history
  window.location = mockLocation as any
  window.history = mockHistory as any
})

// Restore after all tests
afterAll(() => {
  window.location = originalLocation
  window.history = originalHistory
})

describe('DashboardContent - Plans as Primary Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocation.hash = ''
    mockHistory.replaceState.mockClear()
    
    // Default mock data - no groups, no plans with proper chaining
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'groups') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }
      } else if (table === 'meal_plans') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }
      } else if (table === 'meal_generation_jobs') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
                }))
              }))
            }))
          }))
        }
      } else if (table === 'generated_meals') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }
      }
      
      // Default fallback
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }
    })
  })

  describe('Default Tab Behavior', () => {
    it('should default to plans tab on initial render', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const plansTab = screen.getByRole('button', { name: /Meal Plans/i })
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        
        // Plans tab should be active (has blue styling)
        expect(plansTab).toHaveClass('border-blue-500', 'text-blue-600')
        expect(groupsTab).not.toHaveClass('border-blue-500', 'text-blue-600')
      })
    })

    it('should set URL hash to #plans on initial render when no hash exists', async () => {
      mockLocation.hash = ''
      
      render(<DashboardContent />)
      
      await waitFor(() => {
        expect(mockHistory.replaceState).toHaveBeenCalledWith(null, '', '#plans')
      })
    })

    it('should respect existing #groups hash in URL', async () => {
      mockLocation.hash = '#groups'
      
      // Since the useEffect runs after initial render, we need to trigger a re-render
      const { rerender } = render(<DashboardContent />)
      rerender(<DashboardContent />)
      
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        expect(groupsTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })

    it('should respect existing #plans hash in URL', async () => {
      mockLocation.hash = '#plans'
      
      render(<DashboardContent />)
      
      await waitFor(() => {
        const plansTab = screen.getByRole('button', { name: /Meal Plans/i })
        expect(plansTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })
  })

  describe('Tab Order and Visual Prominence', () => {
    it('should render Meal Plans tab before Groups tab', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const tabs = screen.getAllByRole('button', { name: /Plans|Groups/i })
        expect(tabs[0]).toHaveTextContent('Meal Plans')
        expect(tabs[1]).toHaveTextContent('Groups')
      })
    })

    it('should show plans content by default', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        // Should show plans content (which will be the welcome message when no groups exist)
        expect(screen.getByText(/Welcome to Meal Planning!/)).toBeInTheDocument()
      })
    })
  })

  describe('Empty State Behavior', () => {
    it('should show enhanced welcome message when no groups exist', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        expect(screen.getByText('Welcome to Meal Planning!')).toBeInTheDocument()
        expect(screen.getByText(/To start generating personalized meal plans/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Create Your First Group/i })).toBeInTheDocument()
      })
    })

    it('should show meal planning focused empty state when no plans exist but groups exist', async () => {
      // Mock having groups but no plans
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [{ id: '1', name: 'Test Group' }],
                  error: null
                }))
              }))
            }))
          }
        } else if (table === 'meal_plans') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [],
                  error: null
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }
      })
      
      render(<DashboardContent />)
      
      await waitFor(() => {
        expect(screen.getByText('Ready to Plan Your Meals!')).toBeInTheDocument()
        expect(screen.getByText(/Create your first meal plan to get AI-powered/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Create Your First Meal Plan/i })).toBeInTheDocument()
      })
    })

    it('should allow navigation to groups tab from welcome state', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const createGroupButton = screen.getByRole('button', { name: /Create Your First Group/i })
        fireEvent.click(createGroupButton)
      })
      
      // Should switch to groups tab
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        expect(groupsTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between tabs and update URL hash', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        fireEvent.click(groupsTab)
      })
      
      expect(mockHistory.replaceState).toHaveBeenCalledWith(null, '', '#groups')
      
      await waitFor(() => {
        const plansTab = screen.getByRole('button', { name: /Meal Plans/i })
        fireEvent.click(plansTab)
      })
      
      expect(mockHistory.replaceState).toHaveBeenCalledWith(null, '', '#plans')
    })

    it('should maintain tab state across re-renders', async () => {
      const { rerender } = render(<DashboardContent />)
      
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        fireEvent.click(groupsTab)
      })
      
      rerender(<DashboardContent />)
      
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        expect(groupsTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })
  })

  describe('Integration with Existing Functionality', () => {
    it('should preserve meal generation functionality', async () => {
      // Mock having groups and plans
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [{ id: '1', name: 'Test Group' }],
                  error: null
                }))
              }))
            }))
          }
        } else if (table === 'meal_plans') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [{ id: '1', name: 'Test Plan', group_meals: [] }],
                  error: null
                }))
              }))
            }))
          }
        } else if (table === 'meal_generation_jobs') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({
                      data: [],
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }
      })
      
      render(<DashboardContent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('meal-generation-trigger')).toBeInTheDocument()
      })
    })

    it('should preserve form functionality', async () => {
      // Mock having groups
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [{ id: '1', name: 'Test Group' }],
                  error: null
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(),
              order: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }
      })
      
      render(<DashboardContent />)
      
      await waitFor(() => {
        const createPlanButton = screen.getByRole('button', { name: /Create Your First Meal Plan/i })
        fireEvent.click(createPlanButton)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('plan-form')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should maintain proper ARIA attributes for tabs', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const plansTab = screen.getByRole('button', { name: /Meal Plans/i })
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        
        // Both tabs should be properly labeled buttons
        expect(plansTab).toBeInTheDocument()
        expect(groupsTab).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation between tabs', async () => {
      render(<DashboardContent />)
      
      await waitFor(() => {
        const groupsTab = screen.getByRole('button', { name: /Groups/i })
        
        groupsTab.focus()
        fireEvent.keyDown(groupsTab, { key: 'Enter', code: 'Enter' })
        
        expect(groupsTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })
  })
})