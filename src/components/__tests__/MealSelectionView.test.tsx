import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MealSelectionView from '../MealSelectionView'
import * as mockStorage from '@/lib/mockStorage'
import * as mealWorkflow from '@/lib/mealGenerationWorkflow'

// Mock the dependencies
jest.mock('@/lib/mockStorage')
jest.mock('@/lib/mealGenerationWorkflow')
jest.mock('../MealCard', () => {
  return function MockMealCard({ meal, onSelect, showSelection }: any) {
    return (
      <div data-testid={`meal-card-${meal.id}`}>
        <h3>{meal.title}</h3>
        {showSelection && (
          <input
            type="checkbox"
            checked={meal.selected}
            onChange={(e) => onSelect?.(meal.id, e.target.checked)}
            data-testid={`meal-checkbox-${meal.id}`}
          />
        )}
      </div>
    )
  }
})

const mockedMockStorage = mockStorage as jest.Mocked<typeof mockStorage>
const mockedMealWorkflow = mealWorkflow as jest.Mocked<typeof mealWorkflow>

// Mock data
const mockGroups = [
  {
    id: 'group-1',
    name: 'Family',
    adults: 2,
    teens: 1,
    kids: 1,
    toddlers: 0,
    dietary_restrictions: ['vegetarian'],
    notes: '',
    created_at: '2025-08-10T10:00:00Z'
  },
  {
    id: 'group-2',
    name: 'Extended Family',
    adults: 4,
    teens: 0,
    kids: 2,
    toddlers: 1,
    dietary_restrictions: [],
    notes: '',
    created_at: '2025-08-10T11:00:00Z'
  }
]

const mockMeals = [
  {
    id: 'meal-1',
    plan_id: 'plan-123',
    group_id: 'group-1',
    title: 'Vegetarian Pasta',
    description: 'Healthy pasta dish',
    prep_time: 15,
    cook_time: 20,
    total_time: 35,
    servings: 4,
    selected: false,
    ingredients: [
      { name: 'Pasta', amount: 1, unit: 'lb', category: 'grains' }
    ],
    instructions: ['Cook pasta', 'Add sauce'],
    tags: ['vegetarian'],
    dietary_info: ['vegetarian'],
    difficulty: 'easy' as const,
    created_at: '2025-08-10T12:00:00Z'
  },
  {
    id: 'meal-2',
    plan_id: 'plan-123',
    group_id: 'group-1',
    title: 'Veggie Stir Fry',
    description: 'Quick vegetable stir fry',
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    servings: 4,
    selected: true,
    ingredients: [
      { name: 'Mixed vegetables', amount: 2, unit: 'cups', category: 'vegetables' }
    ],
    instructions: ['Heat oil', 'Stir fry vegetables'],
    tags: ['quick', 'vegetarian'],
    dietary_info: ['vegetarian'],
    difficulty: 'easy' as const,
    created_at: '2025-08-10T12:30:00Z'
  },
  {
    id: 'meal-3',
    plan_id: 'plan-123',
    group_id: 'group-2',
    title: 'Family Tacos',
    description: 'Kid-friendly taco night',
    prep_time: 20,
    cook_time: 15,
    total_time: 35,
    servings: 6,
    selected: false,
    ingredients: [
      { name: 'Ground beef', amount: 1, unit: 'lb', category: 'protein' }
    ],
    instructions: ['Brown meat', 'Prepare toppings', 'Assemble tacos'],
    tags: ['family-friendly'],
    dietary_info: [],
    difficulty: 'medium' as const,
    created_at: '2025-08-10T13:00:00Z'
  }
]

const mockGroupedMeals = {
  'group-1': [mockMeals[0], mockMeals[1]],
  'group-2': [mockMeals[2]]
}

const mockStatistics = {
  totalGenerated: 3,
  totalSelected: 1,
  byGroup: {
    'group-1': { generated: 2, selected: 1 },
    'group-2': { generated: 1, selected: 0 }
  }
}

