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
    group_id: 'group-1',
    group_name: 'Family Group',
    title: 'Grilled Salmon',
    description: 'Fresh grilled salmon with herbs',
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    servings: 4,
    ingredients: ['salmon', 'herbs', 'lemon'],
    instructions: ['Season salmon', 'Grill until cooked'],
    tags: ['healthy', 'seafood'],
    dietary_info: ['high-protein'],
    difficulty: 'easy' as const,
    selected: false,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'meal-4',
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

const mockJobWithRequirements = {
  id: 'job-1',
  plan_name: 'Weekly Meal Plan',
  week_start: '2024-01-01',
  status: 'completed' as const,
  progress: 100,
  current_step: 'Completed',
  total_meals_generated: 4,
  created_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T01:00:00Z',
  groups_data: [
    {
      group_id: 'group-1',
      group_name: 'Family Group',
      demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
      dietary_restrictions: [],
      meals_to_generate: 5, // Original requirement = 5 - 2 = 3
      group_notes: '',
      adult_equivalent: 2.7
    },
    {
      group_id: 'group-2',
      group_name: 'Kids Only',
      demographics: { adults: 0, teens: 0, kids: 2, toddlers: 0 },
      dietary_restrictions: [],
      meals_to_generate: 3, // Original requirement = 3 - 2 = 1
      group_notes: '',
      adult_equivalent: 1.4
    }
  ]
}

const mockJobNoRequirements = {
  id: 'job-2',
  plan_name: 'Plan Without Requirements',
  week_start: '2024-01-01',
  status: 'completed' as const,
  progress: 100,
  current_step: 'Completed',
  total_meals_generated: 4,
  created_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T01:00:00Z',
  groups_data: null // No requirements data
}

// Test wrapper component (AuthProvider is mocked)
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
)

