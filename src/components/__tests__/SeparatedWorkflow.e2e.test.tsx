/**
 * End-to-end test for complete separated workflow
 * Tests the full user journey from group creation → plan creation → meal generation → meal selection
 * Validates that each step can be performed independently without coupling
 */

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import components for the full workflow
import { AuthProvider } from '../AuthProvider'
import DashboardContent from '../DashboardContent'

// Import workflow functions
import { 
  generateAndStoreMealsForPlan,
  getMealsForPlan,
  selectMealsForPlan,
  getSelectedMealsForPlan,
  planHasGeneratedMeals
} from '@/lib/mealGenerationWorkflow'
import { validatePlan } from '@/lib/planValidation'
import { 
  storeGroup,
  storePlan,
  clearStoredGroups,
  clearStoredPlans,
  clearGeneratedMeals,
  getStoredGroups,
  getStoredPlans
} from '@/lib/mockStorage'

// Mock external dependencies
jest.mock('@/lib/supabase/singleton', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
    }
  })),
  resetSupabaseClient: jest.fn()
}))

jest.mock('@/lib/mealGenerator', () => ({
  generateMealsForPlan: jest.fn(),
  buildGroupContexts: jest.fn(),
  ChatGPTMealRequest: {},
  CombinedChatGPTMealRequest: {}
}))

jest.mock('../AuthProvider', () => ({
  ...jest.requireActual('../AuthProvider'),
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn()
  })
}))

// Mock meal generation progress
jest.mock('../MealGenerationProgress', () => ({
  __esModule: true,
  default: ({ onProgress }: { onProgress?: (progress: number) => void }) => {
    React.useEffect(() => {
      if (onProgress) {
        // Simulate progress
        setTimeout(() => onProgress(25), 100)
        setTimeout(() => onProgress(50), 200)
        setTimeout(() => onProgress(75), 300)
        setTimeout(() => onProgress(100), 400)
      }
    }, [onProgress])
    
    return <div data-testid="meal-generation-progress">Generating meals...</div>
  }
}))

// Mock meal selection view
jest.mock('../MealSelectionView', () => ({
  __esModule: true,
  default: ({ planId, onMealSelection }: { planId: string, onMealSelection?: (selections: string[]) => void }) => {
    const meals = getMealsForPlan(planId)
    
    return (
      <div data-testid="meal-selection-view">
        <h3>Select Meals</h3>
        {meals.map(meal => (
          <div key={meal.id} data-testid={`meal-option-${meal.id}`}>
            <button
              onClick={() => onMealSelection?.([meal.id])}
              data-testid={`select-meal-${meal.id}`}
            >
              Select {meal.title}
            </button>
          </div>
        ))}
      </div>
    )
  }
}))

import { generateMealsForPlan } from '@/lib/mealGenerator'
const mockGenerateMealsForPlan = generateMealsForPlan as jest.MockedFunction<typeof generateMealsForPlan>

