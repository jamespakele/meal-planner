/**
 * End-to-End Workflow Tests for Meal Generation System
 * 
 * These tests verify the complete user workflow:
 * 1. User triggers meal generation through UI
 * 2. API creates background job  
 * 3. Background processor generates meals via AI
 * 4. Meals are stored in database
 * 5. UI displays generated meals
 * 6. User can select and finalize meal plans
 */

import { generateMealsForPlan } from '../mealGenerator'
import { processJobInBackground } from '../backgroundJobProcessor'
import { PlanData } from '../planValidation'
import { StoredGroup } from '../mockStorage'

// Mock external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }))
}))

describe('End-to-End Meal Generation Workflow', () => {
  const mockGroups: StoredGroup[] = [
    {
      id: 'group-1',
      name: 'Test Family',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian'],
      user_id: 'user-123',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'group-2', 
      name: 'Couple Group',
      adults: 2,
      teens: 0,
      kids: 0,
      toddlers: 0,
      dietary_restrictions: ['gluten-free'],
      user_id: 'user-123',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

  const mockPlanData: PlanData = {
    name: 'Weekly Family Plan',
    week_start: '2024-12-01',
    notes: 'Holiday meal planning',
    group_meals: [
      { group_id: 'group-1', meal_count: 3 },
      { group_id: 'group-2', meal_count: 2 }
    ]
  }

  beforeEach(() => {
    // Set development mode for predictable testing
    process.env.NODE_ENV = 'development'
    delete process.env.OPENAI_API_KEY
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY
    jest.clearAllMocks()
  })

  describe('Complete Workflow - Plan Generation to Meal Display', () => {
    it('should successfully generate meals for a multi-group plan', async () => {
      // Step 1: User triggers meal generation through generateMealsForPlan
      const result = await generateMealsForPlan(mockPlanData, mockGroups)

      // Verify the generation was successful
      expect(result.success).toBe(true)
      
      if (result.success) {
        // Step 2: Verify plan-level data structure
        expect(result.data).toBeDefined()
        expect(result.data.plan_name).toBe('Weekly Family Plan')
        expect(result.data.week_start).toBe('2024-12-01')
        expect(result.data.total_groups).toBe(2)
        expect(result.data.total_meals_requested).toBe(5) // 3 + 2
        
        // Step 3: Verify group-level meal options
        expect(result.data.group_meal_options).toHaveLength(2)
        
        const familyGroup = result.data.group_meal_options.find(g => g.group_name === 'Test Family')
        const coupleGroup = result.data.group_meal_options.find(g => g.group_name === 'Couple Group')
        
        expect(familyGroup).toBeDefined()
        expect(coupleGroup).toBeDefined()
        
        if (familyGroup && coupleGroup) {
          // Verify family group meals
          expect(familyGroup.group_id).toBe('group-1')
          expect(familyGroup.requested_count).toBe(3)
          expect(familyGroup.generated_count).toBeGreaterThanOrEqual(3) // Should include extra meals
          expect(familyGroup.meals).toHaveLength(familyGroup.generated_count)
          
          // Verify couple group meals
          expect(coupleGroup.group_id).toBe('group-2')
          expect(coupleGroup.requested_count).toBe(2)
          expect(coupleGroup.generated_count).toBeGreaterThanOrEqual(2)
          expect(coupleGroup.meals).toHaveLength(coupleGroup.generated_count)
          
          // Step 4: Verify meal structure and dietary restrictions
          familyGroup.meals.forEach(meal => {
            expect(meal).toMatchObject({
              id: expect.any(String),
              title: expect.any(String),
              description: expect.any(String),
              prep_time: expect.any(Number),
              cook_time: expect.any(Number),
              total_time: expect.any(Number),
              servings: expect.any(Number),
              ingredients: expect.any(Array),
              instructions: expect.any(Array),
              tags: expect.any(Array),
              dietary_info: expect.any(Array),
              difficulty: expect.stringMatching(/^(easy|medium|hard)$/),
              group_id: 'Test Family',
              created_at: expect.any(String)
            })
            
            // Verify dietary restrictions are respected
            expect(meal.dietary_info).toContain('vegetarian')
            
            // Verify ingredients structure
            meal.ingredients.forEach(ingredient => {
              expect(ingredient).toMatchObject({
                name: expect.any(String),
                amount: expect.any(Number),
                unit: expect.any(String),
                category: expect.any(String)
              })
            })
          })
          
          coupleGroup.meals.forEach(meal => {
            expect(meal.dietary_info).toContain('gluten-free')
            expect(meal.group_id).toBe('Couple Group')
          })
        }
      }
    })

    it('should handle single group plans correctly', async () => {
      const singleGroupPlan: PlanData = {
        name: 'Simple Plan',
        week_start: '2024-12-08',
        notes: 'Just for the family',
        group_meals: [
          { group_id: 'group-1', meal_count: 4 }
        ]
      }

      const singleGroup = [mockGroups[0]]

      const result = await generateMealsForPlan(singleGroupPlan, singleGroup)

      expect(result.success).toBe(true)
      
      if (result.success) {
        expect(result.data.total_groups).toBe(1)
        expect(result.data.total_meals_requested).toBe(4)
        expect(result.data.group_meal_options).toHaveLength(1)
        
        const groupOptions = result.data.group_meal_options[0]
        expect(groupOptions.group_name).toBe('Test Family')
        expect(groupOptions.requested_count).toBe(4)
        expect(groupOptions.generated_count).toBeGreaterThanOrEqual(4)
      }
    })

    it('should handle plans with zero meal requests gracefully', async () => {
      const emptyPlan: PlanData = {
        name: 'Empty Plan',
        week_start: '2024-12-15',
        notes: '',
        group_meals: [
          { group_id: 'group-1', meal_count: 0 },
          { group_id: 'group-2', meal_count: 0 }
        ]
      }

      const result = await generateMealsForPlan(emptyPlan, mockGroups)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0].code).toBe('NO_MEALS_REQUESTED')
    })
  })

  describe('Background Job Processing Workflow', () => {
    it('should simulate the complete background job lifecycle', async () => {
      // This test simulates what happens after the API creates a background job
      const jobId = 'test-job-123'
      const userId = 'user-123'
      
      // Prepare groups data in the format expected by background processor
      const groupsData = [
        {
          group_id: 'group-1',
          group_name: 'Test Family',
          demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
          dietary_restrictions: ['vegetarian'],
          meals_to_generate: 3,
          adult_equivalent: 4.6
        },
        {
          group_id: 'group-2',
          group_name: 'Couple Group', 
          demographics: { adults: 2, teens: 0, kids: 0, toddlers: 0 },
          dietary_restrictions: ['gluten-free'],
          meals_to_generate: 2,
          adult_equivalent: 2.0
        }
      ]

      // Mock Supabase client for background processing
      const mockSupabaseClient = {
        rpc: jest.fn().mockResolvedValue({ error: null }),
        from: jest.fn(() => ({
          insert: jest.fn(() => Promise.resolve({ error: null }))
        }))
      }

      // Mock the createClient to return our mock
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockResolvedValue(mockSupabaseClient)

      // Execute background job processing
      await processJobInBackground(jobId, userId, groupsData, mockPlanData)

      // Verify the sequence of database operations
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'processing',
        p_started_at: expect.any(String),
        p_progress: 10,
        p_current_step: 'Preparing AI request...'
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_meal_generation_job', {
        p_job_id: jobId,
        p_progress: 30,
        p_current_step: 'Generating meals with AI...'
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_meal_generation_job', {
        p_job_id: jobId,
        p_progress: 80,
        p_current_step: 'Saving generated meals...'
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('insert_generated_meals', {
        p_job_id: jobId,
        p_meals: expect.any(Array)
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'completed',
        p_progress: 100,
        p_current_step: 'Completed',
        p_completed_at: expect.any(String),
        p_total_meals_generated: expect.any(Number),
        p_api_calls_made: 1,
        p_generation_time_ms: expect.any(Number)
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('insert_user_notification', {
        p_user_id: userId,
        p_type: 'meal_generation_completed',
        p_title: 'Meal generation completed!',
        p_message: expect.stringContaining('meals have been generated for "Weekly Family Plan"'),
        p_job_id: jobId
      })
    })

    it('should handle background job failures gracefully', async () => {
      const jobId = 'failing-job-123'
      const userId = 'user-123'
      const groupsData = [] // Empty groups to trigger failure

      // Mock Supabase client that will fail on the meal generation step
      const mockSupabaseClient = {
        rpc: jest.fn()
          .mockResolvedValueOnce({ error: null }) // First update succeeds
          .mockRejectedValueOnce(new Error('Database error')) // Subsequent operations fail
      }

      const { createClient } = require('@/lib/supabase/server')
      createClient.mockResolvedValue(mockSupabaseClient)

      // Execute background job processing (should handle the error)
      await processJobInBackground(jobId, userId, groupsData, mockPlanData)

      // Verify error handling occurred
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'failed',
        p_completed_at: expect.any(String),
        p_error_message: expect.any(String),
        p_error_details: expect.any(Object)
      })

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('insert_user_notification', {
        p_user_id: userId,
        p_type: 'meal_generation_failed',
        p_title: 'Meal generation failed',
        p_message: expect.stringContaining('Failed to generate meals'),
        p_job_id: jobId
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing groups gracefully', async () => {
      const result = await generateMealsForPlan(mockPlanData, [])

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0].code).toBe('NO_GROUPS')
    })

    it('should handle groups with no demographics', async () => {
      const invalidGroups: StoredGroup[] = [
        {
          ...mockGroups[0],
          adults: 0,
          teens: 0,
          kids: 0,
          toddlers: 0
        }
      ]

      const singleGroupPlan: PlanData = {
        ...mockPlanData,
        group_meals: [{ group_id: 'group-1', meal_count: 2 }]
      }

      const result = await generateMealsForPlan(singleGroupPlan, invalidGroups)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some(e => e.code === 'INVALID_DEMOGRAPHICS')).toBe(true)
    })

    it('should handle mismatched group IDs', async () => {
      const mismatchedPlan: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'non-existent-group', meal_count: 3 }
        ]
      }

      const result = await generateMealsForPlan(mismatchedPlan, mockGroups)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.some(e => e.code === 'GROUP_NOT_FOUND')).toBe(true)
    })

    it('should handle excessive meal requests', async () => {
      const excessivePlan: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'group-1', meal_count: 100 } // Excessive request
        ]
      }

      const result = await generateMealsForPlan(excessivePlan, [mockGroups[0]])

      // Should either succeed with a reasonable number of meals or fail gracefully
      if (result.success) {
        expect(result.data.group_meal_options[0].generated_count).toBeLessThanOrEqual(50)
      } else {
        expect(result.errors).toBeDefined()
        expect(result.errors!.some(e => e.code === 'EXCESSIVE_MEAL_REQUEST')).toBe(true)
      }
    })
  })

  describe('Meal Quality and Validation', () => {
    it('should generate meals with proper nutritional diversity', async () => {
      const result = await generateMealsForPlan(mockPlanData, mockGroups)

      expect(result.success).toBe(true)

      if (result.success) {
        result.data.group_meal_options.forEach(groupOption => {
          const meals = groupOption.meals

          // Check for ingredient diversity across meals
          const allIngredients = meals.flatMap(meal => 
            meal.ingredients.map(ing => ing.category)
          )
          const uniqueCategories = new Set(allIngredients)

          // Should have at least 3 different ingredient categories
          expect(uniqueCategories.size).toBeGreaterThanOrEqual(3)

          // Check for cooking time variety
          const cookTimes = meals.map(meal => meal.cook_time)
          const hasVariety = Math.max(...cookTimes) - Math.min(...cookTimes) > 5

          expect(hasVariety).toBe(true)

          // Check for difficulty variety if multiple meals
          if (meals.length > 2) {
            const difficulties = new Set(meals.map(meal => meal.difficulty))
            expect(difficulties.size).toBeGreaterThan(1)
          }
        })
      }
    })

    it('should respect dietary restrictions consistently', async () => {
      const result = await generateMealsForPlan(mockPlanData, mockGroups)

      expect(result.success).toBe(true)

      if (result.success) {
        const familyGroup = result.data.group_meal_options.find(g => g.group_name === 'Test Family')
        const coupleGroup = result.data.group_meal_options.find(g => g.group_name === 'Couple Group')

        // All family meals should be vegetarian
        familyGroup?.meals.forEach(meal => {
          expect(meal.dietary_info).toContain('vegetarian')
          
          // Should not contain meat-related keywords in ingredients
          const ingredientNames = meal.ingredients.map(ing => ing.name.toLowerCase())
          const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'turkey']
          
          ingredientNames.forEach(name => {
            meatKeywords.forEach(keyword => {
              expect(name).not.toContain(keyword)
            })
          })
        })

        // All couple meals should be gluten-free
        coupleGroup?.meals.forEach(meal => {
          expect(meal.dietary_info).toContain('gluten-free')
          
          // Should not contain gluten-containing ingredients
          const ingredientNames = meal.ingredients.map(ing => ing.name.toLowerCase())
          const glutenKeywords = ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye']
          
          ingredientNames.forEach(name => {
            glutenKeywords.forEach(keyword => {
              // Allow rice flour, almond flour, etc.
              if (!name.includes('rice') && !name.includes('almond') && !name.includes('coconut')) {
                expect(name).not.toContain(keyword)
              }
            })
          })
        })
      }
    })

    it('should scale servings appropriately for group size', async () => {
      const result = await generateMealsForPlan(mockPlanData, mockGroups)

      expect(result.success).toBe(true)

      if (result.success) {
        result.data.group_meal_options.forEach(groupOption => {
          groupOption.meals.forEach(meal => {
            // Servings should be reasonable for the group size
            expect(meal.servings).toBeGreaterThanOrEqual(2)
            expect(meal.servings).toBeLessThanOrEqual(12)
            
            // Total time should be reasonable
            expect(meal.total_time).toBe(meal.prep_time + meal.cook_time)
            expect(meal.total_time).toBeGreaterThan(0)
            expect(meal.total_time).toBeLessThanOrEqual(180) // Max 3 hours
          })
        })
      }
    })
  })
})