/**
 * Meal Generator Service - ChatGPT API Integration
 * Generates meal options based on group demographics and dietary restrictions
 */

import { calculateAdultEquivalent, Demographics } from './adultEquivalent'
import { PlanData, GroupMealAssignment } from './planValidation'
import { StoredGroup } from './mockStorage'

// Core data structures for meal generation
export interface Ingredient {
  name: string
  amount: number
  unit: string
  category: string
  notes?: string
}

export interface GeneratedMeal {
  id: string
  title: string
  description: string
  prep_time: number // minutes
  cook_time: number // minutes
  total_time: number // minutes
  servings: number // base servings before AE scaling
  ingredients: Ingredient[]
  instructions: string[]
  tags: string[]
  dietary_info: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  group_id: string // which group this meal was generated for
  created_at: string
}

export interface GroupContext {
  group_id: string
  group_name: string
  demographics: Demographics
  dietary_restrictions: string[]
  meal_count_requested: number
  group_notes?: string
  adult_equivalent: number
}

export interface MealGenerationRequest {
  plan_name: string
  week_start: string
  group_contexts: GroupContext[]
  additional_notes?: string
}

export interface GroupMealOptions {
  group_id: string
  group_name: string
  requested_count: number
  generated_count: number
  meals: GeneratedMeal[]
  adult_equivalent: number
  total_servings_needed: number
}

export interface MealGenerationResponse {
  plan_id: string
  generated_at: string
  total_meals_generated: number
  group_meal_options: GroupMealOptions[]
  generation_metadata: {
    api_calls_made: number
    total_tokens_used?: number
    generation_time_ms: number
  }
}

export interface ChatGPTMealRequest {
  group_name: string
  demographics: Demographics
  dietary_restrictions: string[]
  meals_to_generate: number
  group_notes?: string
  week_start: string
  adult_equivalent: number
}

export interface ChatGPTMealResponse {
  meals: Array<{
    title: string
    description: string
    prep_time: number
    cook_time: number
    servings: number
    ingredients: Array<{
      name: string
      amount: number
      unit: string
      category: string
    }>
    instructions: string[]
    tags: string[]
    dietary_info: string[]
    difficulty: string
  }>
}

// Validation interfaces
export interface MealGenerationError {
  code: string
  message: string
  group_id?: string
  details?: any
}

export interface MealGenerationResult {
  success: boolean
  data?: MealGenerationResponse
  errors?: MealGenerationError[]
}

// Configuration constants
export const MEAL_GENERATION_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
  DEFAULT_EXTRA_MEALS: 2, // Generate 2 more than requested
  MAX_MEALS_PER_GROUP: 10,
  MIN_PREP_TIME: 5,
  MAX_PREP_TIME: 240,
  MIN_SERVINGS: 1,
  MAX_SERVINGS: 20
} as const

// Ingredient categories for organization
export const INGREDIENT_CATEGORIES = [
  'protein',
  'vegetables',
  'fruits',
  'grains',
  'dairy',
  'oils_fats',
  'spices_herbs',
  'condiments',
  'pantry',
  'frozen',
  'canned',
  'other'
] as const

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number]

// Dietary restriction mappings for ChatGPT prompts
export const DIETARY_RESTRICTION_PROMPTS = {
  'vegetarian': 'No meat, poultry, or fish. Eggs and dairy are acceptable.',
  'vegan': 'No animal products whatsoever including meat, dairy, eggs, honey.',
  'gluten-free': 'No wheat, barley, rye, or other gluten-containing grains.',
  'dairy-free': 'No milk, cheese, butter, yogurt, or other dairy products.',
  'nut-free': 'No tree nuts or peanuts. Check all ingredients for nut contamination.',
  'low-sodium': 'Use minimal salt and avoid high-sodium processed ingredients.',
  'diabetic-friendly': 'Low sugar, complex carbohydrates, balanced nutrition.',
  'keto': 'Very low carbohydrate, high fat, moderate protein.',
  'paleo': 'No grains, legumes, dairy, or processed foods. Focus on whole foods.',
  'mediterranean': 'Emphasize olive oil, fish, vegetables, whole grains, and legumes.'
} as const

/**
 * Main meal generation function
 */
