import {
  generateAndStoreMealsForPlan,
  getMealsForPlan,
  selectMealsForPlan,
  getSelectedMealsForPlan,
  getMealsGroupedByGroup,
  getMealStatistics,
  validatePlanForGeneration,
  planHasGeneratedMeals
} from '../mealGenerationWorkflow'
import {
  storeGroup,
  clearStoredGroups,
  clearGeneratedMeals,
  StoredGroup
} from '../mockStorage'
import { PlanData } from '../planValidation'

// Mock the meal generator module
jest.mock('../mealGenerator', () => ({
  generateMealsForPlan: jest.fn()
}))

import { generateMealsForPlan } from '../mealGenerator'
const mockGenerateMealsForPlan = generateMealsForPlan as jest.MockedFunction<typeof generateMealsForPlan>

describe('Meal Generation Workflow', () => {
  const mockGroup: StoredGroup = {
    id: 'test-group-1',
    name: 'Test Family',
    adults: 2,
    teens: 1,
    kids: 1,
    toddlers: 0,
    dietary_restrictions: ['vegetarian'],
    user_id: 'test-user',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockPlanData: PlanData = {
    name: 'Test Plan',
    week_start: '2024-12-15',
    group_meals: [
      {
        group_id: 'test-group-1',
        meal_count: 3,
        notes: 'Test notes'
      }
    ]
  }

  beforeEach(() => {
    // Clear storage
    clearStoredGroups()
    clearGeneratedMeals()
    
    // Store test group
    storeGroup(mockGroup)
    
    // Reset mocks
    jest.clearAllMocks()
  })

  describe('validatePlanForGeneration', () => {
    it('should validate plan with available groups', () => {
      const result = validatePlanForGeneration(mockPlanData)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return error when no groups exist', () => {
      clearStoredGroups()
      
      const result = validatePlanForGeneration(mockPlanData)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No family groups found. Create groups first.')
    })

    it('should return error for missing groups', () => {
      const planWithMissingGroup: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'nonexistent-group', meal_count: 2 }
        ]
      }
      
      const result = validatePlanForGeneration(planWithMissingGroup)
      
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Groups not found: nonexistent-group')
    })

    it('should return warning for high meal counts', () => {
      const planWithHighMealCount: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'test-group-1', meal_count: 10 }
        ]
      }
      
      const result = validatePlanForGeneration(planWithHighMealCount)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Some groups have high meal counts (>7). Generation may take longer.')
    })
  })

  describe('generateAndStoreMealsForPlan', () => {
    it('should successfully generate and store meals', async () => {
      const mockGenerationResult = {
        success: true,
        data: {
          plan_id: 'test-plan',
          generated_at: '2024-01-01T00:00:00Z',
          total_meals_generated: 5,
          group_meal_options: [
            {
              group_id: 'test-group-1',
              group_name: 'Test Family',
              requested_count: 3,
              generated_count: 5,
              meals: [
                {
                  id: 'meal-1',
                  title: 'Test Meal',
                  description: 'A test meal',
                  prep_time: 15,
                  cook_time: 20,
                  total_time: 35,
                  servings: 4,
                  ingredients: [
                    { name: 'test ingredient', amount: 1, unit: 'cup', category: 'vegetables' }
                  ],
                  instructions: ['Test instruction'],
                  tags: ['test'],
                  dietary_info: ['vegetarian'],
                  difficulty: 'easy' as const,
                  group_id: 'test-group-1',
                  created_at: '2024-01-01T00:00:00Z'
                }
              ],
              adult_equivalent: 3.7,
              total_servings_needed: 4
            }
          ],
          generation_metadata: {
            api_calls_made: 1,
            generation_time_ms: 1000
          }
        }
      }

      mockGenerateMealsForPlan.mockResolvedValue(mockGenerationResult)

      const result = await generateAndStoreMealsForPlan(mockPlanData, 'test-user')

      expect(result.success).toBe(true)
      expect(result.planId).toBeDefined()
      expect(result.totalMealsGenerated).toBe(5)
      expect(result.generatedMeals).toBeDefined()
      expect(result.generatedMeals!).toHaveLength(1)
    })

    it('should handle generation failure', async () => {
      mockGenerateMealsForPlan.mockResolvedValue({
        success: false,
        errors: [{ code: 'API_FAILURE', message: 'API failed' }]
      })

      const result = await generateAndStoreMealsForPlan(mockPlanData, 'test-user')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Meal generation failed')
    })

    it('should handle no available groups', async () => {
      clearStoredGroups()

      const result = await generateAndStoreMealsForPlan(mockPlanData, 'test-user')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No groups available for meal generation')
    })
  })

  describe('meal selection functions', () => {
    let testPlanId: string
    
    beforeEach(async () => {
      // Set up some test meals
      const mockGenerationResult = {
        success: true,
        data: {
          plan_id: 'test-plan',
          generated_at: '2024-01-01T00:00:00Z',
          total_meals_generated: 2,
          group_meal_options: [
            {
              group_id: 'test-group-1',
              group_name: 'Test Family',
              requested_count: 2,
              generated_count: 2,
              meals: [
                {
                  id: 'meal-1',
                  title: 'Meal 1',
                  description: 'First meal',
                  prep_time: 15,
                  cook_time: 20,
                  total_time: 35,
                  servings: 4,
                  ingredients: [{ name: 'ingredient 1', amount: 1, unit: 'cup', category: 'vegetables' }],
                  instructions: ['Step 1'],
                  tags: ['tag1'],
                  dietary_info: ['vegetarian'],
                  difficulty: 'easy' as const,
                  group_id: 'test-group-1',
                  created_at: '2024-01-01T00:00:00Z'
                },
                {
                  id: 'meal-2',
                  title: 'Meal 2',
                  description: 'Second meal',
                  prep_time: 10,
                  cook_time: 15,
                  total_time: 25,
                  servings: 4,
                  ingredients: [{ name: 'ingredient 2', amount: 2, unit: 'tbsp', category: 'spices_herbs' }],
                  instructions: ['Step 1', 'Step 2'],
                  tags: ['tag2'],
                  dietary_info: ['vegetarian'],
                  difficulty: 'medium' as const,
                  group_id: 'test-group-1',
                  created_at: '2024-01-01T00:00:00Z'
                }
              ],
              adult_equivalent: 3.7,
              total_servings_needed: 4
            }
          ],
          generation_metadata: {
            api_calls_made: 1,
            generation_time_ms: 1000
          }
        }
      }

      mockGenerateMealsForPlan.mockResolvedValue(mockGenerationResult)
      const result = await generateAndStoreMealsForPlan(mockPlanData, 'test-user')
      testPlanId = result.planId!
    })

    it('should get meals for plan', () => {
      const meals = getMealsForPlan(testPlanId)
      expect(meals).toHaveLength(2)
      expect(meals[0].title).toBe('Meal 1')
      expect(meals[1].title).toBe('Meal 2')
    })

    it('should select specific meals', () => {
      const meals = getMealsForPlan(testPlanId)
      const result = selectMealsForPlan(testPlanId, [meals[0].id])
      
      expect(result.success).toBe(true)
      expect(result.selectedCount).toBe(1)
      
      const selectedMeals = getSelectedMealsForPlan(testPlanId)
      expect(selectedMeals).toHaveLength(1)
      expect(selectedMeals[0].title).toBe('Meal 1')
    })

    it('should group meals by group', () => {
      const grouped = getMealsGroupedByGroup(testPlanId)
      
      expect(Object.keys(grouped)).toHaveLength(1)
      expect(grouped['test-group-1']).toHaveLength(2)
    })

    it('should calculate meal statistics', () => {
      const meals = getMealsForPlan(testPlanId)
      selectMealsForPlan(testPlanId, [meals[0].id])
      
      const stats = getMealStatistics(testPlanId)
      
      expect(stats.totalGenerated).toBe(2)
      expect(stats.totalSelected).toBe(1)
      expect(stats.byGroup['test-group-1'].generated).toBe(2)
      expect(stats.byGroup['test-group-1'].selected).toBe(1)
    })

    it('should detect if plan has generated meals', () => {
      expect(planHasGeneratedMeals(testPlanId)).toBe(true)
      expect(planHasGeneratedMeals('nonexistent-plan')).toBe(false)
    })
  })
})