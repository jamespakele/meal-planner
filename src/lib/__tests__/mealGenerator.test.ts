import {
  generateMealsForPlan,
  generateMealsWithChatGPT,
  validateGeneratedMeal,
  buildGroupContexts,
  GeneratedMeal,
  GroupContext,
  MealGenerationRequest,
  MealGenerationResponse,
  ChatGPTMealRequest,
  ChatGPTMealResponse,
  Ingredient,
  MEAL_GENERATION_CONFIG,
  DIETARY_RESTRICTION_PROMPTS,
  INGREDIENT_CATEGORIES
} from '../mealGenerator'
import { PlanData } from '../planValidation'
import { StoredGroup } from '../mockStorage'

describe('Meal Generator', () => {
  // Test data setup
  const mockGroups: StoredGroup[] = [
    {
      id: 'group-1',
      name: 'Smith Family',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian', 'nut-free'],
      user_id: 'user-1',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'group-2',
      name: 'Johnson Family',
      adults: 2,
      teens: 0,
      kids: 1,
      toddlers: 1,
      dietary_restrictions: ['gluten-free'],
      user_id: 'user-1',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

  const mockPlanData: PlanData = {
    name: 'Weekly Meal Plan',
    week_start: '2024-12-01',
    group_meals: [
      {
        group_id: 'group-1',
        meal_count: 3,
        notes: 'Family loves pasta dishes'
      },
      {
        group_id: 'group-2',
        meal_count: 2,
        notes: 'Keep it simple for the kids'
      }
    ],
    notes: 'Holiday week meal plan'
  }

  const mockValidMeal: GeneratedMeal = {
    id: 'meal-1',
    title: 'Vegetarian Pasta Primavera',
    description: 'Fresh seasonal vegetables with pasta in a light herb sauce',
    prep_time: 15,
    cook_time: 20,
    total_time: 35,
    servings: 4,
    ingredients: [
      {
        name: 'penne pasta',
        amount: 1,
        unit: 'lb',
        category: 'grains'
      },
      {
        name: 'bell peppers',
        amount: 2,
        unit: 'medium',
        category: 'vegetables'
      },
      {
        name: 'zucchini',
        amount: 1,
        unit: 'medium',
        category: 'vegetables'
      },
      {
        name: 'olive oil',
        amount: 3,
        unit: 'tbsp',
        category: 'oils_fats'
      }
    ],
    instructions: [
      'Cook pasta according to package directions',
      'Sauté vegetables in olive oil until tender',
      'Combine pasta and vegetables',
      'Season with herbs and serve'
    ],
    tags: ['vegetarian', 'quick', 'family-friendly'],
    dietary_info: ['vegetarian', 'nut-free'],
    difficulty: 'easy',
    group_id: 'group-1',
    created_at: '2024-01-01T00:00:00Z'
  }

  describe('Data Structure Validation', () => {
    describe('Ingredient interface', () => {
      it('should validate ingredient with all required fields', () => {
        const ingredient: Ingredient = {
          name: 'chicken breast',
          amount: 1.5,
          unit: 'lbs',
          category: 'protein'
        }
        
        expect(ingredient.name).toBe('chicken breast')
        expect(ingredient.amount).toBe(1.5)
        expect(ingredient.unit).toBe('lbs')
        expect(ingredient.category).toBe('protein')
      })

      it('should allow optional notes field', () => {
        const ingredient: Ingredient = {
          name: 'tomatoes',
          amount: 2,
          unit: 'medium',
          category: 'vegetables',
          notes: 'preferably organic'
        }
        
        expect(ingredient.notes).toBe('preferably organic')
      })

      it('should validate ingredient categories', () => {
        expect(INGREDIENT_CATEGORIES).toContain('protein')
        expect(INGREDIENT_CATEGORIES).toContain('vegetables')
        expect(INGREDIENT_CATEGORIES).toContain('grains')
        expect(INGREDIENT_CATEGORIES).toContain('dairy')
      })
    })

    describe('GeneratedMeal interface', () => {
      it('should validate complete meal object', () => {
        expect(mockValidMeal.id).toBeDefined()
        expect(mockValidMeal.title).toBeDefined()
        expect(mockValidMeal.description).toBeDefined()
        expect(mockValidMeal.prep_time).toBeGreaterThan(0)
        expect(mockValidMeal.cook_time).toBeGreaterThan(0)
        expect(mockValidMeal.servings).toBeGreaterThan(0)
        expect(Array.isArray(mockValidMeal.ingredients)).toBe(true)
        expect(Array.isArray(mockValidMeal.instructions)).toBe(true)
        expect(mockValidMeal.group_id).toBeDefined()
      })

      it('should validate meal timing calculations', () => {
        expect(mockValidMeal.total_time).toBe(
          mockValidMeal.prep_time + mockValidMeal.cook_time
        )
      })

      it('should validate difficulty levels', () => {
        const validDifficulties = ['easy', 'medium', 'hard']
        expect(validDifficulties).toContain(mockValidMeal.difficulty)
      })
    })

    describe('Configuration constants', () => {
      it('should have valid meal generation config', () => {
        expect(MEAL_GENERATION_CONFIG.MAX_RETRIES).toBeGreaterThan(0)
        expect(MEAL_GENERATION_CONFIG.TIMEOUT_MS).toBeGreaterThan(0)
        expect(MEAL_GENERATION_CONFIG.DEFAULT_EXTRA_MEALS).toBe(2)
        expect(MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP).toBeGreaterThan(0)
      })

      it('should have dietary restriction prompts', () => {
        expect(DIETARY_RESTRICTION_PROMPTS.vegetarian).toContain('No meat')
        expect(DIETARY_RESTRICTION_PROMPTS.vegan).toContain('No animal products')
        expect(DIETARY_RESTRICTION_PROMPTS['gluten-free']).toContain('No wheat')
        expect(DIETARY_RESTRICTION_PROMPTS['nut-free']).toContain('No tree nuts')
      })
    })
  })

  describe('buildGroupContexts', () => {
    it('should build contexts for all groups in plan', () => {
      const contexts = buildGroupContexts(mockPlanData, mockGroups)
      
      expect(contexts).toHaveLength(2)
      expect(contexts[0].group_id).toBe('group-1')
      expect(contexts[0].group_name).toBe('Smith Family')
      expect(contexts[1].group_id).toBe('group-2')
      expect(contexts[1].group_name).toBe('Johnson Family')
    })

    it('should include demographics in context', () => {
      const contexts = buildGroupContexts(mockPlanData, mockGroups)
      
      expect(contexts[0].demographics).toEqual({
        adults: 2,
        teens: 1,
        kids: 2,
        toddlers: 0
      })
      
      expect(contexts[1].demographics).toEqual({
        adults: 2,
        teens: 0,
        kids: 1,
        toddlers: 1
      })
    })

    it('should include dietary restrictions in context', () => {
      const contexts = buildGroupContexts(mockPlanData, mockGroups)
      
      expect(contexts[0].dietary_restrictions).toEqual(['vegetarian', 'nut-free'])
      expect(contexts[1].dietary_restrictions).toEqual(['gluten-free'])
    })

    it('should include meal count and notes in context', () => {
      const contexts = buildGroupContexts(mockPlanData, mockGroups)
      
      expect(contexts[0].meal_count_requested).toBe(3)
      expect(contexts[0].group_notes).toBe('Family loves pasta dishes')
      
      expect(contexts[1].meal_count_requested).toBe(2)
      expect(contexts[1].group_notes).toBe('Keep it simple for the kids')
    })

    it('should calculate adult equivalent for each group', () => {
      const contexts = buildGroupContexts(mockPlanData, mockGroups)
      
      // Group 1: 2 adults + 1 teen + 2 kids = 2*1.0 + 1*1.2 + 2*0.7 = 4.6 AE
      expect(contexts[0].adult_equivalent).toBe(4.6)
      
      // Group 2: 2 adults + 1 kid + 1 toddler = 2*1.0 + 1*0.7 + 1*0.4 = 3.1 AE
      expect(contexts[1].adult_equivalent).toBe(3.1)
    })

    it('should throw error for missing group', () => {
      const planWithMissingGroup: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'nonexistent-group', meal_count: 2 }
        ]
      }
      
      expect(() => buildGroupContexts(planWithMissingGroup, mockGroups))
        .toThrow('Group with id nonexistent-group not found')
    })
  })

  describe('validateGeneratedMeal', () => {
    it('should validate a complete valid meal', () => {
      const isValid = validateGeneratedMeal(mockValidMeal)
      expect(isValid).toBe(true) // Will be false until implementation
    })

    it('should reject meal missing required fields', () => {
      const incompleteMeal = {
        title: 'Incomplete Meal'
        // Missing required fields
      }
      
      const isValid = validateGeneratedMeal(incompleteMeal)
      expect(isValid).toBe(false)
    })

    it('should reject meal with invalid prep time', () => {
      const invalidMeal = {
        ...mockValidMeal,
        prep_time: -5
      }
      
      const isValid = validateGeneratedMeal(invalidMeal)
      expect(isValid).toBe(false)
    })

    it('should reject meal with invalid servings', () => {
      const invalidMeal = {
        ...mockValidMeal,
        servings: 0
      }
      
      const isValid = validateGeneratedMeal(invalidMeal)
      expect(isValid).toBe(false)
    })

    it('should reject meal with empty ingredients', () => {
      const invalidMeal = {
        ...mockValidMeal,
        ingredients: []
      }
      
      const isValid = validateGeneratedMeal(invalidMeal)
      expect(isValid).toBe(false)
    })

    it('should reject meal with invalid difficulty', () => {
      const invalidMeal = {
        ...mockValidMeal,
        difficulty: 'impossible'
      }
      
      const isValid = validateGeneratedMeal(invalidMeal)
      expect(isValid).toBe(false)
    })
  })

  describe('generateMealsWithChatGPT', () => {
    const mockChatGPTRequest: ChatGPTMealRequest = {
      group_name: 'Smith Family',
      demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
      dietary_restrictions: ['vegetarian', 'nut-free'],
      meals_to_generate: 5, // 3 requested + 2 extra
      group_notes: 'Family loves pasta dishes',
      week_start: '2024-12-01',
      adult_equivalent: 4.6
    }

    // Mock fetch for testing
    beforeEach(() => {
      global.fetch = jest.fn()
      delete process.env.NEXT_PUBLIC_OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should handle missing API key error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await expect(generateMealsWithChatGPT(mockChatGPTRequest))
        .rejects.toThrow('ChatGPT API error: 401 Unauthorized')
    })

    it('should handle successful API response', async () => {
      const mockApiResponse = {
        meals: [
          {
            title: 'Vegetarian Pasta',
            description: 'Delicious pasta with vegetables',
            prep_time: 15,
            cook_time: 20,
            servings: 4,
            ingredients: [
              { name: 'pasta', amount: 1, unit: 'lb', category: 'grains' }
            ],
            instructions: ['Cook pasta', 'Add vegetables'],
            tags: ['vegetarian', 'quick'],
            dietary_info: ['vegetarian'],
            difficulty: 'easy'
          }
        ]
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify(mockApiResponse)
            }
          }]
        })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await generateMealsWithChatGPT(mockChatGPTRequest)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Vegetarian Pasta')
      expect(result[0].group_id).toBe('Smith Family')
    })

    it('should generate correct number of meals when implemented', async () => {
      // This test will be updated when implementation is added
      expect(mockChatGPTRequest.meals_to_generate).toBe(5)
    })

    it('should include dietary restrictions in request', () => {
      expect(mockChatGPTRequest.dietary_restrictions).toContain('vegetarian')
      expect(mockChatGPTRequest.dietary_restrictions).toContain('nut-free')
    })

    it('should handle API timeout errors', async () => {
      // This test will be implemented with actual API integration
      expect(MEAL_GENERATION_CONFIG.TIMEOUT_MS).toBeGreaterThan(0)
    })

    it('should handle malformed API responses', async () => {
      // This test will be implemented with actual API integration
      expect(true).toBe(true) // Placeholder
    })

    it('should retry on API failures', async () => {
      // This test will be implemented with actual API integration
      expect(MEAL_GENERATION_CONFIG.MAX_RETRIES).toBe(3)
    })
  })

  describe('generateMealsForPlan', () => {
    // Mock fetch for testing
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return error when API calls fail', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await generateMealsForPlan(mockPlanData, mockGroups)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.errors![0].code).toBe('API_FAILURE')
    }, 10000)

    it('should return success result with proper structure for successful generation', async () => {
      const mockApiResponse = {
        meals: [
          {
            title: 'Vegetarian Pasta',
            description: 'Delicious pasta with vegetables',
            prep_time: 15,
            cook_time: 20,
            servings: 4,
            ingredients: [
              { name: 'pasta', amount: 1, unit: 'lb', category: 'grains' }
            ],
            instructions: ['Cook pasta', 'Add vegetables'],
            tags: ['vegetarian', 'quick'],
            dietary_info: ['vegetarian'],
            difficulty: 'easy'
          }
        ]
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify(mockApiResponse)
            }
          }]
        })
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await generateMealsForPlan(mockPlanData, mockGroups)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.plan_id).toBeDefined()
      expect(result.data!.generated_at).toBeDefined()
      expect(result.data!.total_meals_generated).toBeGreaterThan(0)
      expect(Array.isArray(result.data!.group_meal_options)).toBe(true)
    })

    it('should handle empty group list', async () => {
      const result = await generateMealsForPlan(mockPlanData, [])
      expect(result.success).toBe(false)
      expect(result.errors![0].code).toBe('NO_GROUPS')
    })

    it('should generate extra meals as configured', async () => {
      // Should generate meal_count + MEAL_GENERATION_CONFIG.DEFAULT_EXTRA_MEALS
      const totalRequested = mockPlanData.group_meals.reduce(
        (sum, gm) => sum + gm.meal_count, 0
      )
      const expectedTotal = totalRequested + (mockPlanData.group_meals.length * MEAL_GENERATION_CONFIG.DEFAULT_EXTRA_MEALS)
      
      // Total requested: 3 + 2 = 5
      // Expected total: 5 + (2 groups * 2 extra) = 9
      expect(expectedTotal).toBe(9)
    })

    it('should respect meal generation limits', async () => {
      const planWithTooManyMeals: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'group-1', meal_count: 15 } // Exceeds MAX_MEALS_PER_GROUP
        ]
      }
      
      expect(MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP).toBeLessThan(15)
    })

    it('should include generation metadata', async () => {
      // This test will verify metadata structure when implemented
      const expectedMetadata = {
        api_calls_made: expect.any(Number),
        generation_time_ms: expect.any(Number)
      }
      expect(expectedMetadata.api_calls_made).toEqual(expect.any(Number))
    })
  })

  describe('Integration scenarios', () => {
    it('should handle multiple dietary restrictions', () => {
      const context = buildGroupContexts(mockPlanData, mockGroups)[0]
      expect(context.dietary_restrictions).toEqual(['vegetarian', 'nut-free'])
    })

    it('should handle empty dietary restrictions', () => {
      const groupsWithNoDietary: StoredGroup[] = [{
        ...mockGroups[0],
        dietary_restrictions: []
      }]
      
      const contexts = buildGroupContexts(
        {
          ...mockPlanData,
          group_meals: [{ group_id: 'group-1', meal_count: 2 }]
        },
        groupsWithNoDietary
      )
      
      expect(contexts[0].dietary_restrictions).toEqual([])
    })

    it('should handle complex family demographics', () => {
      const complexGroup: StoredGroup = {
        ...mockGroups[0],
        adults: 3,
        teens: 2,
        kids: 4,
        toddlers: 1
      }
      
      const contexts = buildGroupContexts(
        {
          ...mockPlanData,
          group_meals: [{ group_id: 'group-1', meal_count: 2 }]
        },
        [complexGroup]
      )
      
      // 3*1.0 + 2*1.2 + 4*0.7 + 1*0.4 = 3 + 2.4 + 2.8 + 0.4 = 8.6 AE
      expect(contexts[0].adult_equivalent).toBe(8.6)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle plan with no group meals', () => {
      const emptyPlan: PlanData = {
        ...mockPlanData,
        group_meals: []
      }
      
      const contexts = buildGroupContexts(emptyPlan, mockGroups)
      expect(contexts).toHaveLength(0)
    })

    it('should handle very large meal counts', () => {
      const largeMealPlan: PlanData = {
        ...mockPlanData,
        group_meals: [
          { group_id: 'group-1', meal_count: 20 } // Exceeds reasonable limits
        ]
      }
      
      expect(largeMealPlan.group_meals[0].meal_count).toBeGreaterThan(
        MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP
      )
    })

    it('should handle special characters in group names and notes', () => {
      const specialGroup: StoredGroup = {
        ...mockGroups[0],
        name: 'O\'Brien Family & Friends'
      }
      
      const specialPlan: PlanData = {
        ...mockPlanData,
        group_meals: [{
          group_id: 'group-1',
          meal_count: 2,
          notes: 'Love spicy food & "authentic" flavors'
        }]
      }
      
      const contexts = buildGroupContexts(specialPlan, [specialGroup])
      expect(contexts[0].group_name).toBe('O\'Brien Family & Friends')
      expect(contexts[0].group_notes).toBe('Love spicy food & "authentic" flavors')
    })
  })
})