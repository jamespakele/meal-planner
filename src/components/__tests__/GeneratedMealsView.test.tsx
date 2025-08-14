import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GeneratedMealsView from '../GeneratedMealsView'
import { getSupabaseClient } from '@/lib/supabase/singleton'

// Mock AuthProvider to avoid authentication complexities in tests
jest.mock('../AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'mock-token' },
    loading: false
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
          order: jest.fn(() => ({
            // Return the query object itself for method chaining
          }))
        }))
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
    })),
    getSession: jest.fn(() => Promise.resolve({
      data: { session: { access_token: 'mock-token' } },
      error: null
    }))
  }
}

;(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

// Mock meals data
const mockMeals = [
  {
    id: 'meal-1',
    job_id: 'job-1',
    group_id: 'group-1',
    group_name: 'Family Group',
    title: 'Spaghetti Bolognese',
    description: 'Classic Italian pasta dish',
    prep_time: 15,
    cook_time: 30,
    total_time: 45,
    servings: 4,
    ingredients: ['pasta', 'ground beef', 'tomato sauce'],
    instructions: ['Cook pasta', 'Prepare sauce', 'Combine'],
    tags: ['italian', 'pasta'],
    dietary_info: ['gluten-free'],
    difficulty: 'medium' as const,
    selected: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'meal-2',
    job_id: 'job-1',
    group_id: 'group-1',
    group_name: 'Family Group',
    title: 'Chicken Curry',
    description: 'Spicy chicken curry',
    prep_time: 20,
    cook_time: 25,
    total_time: 45,
    servings: 4,
    ingredients: ['chicken', 'curry powder', 'coconut milk'],
    instructions: ['Season chicken', 'Cook curry', 'Serve'],
    tags: ['spicy', 'indian'],
    dietary_info: ['dairy-free'],
    difficulty: 'easy' as const,
    selected: false,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'meal-3',
    job_id: 'job-1',
    group_id: 'group-2',
    group_name: 'Kids Only',
    title: 'Mac and Cheese',
    description: 'Creamy mac and cheese',
    prep_time: 10,
    cook_time: 20,
    total_time: 30,
    servings: 2,
    ingredients: ['macaroni', 'cheese', 'milk'],
    instructions: ['Boil pasta', 'Make cheese sauce'],
    tags: ['kid-friendly', 'comfort'],
    dietary_info: ['vegetarian'],
    difficulty: 'easy' as const,
    selected: true,
    created_at: '2024-01-01T00:00:00Z'
  }
]

const mockJob = {
  id: 'job-1',
  plan_name: 'Weekly Meal Plan',
  week_start: '2024-01-01',
  status: 'completed' as const,
  progress: 100,
  current_step: 'Completed',
  total_meals_generated: 3,
  created_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T01:00:00Z'
}

// Test wrapper component (AuthProvider is mocked)
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
)