export async function generateMealsForPlan(
  planData: PlanData,
  availableGroups: StoredGroup[]
): Promise<MealGenerationResult> {
  const startTime = Date.now()
  const errors: MealGenerationError[] = []
  const groupMealOptions: GroupMealOptions[] = []
  let totalApiCalls = 0
  let totalTokens = 0

  try {
    // Check if we have groups first  
    if (!availableGroups || availableGroups.length === 0) {
      return {
        success: false,
        errors: [{
          code: 'NO_GROUPS',
          message: 'No groups available for meal generation'
        }]
      }
    }

    // Build contexts for all groups
    const groupContexts = buildGroupContexts(planData, availableGroups)
    
    if (groupContexts.length === 0) {
      return {
        success: false,
        errors: [{
          code: 'NO_GROUPS',
          message: 'No groups found in plan'
        }]
      }
    }

    // Generate meals for each group
    for (const context of groupContexts) {
      const mealsToGenerate = context.meal_count_requested + MEAL_GENERATION_CONFIG.DEFAULT_EXTRA_MEALS
      
      // Check limits
      if (mealsToGenerate > MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP) {
        errors.push({
          code: 'MEAL_LIMIT_EXCEEDED',
          message: `Cannot generate ${mealsToGenerate} meals for ${context.group_name}. Maximum is ${MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP}`,
          group_id: context.group_id
        })
        continue
      }

      // Prepare ChatGPT request
      const chatGPTRequest: ChatGPTMealRequest = {
        group_name: context.group_name,
        demographics: context.demographics,
        dietary_restrictions: context.dietary_restrictions,
        meals_to_generate: mealsToGenerate,
        group_notes: context.group_notes,
        week_start: planData.week_start,
        adult_equivalent: context.adult_equivalent
      }

      let retryCount = 0
      let groupMeals: GeneratedMeal[] = []

      // Retry logic for API calls
      while (retryCount < MEAL_GENERATION_CONFIG.MAX_RETRIES && groupMeals.length === 0) {
        try {
          groupMeals = await generateMealsWithChatGPT(chatGPTRequest)
          totalApiCalls++
        } catch (error) {
          retryCount++
          console.warn(`Meal generation attempt ${retryCount} failed for ${context.group_name}:`, error)
          
          if (retryCount >= MEAL_GENERATION_CONFIG.MAX_RETRIES) {
            errors.push({
              code: 'API_FAILURE',
              message: `Failed to generate meals after ${MEAL_GENERATION_CONFIG.MAX_RETRIES} attempts`,
              group_id: context.group_id,
              details: error instanceof Error ? error.message : 'Unknown error'
            })
          } else {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
          }
        }
      }

      if (groupMeals.length > 0) {
        // Calculate total servings needed (base servings * adult equivalent scaling factor)
        const scalingFactor = context.adult_equivalent / 4 // Assuming base recipes serve 4
        const totalServingsNeeded = Math.ceil(groupMeals[0]?.servings * scalingFactor) || context.adult_equivalent

        groupMealOptions.push({
          group_id: context.group_id,
          group_name: context.group_name,
          requested_count: context.meal_count_requested,
          generated_count: groupMeals.length,
          meals: groupMeals,
          adult_equivalent: context.adult_equivalent,
          total_servings_needed: totalServingsNeeded
        })
      }
    }

    // Calculate final results
    const totalMealsGenerated = groupMealOptions.reduce(
      (sum, option) => sum + option.generated_count, 0
    )
    const generationTime = Date.now() - startTime

    // Determine success based on whether we got meals for all groups
    const allGroupsSuccessful = groupContexts.length === groupMealOptions.length
    const hasErrors = errors.length > 0

    if (allGroupsSuccessful && !hasErrors) {
      return {
        success: true,
        data: {
          plan_id: `plan-${Date.now()}`,
          generated_at: new Date().toISOString(),
          total_meals_generated: totalMealsGenerated,
          group_meal_options: groupMealOptions,
          generation_metadata: {
            api_calls_made: totalApiCalls,
            total_tokens_used: totalTokens > 0 ? totalTokens : undefined,
            generation_time_ms: generationTime
          }
        }
      }
    } else {
      return {
        success: false,
        data: totalMealsGenerated > 0 ? {
          plan_id: `plan-${Date.now()}`,
          generated_at: new Date().toISOString(),
          total_meals_generated: totalMealsGenerated,
          group_meal_options: groupMealOptions,
          generation_metadata: {
            api_calls_made: totalApiCalls,
            total_tokens_used: totalTokens > 0 ? totalTokens : undefined,
            generation_time_ms: generationTime
          }
        } : undefined,
        errors
      }
    }

  } catch (error) {
    return {
      success: false,
      errors: [{
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }]
    }
  }
}