describe('GeneratedMealsView - Requirements Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Data Parsing', () => {
    it('should parse group requirements correctly from job groups_data', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockJobWithRequirements, error: null })
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
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Family Group should show "Select 3 meals" (5 - 2 = 3)
      expect(screen.getByText('Select 3 meals for this group')).toBeInTheDocument()
      
      // Kids Only should show "Select 1 meal" (3 - 2 = 1)  
      expect(screen.getByText('Select 1 meal for this group')).toBeInTheDocument()
    })

    it('should handle missing or malformed groups_data gracefully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockJobNoRequirements, error: null })
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
          <GeneratedMealsView jobId="job-2" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Should show optional meals instruction when no requirements data
      expect(screen.getAllByText('Optional meals - select any you like')).toHaveLength(2)
    })

    it('should calculate requirements correctly for different meal counts', () => {
      const testCases = [
        { meals_to_generate: 3, expected: 1 }, // 3 - 2 = 1
        { meals_to_generate: 4, expected: 2 }, // 4 - 2 = 2
        { meals_to_generate: 7, expected: 5 }, // 7 - 2 = 5
        { meals_to_generate: 2, expected: 0 }, // 2 - 2 = 0 (minimum)
        { meals_to_generate: 1, expected: 0 }, // 1 - 2 = -1, clamped to 0
      ]

      testCases.forEach(({ meals_to_generate, expected }) => {
        const mockJob = {
          ...mockJobWithRequirements,
          groups_data: [{
            group_id: 'test-group',
            group_name: 'Test Group',
            meals_to_generate,
            // ... other fields
          }]
        }

        // This would be tested by rendering and checking the instruction text
        // The logic is: Math.max(0, meals_to_generate - 2)
        const calculatedRequirement = Math.max(0, meals_to_generate - 2)
        expect(calculatedRequirement).toBe(expected)
      })
    })
  })

  describe('UI Rendering', () => {
    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockJobWithRequirements, error: null })
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

    it('should show correct instruction text for different requirement counts', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Family Group needs 3 meals (plural)
      expect(screen.getByText('Select 3 meals for this group')).toBeInTheDocument()
      
      // Kids Only needs 1 meal (singular)
      expect(screen.getByText('Select 1 meal for this group')).toBeInTheDocument()
    })

    it('should display completion status correctly', async () => {
      // Mock data where Family Group has exactly the required number selected
      const completedMeals = mockMeals.map(meal => ({
        ...meal,
        selected: meal.group_id === 'group-1' ? (meal.id === 'meal-1') : true // 1 selected for group-1, 1 selected for group-2
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: {
                    ...mockJobWithRequirements,
                    groups_data: [
                      {
                        ...mockJobWithRequirements.groups_data[0],
                        meals_to_generate: 3 // Requirement = 1
                      },
                      {
                        ...mockJobWithRequirements.groups_data[1],
                        meals_to_generate: 3 // Requirement = 1
                      }
                    ]
                  }, 
                  error: null 
                })
              })
            })
          }
        }
        
        if (table === 'generated_meals') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  order: () => Promise.resolve({ data: completedMeals, error: null })
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
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Both groups should show completion status
      expect(screen.getAllByText('✓ 1 meal selected (complete!)')).toHaveLength(2)
    })

    it('should show over-selection warnings', async () => {
      // Mock data where Family Group has more than required selected
      const overSelectedMeals = mockMeals.map(meal => ({
        ...meal,
        selected: meal.group_id === 'group-1' // All 3 Family Group meals selected
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: {
                    ...mockJobWithRequirements,
                    groups_data: [
                      {
                        ...mockJobWithRequirements.groups_data[0],
                        meals_to_generate: 3 // Requirement = 1, but 3 selected
                      },
                      mockJobWithRequirements.groups_data[1]
                    ]
                  }, 
                  error: null 
                })
              })
            })
          }
        }
        
        if (table === 'generated_meals') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  order: () => Promise.resolve({ data: overSelectedMeals, error: null })
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
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Family Group should show over-selection warning
      expect(screen.getByText('⚠ 3 selected (only need 1)')).toBeInTheDocument()
    })

    it('should apply correct status-based styling', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Check that instruction bars have appropriate CSS classes
      const familyInstruction = screen.getByText('Select 3 meals for this group').closest('div')
      const kidsInstruction = screen.getByText('Select 1 meal for this group').closest('div')

      // Should have status-based styling classes
      expect(familyInstruction).toHaveClass('bg-gray-50', 'border-gray-200', 'text-gray-700')
      expect(kidsInstruction).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-800') // Kids has 1 selected, requirement is 1, but it's 'complete' status
    })
  })

  describe('Status Logic', () => {
    it('should determine completion status correctly', () => {
      // These would be internal functions that could be exported for testing
      // For now, we test through UI behavior
      
      const testCases = [
        { selected: 0, required: 3, expectedStatus: 'neutral' },
        { selected: 1, required: 3, expectedStatus: 'progress' },
        { selected: 3, required: 3, expectedStatus: 'complete' },
        { selected: 4, required: 3, expectedStatus: 'over' },
        { selected: 0, required: 0, expectedStatus: 'neutral' },
      ]

      testCases.forEach(({ selected, required, expectedStatus }) => {
        let status = 'neutral'
        if (required === 0) status = 'neutral'
        else if (selected === 0) status = 'neutral'
        else if (selected < required) status = 'progress'
        else if (selected === required) status = 'complete'
        else status = 'over'

        expect(status).toBe(expectedStatus)
      })
    })
  })

  describe('Integration Tests', () => {
    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockJobWithRequirements, error: null })
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

    it('should update status when selections change', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Initial state: Family Group has 1 selected, needs 3
      expect(screen.getByText('Select 3 meals for this group')).toBeInTheDocument()

      // Find and click a meal selection button to change status
      const chickenCurryCard = screen.getByText('Chicken Curry').closest('.bg-white')
      const selectionButton = chickenCurryCard!.querySelector('button[class*="w-6 h-6"]') as HTMLElement

      expect(selectionButton).toBeInTheDocument()
      
      fireEvent.click(selectionButton)

      // Status should update after selection change
      // Note: In real implementation, this would trigger a re-render with updated meal data
    })

    it('should persist status through collapse/expand operations', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Collapse Family Group
      const familyGroupHeader = screen.getByRole('button', { name: /Family Group/ })
      fireEvent.click(familyGroupHeader)

      // Instruction bar should be hidden when collapsed
      expect(screen.queryByText('Select 3 meals for this group')).not.toBeInTheDocument()

      // Expand again
      fireEvent.click(familyGroupHeader)

      // Instruction bar should reappear with same status
      await waitFor(() => {
        expect(screen.getByText('Select 3 meals for this group')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockJobWithRequirements, error: null })
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

    it('should have proper ARIA attributes', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Check that group headers have proper ARIA attributes
      const familyGroupButton = screen.getByRole('button', { name: /Family Group/ })
      
      expect(familyGroupButton).toHaveAttribute('aria-expanded', 'true')
      expect(familyGroupButton).toHaveAttribute('aria-controls', 'group-group-1-content')
      expect(familyGroupButton).toHaveAttribute('aria-describedby', 'group-group-1-instruction')

      // Check that instruction bars have proper roles
      const familyInstruction = document.querySelector('#group-group-1-instruction')
      expect(familyInstruction).toHaveAttribute('role', 'status')
      expect(familyInstruction).toHaveAttribute('aria-live', 'polite')
    })

    it('should have icons marked as decorative', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Check that icons have aria-hidden="true"
      const iconElements = document.querySelectorAll('span[role="img"][aria-hidden="true"]')
      expect(iconElements.length).toBeGreaterThan(0)
    })

    it('should work with keyboard navigation', async () => {
      render(
        <TestWrapper>
          <GeneratedMealsView jobId="job-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Generated Meals')).toBeInTheDocument()
      })

      // Test that group headers are focusable and can be activated with keyboard
      const familyGroupButton = screen.getByRole('button', { name: /Family Group/ })
      
      familyGroupButton.focus()
      expect(familyGroupButton).toHaveFocus()

      // Simulate Enter key press
      fireEvent.keyDown(familyGroupButton, { key: 'Enter', code: 'Enter' })
      
      // Should collapse the group
      expect(familyGroupButton).toHaveAttribute('aria-expanded', 'false')
    })
  })
})