describe('GeneratedMealsView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock responses
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'meal_generation_jobs') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockJob, error: null })
            })
          })
        }
      }
      
      if (table === 'generated_meals') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: mockMeals, error: null })
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null })
          })
        }
      }
      
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        })
      }
    })
  })

  it('should render loading state initially', () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    expect(screen.getByText('Loading generated meals...')).toBeInTheDocument()
  })

  it('should render meals grouped by group name', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Generated Meals')).toBeInTheDocument()
    })

    // Check that group headers are rendered
    expect(screen.getByText('Family Group')).toBeInTheDocument()
    expect(screen.getByText('Kids Only')).toBeInTheDocument()

    // Check that group statistics are displayed
    expect(screen.getByText('(1/2 meals selected)')).toBeInTheDocument() // Family Group
    expect(screen.getByText('(1/1 meals selected)')).toBeInTheDocument() // Kids Only
  })

  it('should render meals in the correct groups', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument()
      expect(screen.getByText('Mac and Cheese')).toBeInTheDocument()
    })
  })

  it('should have all groups expanded by default', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      // All meals should be visible
      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument()
      expect(screen.getByText('Mac and Cheese')).toBeInTheDocument()
    })

    // Check ARIA attributes
    const familyGroupButton = screen.getByRole('button', { name: /Family Group/ })
    const kidsGroupButton = screen.getByRole('button', { name: /Kids Only/ })

    expect(familyGroupButton).toHaveAttribute('aria-expanded', 'true')
    expect(kidsGroupButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('should collapse and expand groups when header is clicked', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Family Group')).toBeInTheDocument()
    })

    // Initially, Family Group meals should be visible
    expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
    expect(screen.getByText('Chicken Curry')).toBeInTheDocument()

    // Click to collapse Family Group
    const familyGroupHeader = screen.getByRole('button', { name: /Family Group/ })
    fireEvent.click(familyGroupHeader)

    // Family Group meals should be hidden
    expect(screen.queryByText('Spaghetti Bolognese')).not.toBeInTheDocument()
    expect(screen.queryByText('Chicken Curry')).not.toBeInTheDocument()

    // Kids Only meals should still be visible
    expect(screen.getByText('Mac and Cheese')).toBeInTheDocument()

    // ARIA attribute should be updated
    expect(familyGroupHeader).toHaveAttribute('aria-expanded', 'false')

    // Click to expand again
    fireEvent.click(familyGroupHeader)

    // Family Group meals should be visible again
    await waitFor(() => {
      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument()
    })

    expect(familyGroupHeader).toHaveAttribute('aria-expanded', 'true')
  })

  it('should show correct chevron rotation for collapsed/expanded states', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Family Group')).toBeInTheDocument()
    })

    const familyGroupHeader = screen.getByRole('button', { name: /Family Group/ })
    const chevron = familyGroupHeader.querySelector('svg')

    // Initially expanded - chevron should be rotated (rotate-180)
    expect(chevron).toHaveClass('rotate-180')

    // Click to collapse
    fireEvent.click(familyGroupHeader)

    // When collapsed - chevron should not be rotated (rotate-0)
    expect(chevron).toHaveClass('rotate-0')
  })

  it('should handle meal selection toggle', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument()
    })

    // Find the Chicken Curry meal card and its selection button
    const chickenCurryCard = screen.getByText('Chicken Curry').closest('.bg-white')
    const selectionButton = chickenCurryCard!.querySelector('button[class*="w-6 h-6"]') as HTMLElement

    expect(selectionButton).toBeInTheDocument()
    
    // Mock the update call
    mockSupabase.from.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    })

    // Click to select the meal
    fireEvent.click(selectionButton)

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('generated_meals')
    })
  })

  it('should display correct meal counts in headers', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Family Group')).toBeInTheDocument()
    })

    // Family Group has 2 meals, 1 selected
    expect(screen.getByText('(1/2 meals selected)')).toBeInTheDocument()
    
    // Kids Only has 1 meal, 1 selected
    expect(screen.getByText('(1/1 meals selected)')).toBeInTheDocument()
  })

  it('should update meal counts when selections change', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument()
    })

    // Initially Family Group shows (1/2 meals selected)
    expect(screen.getByText('(1/2 meals selected)')).toBeInTheDocument()

    // Find and click the Chicken Curry selection button
    const chickenCurryCard = screen.getByText('Chicken Curry').closest('.bg-white')
    const selectionButton = chickenCurryCard!.querySelector('button[class*="w-6 h-6"]') as HTMLElement

    // Mock successful update
    mockSupabase.from.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    })

    fireEvent.click(selectionButton)

    // The count should update to (2/2 meals selected)
    await waitFor(() => {
      expect(screen.getByText('(2/2 meals selected)')).toBeInTheDocument()
    })
  })

  it('should handle empty state when no meals are generated', async () => {
    // Mock empty meals response
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'meal_generation_jobs') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockJob, error: null })
            })
          })
        }
      }
      
      if (table === 'generated_meals') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        }
      }
      
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        })
      }
    })

    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('No meals found')).toBeInTheDocument()
      expect(screen.getByText('No meals have been generated yet.')).toBeInTheDocument()
    })
  })

  it('should handle errors gracefully', async () => {
    // Mock error response
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Database error' } })
        })
      })
    })

    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Error loading meals')).toBeInTheDocument()
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('should maintain accessibility standards', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Family Group')).toBeInTheDocument()
    })

    // Check that group headers have proper ARIA attributes
    const familyGroupButton = screen.getByRole('button', { name: /Family Group/ })
    const kidsGroupButton = screen.getByRole('button', { name: /Kids Only/ })

    expect(familyGroupButton).toHaveAttribute('aria-expanded')
    expect(familyGroupButton).toHaveAttribute('aria-controls')
    expect(kidsGroupButton).toHaveAttribute('aria-expanded')
    expect(kidsGroupButton).toHaveAttribute('aria-controls')

    // Check that content areas have proper IDs
    expect(document.querySelector('#group-group-1-content')).toBeInTheDocument()
    expect(document.querySelector('#group-group-2-content')).toBeInTheDocument()
  })

  it('should display plan information in header', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      expect(screen.getByText(/Weekly Meal Plan/)).toBeInTheDocument()
      expect(screen.getByText(/Week of/)).toBeInTheDocument()
    })
  })

  it('should show total selected meals count in header', async () => {
    render(
      <TestWrapper>
        <GeneratedMealsView jobId="job-1" />
      </TestWrapper>
    )

    await waitFor(() => {
      // 2 meals are selected out of 3 total
      expect(screen.getByText('2 of 3 meals selected')).toBeInTheDocument()
    })
  })
})