/**
 * ChatGPT API integration
 */
export async function generateMealsWithChatGPT(
  request: ChatGPTMealRequest
): Promise<GeneratedMeal[]> {
  const {
    group_name,
    demographics,
    dietary_restrictions,
    meals_to_generate,
    group_notes,
    week_start,
    adult_equivalent
  } = request

  // Build dietary restrictions context
  const dietaryContext = dietary_restrictions.length > 0
    ? dietary_restrictions.map(restriction => 
        DIETARY_RESTRICTION_PROMPTS[restriction as keyof typeof DIETARY_RESTRICTION_PROMPTS] || restriction
      ).join(' ')
    : 'No specific dietary restrictions.'

  // Build demographics context
  const demoContext = `${demographics.adults} adults, ${demographics.teens} teens, ${demographics.kids} kids, ${demographics.toddlers} toddlers (${adult_equivalent} adult equivalents)`

  // Build the ChatGPT prompt
  const prompt = `Generate ${meals_to_generate} meal options for "${group_name}" with ${demoContext}.

DIETARY REQUIREMENTS: ${dietaryContext}

CONTEXT:
- Week starting: ${week_start}
- Group notes: ${group_notes || 'None specified'}
- Scale ingredients for ${adult_equivalent} adult equivalent servings

REQUIREMENTS:
- Each meal must include title, description, prep_time (minutes), cook_time (minutes), servings (base servings before scaling), ingredients with amounts/units/categories, step-by-step instructions, tags, dietary_info, and difficulty level (easy/medium/hard)
- Ingredients must be categorized: ${INGREDIENT_CATEGORIES.join(', ')}
- Base servings should be 4-6 people, ingredients will be scaled later
- Variety in cuisine types and cooking methods
- Family-friendly options when kids/toddlers are present

Return ONLY valid JSON in this exact format:
{
  "meals": [
    {
      "title": "Meal Name",
      "description": "Brief description",
      "prep_time": 15,
      "cook_time": 25,
      "servings": 4,
      "ingredients": [
        {
          "name": "ingredient name",
          "amount": 1.5,
          "unit": "lbs",
          "category": "protein"
        }
      ],
      "instructions": ["Step 1", "Step 2"],
      "tags": ["quick", "family-friendly"],
      "dietary_info": ["vegetarian"],
      "difficulty": "easy"
    }
  ]
}`

  try {
    // Make API call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional meal planning assistant. Generate meal suggestions that are practical, nutritious, and appropriate for the specified demographics and dietary restrictions. Return ONLY valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(MEAL_GENERATION_CONFIG.TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from ChatGPT API')
    }

    // Parse the JSON response
    let parsedResponse: ChatGPTMealResponse
    try {
      parsedResponse = JSON.parse(content)
    } catch (parseError) {
      throw new Error(`Failed to parse ChatGPT response as JSON: ${parseError}`)
    }

    if (!parsedResponse.meals || !Array.isArray(parsedResponse.meals)) {
      throw new Error('ChatGPT response missing meals array')
    }

    // Convert ChatGPT response to GeneratedMeal objects
    const generatedMeals: GeneratedMeal[] = parsedResponse.meals.map((meal, index) => ({
      id: `meal-${Date.now()}-${index}`,
      title: meal.title,
      description: meal.description,
      prep_time: meal.prep_time,
      cook_time: meal.cook_time,
      total_time: meal.prep_time + meal.cook_time,
      servings: meal.servings,
      ingredients: meal.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category
      })),
      instructions: meal.instructions,
      tags: meal.tags,
      dietary_info: meal.dietary_info,
      difficulty: meal.difficulty as 'easy' | 'medium' | 'hard',
      group_id: request.group_name, // Using group_name as identifier for now
      created_at: new Date().toISOString()
    }))

    // Validate each generated meal
    const validMeals = generatedMeals.filter(meal => {
      const isValid = validateGeneratedMeal(meal)
      if (!isValid) {
        console.warn('Invalid meal generated:', meal.title)
      }
      return isValid
    })

    if (validMeals.length === 0) {
      throw new Error('No valid meals were generated')
    }

    return validMeals

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Meal generation failed: ${error.message}`)
    }
    throw new Error('Meal generation failed with unknown error')
  }
}

/**
 * Meal validation and parsing
 */
export function validateGeneratedMeal(meal: any): meal is GeneratedMeal {
  if (!meal || typeof meal !== 'object') {
    return false
  }

  // Validate required string fields
  const requiredStringFields = ['id', 'title', 'description', 'group_id', 'created_at']
  for (const field of requiredStringFields) {
    if (!meal[field] || typeof meal[field] !== 'string' || meal[field].trim().length === 0) {
      return false
    }
  }

  // Validate numeric fields
  if (typeof meal.prep_time !== 'number' || meal.prep_time < MEAL_GENERATION_CONFIG.MIN_PREP_TIME || meal.prep_time > MEAL_GENERATION_CONFIG.MAX_PREP_TIME) {
    return false
  }

  if (typeof meal.cook_time !== 'number' || meal.cook_time < 0) {
    return false
  }

  if (typeof meal.total_time !== 'number' || meal.total_time !== meal.prep_time + meal.cook_time) {
    return false
  }

  if (typeof meal.servings !== 'number' || meal.servings < MEAL_GENERATION_CONFIG.MIN_SERVINGS || meal.servings > MEAL_GENERATION_CONFIG.MAX_SERVINGS) {
    return false
  }

  // Validate ingredients array
  if (!Array.isArray(meal.ingredients) || meal.ingredients.length === 0) {
    return false
  }

  for (const ingredient of meal.ingredients) {
    if (!validateIngredient(ingredient)) {
      return false
    }
  }

  // Validate instructions array
  if (!Array.isArray(meal.instructions) || meal.instructions.length === 0) {
    return false
  }

  for (const instruction of meal.instructions) {
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      return false
    }
  }

  // Validate tags and dietary_info arrays
  if (!Array.isArray(meal.tags) || !Array.isArray(meal.dietary_info)) {
    return false
  }

  for (const tag of meal.tags) {
    if (typeof tag !== 'string' || tag.trim().length === 0) {
      return false
    }
  }

  for (const info of meal.dietary_info) {
    if (typeof info !== 'string' || info.trim().length === 0) {
      return false
    }
  }

  // Validate difficulty
  const validDifficulties = ['easy', 'medium', 'hard']
  if (!validDifficulties.includes(meal.difficulty)) {
    return false
  }

  return true
}

/**
 * Validate individual ingredient
 */
export function validateIngredient(ingredient: any): ingredient is Ingredient {
  if (!ingredient || typeof ingredient !== 'object') {
    return false
  }

  // Validate required fields
  if (typeof ingredient.name !== 'string' || ingredient.name.trim().length === 0) {
    return false
  }

  if (typeof ingredient.amount !== 'number' || ingredient.amount <= 0) {
    return false
  }

  if (typeof ingredient.unit !== 'string' || ingredient.unit.trim().length === 0) {
    return false
  }

  if (typeof ingredient.category !== 'string' || !INGREDIENT_CATEGORIES.includes(ingredient.category as any)) {
    return false
  }

  // Validate optional notes field
  if (ingredient.notes !== undefined && typeof ingredient.notes !== 'string') {
    return false
  }

  return true
}

/**
 * Build context for meal generation from plan and groups
 */
export function buildGroupContexts(
  planData: PlanData,
  availableGroups: StoredGroup[]
): GroupContext[] {
  return planData.group_meals.map(groupMeal => {
    const group = availableGroups.find(g => g.id === groupMeal.group_id)
    if (!group) {
      throw new Error(`Group with id ${groupMeal.group_id} not found`)
    }

    const demographics: Demographics = {
      adults: group.adults,
      teens: group.teens,
      kids: group.kids,
      toddlers: group.toddlers
    }

    const adult_equivalent = calculateAdultEquivalent(demographics)

    return {
      group_id: group.id,
      group_name: group.name,
      demographics,
      dietary_restrictions: group.dietary_restrictions,
      meal_count_requested: groupMeal.meal_count,
      group_notes: groupMeal.notes,
      adult_equivalent
    }
  })
}