describe('MealSelectionView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockedMockStorage.getStoredGroups.mockReturnValue(mockGroups)
    mockedMealWorkflow.getMealsGroupedByGroup.mockReturnValue(mockGroupedMeals)
    mockedMealWorkflow.getMealStatistics.mockReturnValue(mockStatistics)
    mockedMealWorkflow.selectMealsForPlan.mockImplementation(() => {})
  })

  it('renders without crashing', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    // Should show loading state initially
    expect(screen.getByText('Loading generated meals...')).toBeInTheDocument()
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Select Your Meals')).toBeInTheDocument()
    })
  })

  it('displays statistics correctly', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Choose from 3 AI-generated meal options')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument() // selected count
      expect(screen.getByText('meals selected')).toBeInTheDocument()
    })
  })

  it('renders groups with meals', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      // Check group headers
      expect(screen.getByText('Family')).toBeInTheDocument()
      expect(screen.getByText('Extended Family')).toBeInTheDocument()
      
      // Check group demographics
      expect(screen.getByText('2 adults, 1 teens, 1 kids, 0 toddlers')).toBeInTheDocument()
      expect(screen.getByText('4 adults, 0 teens, 2 kids, 1 toddlers')).toBeInTheDocument()
      
      // Check dietary restrictions
      expect(screen.getByText('• vegetarian')).toBeInTheDocument()
    })
  })

  it('displays meal cards for each group', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByTestId('meal-card-meal-1')).toBeInTheDocument()
      expect(screen.getByTestId('meal-card-meal-2')).toBeInTheDocument()
      expect(screen.getByTestId('meal-card-meal-3')).toBeInTheDocument()
      
      expect(screen.getByText('Vegetarian Pasta')).toBeInTheDocument()
      expect(screen.getByText('Veggie Stir Fry')).toBeInTheDocument()
      expect(screen.getByText('Family Tacos')).toBeInTheDocument()
    })
  })

  it('handles meal selection changes', async () => {
    const onSelectionChange = jest.fn()
    
    render(
      <MealSelectionView 
        planId="plan-123"
        onSelectionChange={onSelectionChange}
      />
    )
    
    await waitFor(() => {
      const checkbox = screen.getByTestId('meal-checkbox-meal-1')
      fireEvent.click(checkbox)
    })
    
    expect(mockedMealWorkflow.selectMealsForPlan).toHaveBeenCalled()
    expect(onSelectionChange).toHaveBeenCalled()
  })

  it('handles select all for group', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      const selectAllButton = screen.getAllByText('Select All')[0]
      fireEvent.click(selectAllButton)
    })
    
    expect(mockedMealWorkflow.selectMealsForPlan).toHaveBeenCalled()
  })

  it('shows deselect all when all meals in group are selected', async () => {
    // Mock all meals as selected for group-1
    const allSelectedGrouped = {
      'group-1': [
        { ...mockMeals[0], selected: true },
        { ...mockMeals[1], selected: true }
      ],
      'group-2': [mockMeals[2]]
    }
    
    mockedMealWorkflow.getMealsGroupedByGroup.mockReturnValue(allSelectedGrouped)
    
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Deselect All')).toBeInTheDocument()
    })
  })

  it('displays continue button when meals are selected and onComplete is provided', async () => {
    const onComplete = jest.fn()
    
    render(
      <MealSelectionView 
        planId="plan-123"
        onComplete={onComplete}
      />
    )
    
    await waitFor(() => {
      const continueButton = screen.getByText('Continue with Selected Meals')
      expect(continueButton).toBeInTheDocument()
      
      fireEvent.click(continueButton)
      expect(onComplete).toHaveBeenCalled()
    })
  })

  it('shows empty state when no meals found', async () => {
    mockedMealWorkflow.getMealsGroupedByGroup.mockReturnValue({})
    
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('No Meals Found')).toBeInTheDocument()
      expect(screen.getByText('No generated meals found for this plan. Please generate meals first.')).toBeInTheDocument()
    })
  })

  it('handles error state', async () => {
    mockedMealWorkflow.getMealsGroupedByGroup.mockImplementation(() => {
      throw new Error('Failed to load meals')
    })
    
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Error Loading Meals')).toBeInTheDocument()
      expect(screen.getByText('Failed to load meals')).toBeInTheDocument()
    })
  })

  it('renders in compact mode', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
        compact={true}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Select Your Meals')).toBeInTheDocument()
      // In compact mode, layout should be different but content should be the same
    })
  })

  it('shows selection counts per group', async () => {
    render(
      <MealSelectionView 
        planId="plan-123"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('1 of 2 selected')).toBeInTheDocument()
      expect(screen.getByText('0 of 1 selected')).toBeInTheDocument()
    })
  })
})