describe('Complete Separated Workflow E2E', () => {
  const mockUser = { id: 'test-user', email: 'test@example.com' }
  
  // Test data
  const testGroup = {
    id: 'group-1',
    name: 'Test Family',
    adults: 2,
    teens: 1,
    kids: 1,
    toddlers: 0,
    dietary_restrictions: ['vegetarian'] as string[],
    user_id: 'test-user',
    status: 'active' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const testPlan = {
    id: 'plan-1',
    name: 'Weekly Meal Plan',
    week_start: '2024-01-15',
    group_meals: [
      { group_id: 'group-1', meal_count: 3, notes: 'Family dinners' }
    ],
    notes: 'Test plan for the family',
    user_id: 'test-user',
    status: 'active' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockMealGenerationResult = {
    success: true,
    data: {
      plan_id: 'plan-1',
      generated_at: '2024-01-01T00:00:00Z',
      total_meals_generated: 3,
      group_meal_options: [
        {
          group_id: 'group-1',
          group_name: 'Test Family',
          requested_count: 3,
          generated_count: 3,
          meals: [
            {
              id: 'meal-1',
              title: 'Vegetarian Pasta',
              description: 'Delicious veggie pasta',
              prep_time: 10,
              cook_time: 15,
              total_time: 25,
              servings: 4,
              ingredients: [
                { name: 'pasta', amount: 1, unit: 'lb', category: 'grains' },
                { name: 'tomatoes', amount: 2, unit: 'cups', category: 'vegetables' }
              ],
              instructions: ['Cook pasta', 'Add tomatoes', 'Serve hot'],
              tags: ['vegetarian', 'easy'],
              dietary_info: ['vegetarian'],
              difficulty: 'easy' as const,
              group_id: 'group-1',
              created_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 'meal-2',
              title: 'Veggie Stir Fry',
              description: 'Fresh vegetable stir fry',
              prep_time: 15,
              cook_time: 10,
              total_time: 25,
              servings: 4,
              ingredients: [
                { name: 'mixed vegetables', amount: 2, unit: 'cups', category: 'vegetables' },
                { name: 'soy sauce', amount: 2, unit: 'tbsp', category: 'condiments_sauces' }
              ],
              instructions: ['Heat oil', 'Add vegetables', 'Stir fry'],
              tags: ['vegetarian', 'healthy'],
              dietary_info: ['vegetarian'],
              difficulty: 'easy' as const,
              group_id: 'group-1',
              created_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 'meal-3',
              title: 'Veggie Curry',
              description: 'Spiced vegetable curry',
              prep_time: 20,
              cook_time: 25,
              total_time: 45,
              servings: 4,
              ingredients: [
                { name: 'curry powder', amount: 1, unit: 'tbsp', category: 'spices_herbs' },
                { name: 'coconut milk', amount: 1, unit: 'cup', category: 'dairy_alternatives' }
              ],
              instructions: ['Sauté spices', 'Add vegetables', 'Simmer with coconut milk'],
              tags: ['vegetarian', 'spicy'],
              dietary_info: ['vegetarian'],
              difficulty: 'medium' as const,
              group_id: 'group-1',
              created_at: '2024-01-01T00:00:00Z'
            }
          ],
          adult_equivalent: 3.7,
          total_servings_needed: 4
        }
      ],
      generation_metadata: {
        api_calls_made: 1,
        generation_time_ms: 2000
      }
    }
  }

  beforeEach(() => {
    // Clear all storage
    clearStoredGroups()
    clearStoredPlans()
    clearGeneratedMeals()
    
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup meal generation mock
    mockGenerateMealsForPlan.mockResolvedValue(mockMealGenerationResult)
  })

  describe('Step 1: Group Creation (Independent)', () => {
    test('should create group without any plan dependency', async () => {
      const user = userEvent.setup()

      render(
        <AuthProvider>
          <DashboardContent />
        </AuthProvider>
      )

      // Switch to Groups tab
      await user.click(screen.getByRole('tab', { name: /groups/i }))

      // Create new group
      await user.click(screen.getByRole('button', { name: /create new group/i }))

      // Fill group form
      await user.type(screen.getByLabelText(/group name/i), 'Test Family')
      await user.type(screen.getByLabelText(/adults/i), '2')
      await user.type(screen.getByLabelText(/teens/i), '1')
      await user.type(screen.getByLabelText(/kids/i), '1')

      // Save group
      await user.click(screen.getByRole('button', { name: /save group/i }))

      await waitFor(() => {
        // Group should be created and visible
        expect(screen.getByText('Test Family')).toBeInTheDocument()
      })

      // Verify group was stored
      const storedGroups = getStoredGroups()
      expect(storedGroups).toHaveLength(1)
      expect(storedGroups[0].name).toBe('Test Family')
      expect(storedGroups[0].adults).toBe(2)
      expect(storedGroups[0].teens).toBe(1)
      expect(storedGroups[0].kids).toBe(1)
    })
  })

  describe('Step 2: Plan Creation (Independent)', () => {
    test('should create plan referencing existing groups without triggering meal generation', async () => {
      // Pre-create group
      storeGroup(testGroup)
      
      const user = userEvent.setup()

      render(
        <AuthProvider>
          <DashboardContent />
        </AuthProvider>
      )

      // Switch to Plans tab
      await user.click(screen.getByRole('tab', { name: /plans/i }))

      // Create new plan
      await user.click(screen.getByRole('button', { name: /create new plan/i }))

      // Fill plan form (in separated mode - no meal generation)
      await user.type(screen.getByLabelText(/plan name/i), 'Weekly Meal Plan')
      await user.type(screen.getByLabelText(/week start/i), '2024-01-15')
      await user.type(screen.getByLabelText(/notes/i), 'Test plan for the family')

      // Add group meal assignment
      await user.click(screen.getByRole('button', { name: /add group/i }))
      
      // Select the group
      const groupSelect = screen.getByLabelText(/select group/i)
      await user.click(groupSelect)
      await user.click(screen.getByRole('option', { name: /test family/i }))
      
      // Set meal count
      await user.type(screen.getByLabelText(/meal count/i), '3')

      // Save plan (should NOT trigger meal generation)
      await user.click(screen.getByRole('button', { name: /save plan/i }))

      await waitFor(() => {
        // Plan should be created and visible
        expect(screen.getByText('Weekly Meal Plan')).toBeInTheDocument()
      })

      // Verify plan was stored
      const storedPlans = getStoredPlans()
      expect(storedPlans).toHaveLength(1)
      expect(storedPlans[0].name).toBe('Weekly Meal Plan')
      expect(storedPlans[0].group_meals).toHaveLength(1)
      expect(storedPlans[0].group_meals[0].group_id).toBe('group-1')

      // Verify NO meal generation occurred
      expect(mockGenerateMealsForPlan).not.toHaveBeenCalled()
      expect(planHasGeneratedMeals(storedPlans[0].id!)).toBe(false)
    })
  })

  describe('Step 3: Meal Generation (Independent)', () => {
    test('should generate meals for existing plan independently', async () => {
      // Pre-create group and plan
      storeGroup(testGroup)
      const planId = storePlan(testPlan, 'test-user')
      
      // Trigger meal generation independently (not via form)
      const result = await generateAndStoreMealsForPlan(testPlan, 'test-user')

      expect(result.success).toBe(true)
      expect(result.planId).toBe(planId)
      expect(result.totalMealsGenerated).toBe(3)
      expect(result.generatedMeals).toHaveLength(1) // 1 group
      expect(result.generatedMeals![0].meals).toHaveLength(3) // 3 meals

      // Verify meals were stored
      const meals = getMealsForPlan(planId)
      expect(meals).toHaveLength(3)
      expect(meals[0].title).toBe('Vegetarian Pasta')
      expect(meals[1].title).toBe('Veggie Stir Fry')
      expect(meals[2].title).toBe('Veggie Curry')

      // Verify plan has generated meals
      expect(planHasGeneratedMeals(planId)).toBe(true)
    })

    test('should validate plan before generation', async () => {
      // Invalid plan - no groups
      const invalidPlan = {
        name: 'Invalid Plan',
        week_start: '2024-01-15',
        group_meals: [],
        notes: ''
      }

      const result = await generateAndStoreMealsForPlan(invalidPlan, 'test-user')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No groups specified')
    })
  })

  describe('Step 4: Meal Selection (Independent)', () => {
    test('should select meals from generated options independently', async () => {
      // Pre-create group, plan, and generate meals
      storeGroup(testGroup)
      const planId = storePlan(testPlan, 'test-user')
      await generateAndStoreMealsForPlan(testPlan, 'test-user')

      // Get available meals
      const availableMeals = getMealsForPlan(planId)
      expect(availableMeals).toHaveLength(3)

      // Select specific meals
      const selectedMealIds = [availableMeals[0].id, availableMeals[2].id] // Pasta and Curry
      const selectionResult = selectMealsForPlan(planId, selectedMealIds)

      expect(selectionResult.success).toBe(true)
      expect(selectionResult.selectedCount).toBe(2)

      // Verify selections
      const selectedMeals = getSelectedMealsForPlan(planId)
      expect(selectedMeals).toHaveLength(2)
      expect(selectedMeals[0].title).toBe('Vegetarian Pasta')
      expect(selectedMeals[1].title).toBe('Veggie Curry')
    })

    test('should handle meal selection through UI component', async () => {
      // Pre-create everything
      storeGroup(testGroup)
      const planId = storePlan(testPlan, 'test-user')
      await generateAndStoreMealsForPlan(testPlan, 'test-user')

      const user = userEvent.setup()
      const mockOnMealSelection = jest.fn()

      // Render meal selection component
      const MealSelectionView = require('../MealSelectionView').default
      render(
        <MealSelectionView 
          planId={planId}
          onMealSelection={mockOnMealSelection}
        />
      )

      // Should show meal options
      expect(screen.getByText('Select Meals')).toBeInTheDocument()
      expect(screen.getByTestId('meal-option-meal-1')).toBeInTheDocument()
      expect(screen.getByTestId('meal-option-meal-2')).toBeInTheDocument()
      expect(screen.getByTestId('meal-option-meal-3')).toBeInTheDocument()

      // Select a meal
      await user.click(screen.getByTestId('select-meal-meal-1'))

      expect(mockOnMealSelection).toHaveBeenCalledWith(['meal-1'])
    })
  })

  describe('Complete Workflow Integration', () => {
    test('should complete full workflow: group → plan → generation → selection', async () => {
      const user = userEvent.setup()

      // Step 1: Start with dashboard
      render(
        <AuthProvider>
          <DashboardContent />
        </AuthProvider>
      )

      // Step 2: Create group
      await user.click(screen.getByRole('tab', { name: /groups/i }))
      await user.click(screen.getByRole('button', { name: /create new group/i }))
      
      await user.type(screen.getByLabelText(/group name/i), 'Complete Test Family')
      await user.type(screen.getByLabelText(/adults/i), '2')
      await user.click(screen.getByRole('button', { name: /save group/i }))

      await waitFor(() => {
        expect(screen.getByText('Complete Test Family')).toBeInTheDocument()
      })

      // Step 3: Create plan
      await user.click(screen.getByRole('tab', { name: /plans/i }))
      await user.click(screen.getByRole('button', { name: /create new plan/i }))
      
      await user.type(screen.getByLabelText(/plan name/i), 'Complete Test Plan')
      await user.type(screen.getByLabelText(/week start/i), '2024-01-15')
      
      // Add group assignment
      await user.click(screen.getByRole('button', { name: /add group/i }))
      const groupSelect = screen.getByLabelText(/select group/i)
      await user.click(groupSelect)
      await user.click(screen.getByRole('option', { name: /complete test family/i }))
      await user.type(screen.getByLabelText(/meal count/i), '2')

      await user.click(screen.getByRole('button', { name: /save plan/i }))

      await waitFor(() => {
        expect(screen.getByText('Complete Test Plan')).toBeInTheDocument()
      })

      // Verify state after plan creation
      const storedGroups = getStoredGroups()
      const storedPlans = getStoredPlans()
      
      expect(storedGroups).toHaveLength(1)
      expect(storedPlans).toHaveLength(1)
      expect(planHasGeneratedMeals(storedPlans[0].id!)).toBe(false) // No meals yet

      // Step 4: Generate meals independently
      const planData = {
        name: storedPlans[0].name,
        week_start: storedPlans[0].week_start,
        group_meals: storedPlans[0].group_meals,
        notes: storedPlans[0].notes || ''
      }

      const generationResult = await generateAndStoreMealsForPlan(planData, 'test-user')
      
      expect(generationResult.success).toBe(true)
      expect(generationResult.totalMealsGenerated).toBe(3)

      // Step 5: Verify meal selection capability
      const planId = generationResult.planId!
      const availableMeals = getMealsForPlan(planId)
      
      expect(availableMeals).toHaveLength(3)
      expect(planHasGeneratedMeals(planId)).toBe(true)

      // Select some meals
      const selectionResult = selectMealsForPlan(planId, [availableMeals[0].id])
      expect(selectionResult.success).toBe(true)
      
      const selectedMeals = getSelectedMealsForPlan(planId)
      expect(selectedMeals).toHaveLength(1)
    })

    test('should handle workflow with validation failures at each step', async () => {
      // Test validation at group creation
      const user = userEvent.setup()
      
      render(
        <AuthProvider>
          <DashboardContent />
        </AuthProvider>
      )

      await user.click(screen.getByRole('tab', { name: /groups/i }))
      await user.click(screen.getByRole('button', { name: /create new group/i }))
      
      // Try to save without name
      await user.click(screen.getByRole('button', { name: /save group/i }))
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/group name is required/i)).toBeInTheDocument()
      })

      // No groups should be stored
      expect(getStoredGroups()).toHaveLength(0)

      // Test plan validation without groups
      await user.click(screen.getByRole('tab', { name: /plans/i }))
      await user.click(screen.getByRole('button', { name: /create new plan/i }))
      
      await user.type(screen.getByLabelText(/plan name/i), 'Test Plan')
      await user.click(screen.getByRole('button', { name: /save plan/i }))

      // Should succeed but with no group assignments
      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument()
      })

      // Test meal generation validation
      const planWithNoGroups = {
        name: 'Test Plan',
        week_start: '2024-01-15',
        group_meals: [],
        notes: ''
      }

      const generationResult = await generateAndStoreMealsForPlan(planWithNoGroups, 'test-user')
      expect(generationResult.success).toBe(false)
      expect(generationResult.error).toContain('No groups specified')
    })
  })

  describe('Workflow Independence Validation', () => {
    test('should allow each step to be performed in isolation', async () => {
      // Test 1: Group creation works without plans
      storeGroup(testGroup)
      const groups = getStoredGroups()
      expect(groups).toHaveLength(1)

      // Test 2: Plan creation works with existing groups
      const planId = storePlan(testPlan, 'test-user')
      const plans = getStoredPlans()
      expect(plans).toHaveLength(1)

      // Test 3: Plan validation works independently
      const validationResult = validatePlan(testPlan)
      expect(validationResult.isValid).toBe(true)

      // Test 4: Meal generation works with existing plan
      const generationResult = await generateAndStoreMealsForPlan(testPlan, 'test-user')
      expect(generationResult.success).toBe(true)

      // Test 5: Meal selection works with generated meals
      const meals = getMealsForPlan(planId)
      expect(meals).toHaveLength(3)
      
      const selectionResult = selectMealsForPlan(planId, [meals[0].id])
      expect(selectionResult.success).toBe(true)

      // Test 6: Each component can be tested in isolation
      expect(planHasGeneratedMeals(planId)).toBe(true)
      expect(getSelectedMealsForPlan(planId)).toHaveLength(1)
    })

    test('should handle missing dependencies gracefully', async () => {
      // Test plan creation with missing group
      const planWithMissingGroup = {
        name: 'Test Plan',
        week_start: '2024-01-15',
        group_meals: [
          { group_id: 'nonexistent-group', meal_count: 2 }
        ],
        notes: ''
      }

      const generationResult = await generateAndStoreMealsForPlan(planWithMissingGroup, 'test-user')
      expect(generationResult.success).toBe(false)
      expect(generationResult.error).toContain('No groups available')

      // Test meal selection with missing plan
      const selectionResult = selectMealsForPlan('nonexistent-plan', ['meal-1'])
      expect(selectionResult.success).toBe(false)
    })
  })
})