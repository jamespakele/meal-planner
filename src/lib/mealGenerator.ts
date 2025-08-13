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

export interface CombinedChatGPTMealRequest {
  plan_name: string
  week_start: string
  groups: Array<{
    group_name: string
    demographics: Demographics
    dietary_restrictions: string[]
    meals_to_generate: number
    group_notes?: string
    adult_equivalent: number
  }>
  additional_notes?: string
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

export interface CombinedChatGPTMealResponse {
  groups: Array<{
    group_name: string
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
  TIMEOUT_MS: 60000,
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

    // Use combined approach - single API call for all groups
    const combinedRequest: CombinedChatGPTMealRequest = {
      plan_name: planData.name,
      week_start: planData.week_start,
      additional_notes: planData.notes,
      groups: groupContexts.map(context => {
        const mealsToGenerate = context.meal_count_requested + MEAL_GENERATION_CONFIG.DEFAULT_EXTRA_MEALS
        
        // Check limits per group
        if (mealsToGenerate > MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP) {
          errors.push({
            code: 'MEAL_LIMIT_EXCEEDED',
            message: `Cannot generate ${mealsToGenerate} meals for ${context.group_name}. Maximum is ${MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP}`,
            group_id: context.group_id
          })
        }

        return {
          group_name: context.group_name,
          demographics: context.demographics,
          dietary_restrictions: context.dietary_restrictions,
          meals_to_generate: mealsToGenerate,
          group_notes: context.group_notes,
          adult_equivalent: context.adult_equivalent
        }
      })
    }

    // Filter out groups that exceeded limits
    const validGroups = combinedRequest.groups.filter(group => {
      const mealsToGenerate = group.meals_to_generate
      return mealsToGenerate <= MEAL_GENERATION_CONFIG.MAX_MEALS_PER_GROUP
    })

    if (validGroups.length === 0) {
      return {
        success: false,
        errors
      }
    }

    combinedRequest.groups = validGroups

    let retryCount = 0
    let allGroupMeals: Record<string, GeneratedMeal[]> = {}

    // Retry logic for the combined API call
    while (retryCount < MEAL_GENERATION_CONFIG.MAX_RETRIES && Object.keys(allGroupMeals).length === 0) {
      try {
        allGroupMeals = await generateMealsWithCombinedChatGPT(combinedRequest)
        totalApiCalls++
      } catch (error) {
        retryCount++
        console.warn(`Combined meal generation attempt ${retryCount} failed:`, error)
        
        if (retryCount >= MEAL_GENERATION_CONFIG.MAX_RETRIES) {
          errors.push({
            code: 'API_FAILURE',
            message: `Failed to generate meals after ${MEAL_GENERATION_CONFIG.MAX_RETRIES} attempts`,
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
        }
      }
    }

    // Process results for each group
    for (const context of groupContexts) {
      const groupMeals = allGroupMeals[context.group_name] || []
      
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
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional meal planning assistant. Generate meal suggestions that are practical, nutritious, and appropriate for the specified demographics and dietary restrictions. CRITICAL: You must return ONLY valid JSON with no additional text, markdown formatting, or explanations. The response must be parseable by JSON.parse().'
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

    // Parse the JSON response with improved error handling
    let parsedResponse: ChatGPTMealResponse
    try {
      // Clean the content first - remove potential markdown formatting or extra text
      let cleanContent = content.trim()
      
      // Look for JSON content between braces if there's extra text
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0]
      }
      
      // Try to fix common JSON issues
      cleanContent = cleanContent
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      
      parsedResponse = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error(`[MEAL_GEN] JSON parsing failed. Original content:`, content)
      
      // Try one more aggressive cleaning attempt
      try {
        let aggressiveClean = content
          .replace(/```json/g, '') // Remove markdown
          .replace(/```/g, '') // Remove markdown
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        // Find the main JSON object
        const startBrace = aggressiveClean.indexOf('{')
        const lastBrace = aggressiveClean.lastIndexOf('}')
        
        if (startBrace !== -1 && lastBrace !== -1 && lastBrace > startBrace) {
          aggressiveClean = aggressiveClean.substring(startBrace, lastBrace + 1)
          parsedResponse = JSON.parse(aggressiveClean)
        } else {
          throw parseError
        }
      } catch (secondaryError) {
        throw new Error(`Failed to parse ChatGPT response as JSON: ${parseError}`)
      }
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
    const validMeals: GeneratedMeal[] = []
    generatedMeals.forEach(meal => {
      const isValid = validateGeneratedMeal(meal)
      if (isValid) {
        validMeals.push(meal)
      } else {
        console.warn('Invalid meal generated:', (meal as any)?.title || 'Unknown')
      }
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
 * Combined ChatGPT API integration - single call for multiple groups
 */
export async function generateMealsWithCombinedChatGPT(
  request: CombinedChatGPTMealRequest
): Promise<Record<string, GeneratedMeal[]>> {
  const { plan_name, week_start, groups, additional_notes } = request

  // Build the combined prompt
  let prompt = `Generate meal options for meal plan "${plan_name}" starting week of ${week_start}.\n\n`

  if (additional_notes) {
    prompt += `PLAN NOTES: ${additional_notes}\n\n`
  }

  prompt += `GROUPS TO GENERATE FOR:\n`

  groups.forEach((group, index) => {
    const { group_name, demographics, dietary_restrictions, meals_to_generate, group_notes, adult_equivalent } = group

    // Build dietary restrictions context
    const dietaryContext = dietary_restrictions.length > 0
      ? dietary_restrictions.map(restriction => 
          DIETARY_RESTRICTION_PROMPTS[restriction as keyof typeof DIETARY_RESTRICTION_PROMPTS] || restriction
        ).join(' ')
      : 'No specific dietary restrictions.'

    // Build demographics context
    const demoContext = `${demographics.adults} adults, ${demographics.teens} teens, ${demographics.kids} kids, ${demographics.toddlers} toddlers (${adult_equivalent} adult equivalents)`

    prompt += `
${index + 1}. GROUP: "${group_name}"
   - Demographics: ${demoContext}
   - Dietary Requirements: ${dietaryContext}
   - Meals needed: ${meals_to_generate}
   - Group notes: ${group_notes || 'None specified'}
   - Scale ingredients for ${adult_equivalent} adult equivalent servings
`
  })

  prompt += `
REQUIREMENTS:
- Generate meals for ALL groups listed above
- Each meal must include title, description, prep_time (minutes), cook_time (minutes), servings (base servings before scaling), ingredients with amounts/units/categories, step-by-step instructions, tags, dietary_info, and difficulty level (easy/medium/hard)
- Ingredients must be categorized: ${INGREDIENT_CATEGORIES.join(', ')}
- Base servings should be 4-6 people, ingredients will be scaled later
- Variety in cuisine types and cooking methods
- Family-friendly options when kids/toddlers are present
- Respect each group's dietary restrictions

Return ONLY valid JSON in this exact format:
{
  "groups": [`

  groups.forEach((group, index) => {
    prompt += `${index > 0 ? ',' : ''}
    {
      "group_name": "${group.group_name}",
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
  })

  prompt += `
  ]
}`

  try {
    // Development mode: Use mock data instead of actual API call
    console.log(`[MEAL_GEN] NODE_ENV: ${process.env.NODE_ENV}, OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`)
    console.log(`[MEAL_GEN] OPENAI_API_KEY length: ${process.env.OPENAI_API_KEY?.length || 0}`)
    console.log(`[MEAL_GEN] OPENAI_API_KEY starts with: ${process.env.OPENAI_API_KEY?.substring(0, 10)}...`)
    
    if (process.env.NODE_ENV === 'development' && !process.env.OPENAI_API_KEY) {
      console.log(`[MEAL_GEN] Using mock data for development mode`)
      return generateMockMealsForCombinedRequest(request)
    }
    
    console.log(`[MEAL_GEN] Making actual API call to ChatGPT`)
    console.log(`[MEAL_GEN] Request URL: https://api.openai.com/v1/chat/completions`)
    console.log(`[MEAL_GEN] Using model: gpt-4`)
    console.log(`[MEAL_GEN] Timeout: ${MEAL_GENERATION_CONFIG.TIMEOUT_MS}ms`)
    console.log(`[MEAL_GEN] Prompt length: ${prompt.length} characters`)

    // Make API call to OpenAI
    let response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional meal planning assistant. Generate meal suggestions that are practical, nutritious, and appropriate for the specified demographics and dietary restrictions. CRITICAL: You must return ONLY valid JSON with no additional text, markdown formatting, or explanations. The response must be parseable by JSON.parse().'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000, // GPT-3.5-turbo max is 4096
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(MEAL_GENERATION_CONFIG.TIMEOUT_MS)
    })

      console.log(`[MEAL_GEN] API Response received - Status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[MEAL_GEN] API Error Response:`, errorText)
        throw new Error(`ChatGPT API error: ${response.status} ${response.statusText} - ${errorText}`)
      }
    } catch (fetchError) {
      console.error(`[MEAL_GEN] Fetch failed:`, fetchError)
      if (fetchError.name === 'AbortError' || fetchError.message.includes('aborted')) {
        throw new Error('Request timed out - try reducing the number of meals or groups')
      }
      throw fetchError
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from ChatGPT API')
    }

    // Parse the JSON response with improved error handling
    let parsedResponse: CombinedChatGPTMealResponse
    try {
      // Clean the content first - remove potential markdown formatting or extra text
      let cleanContent = content.trim()
      
      // Look for JSON content between braces if there's extra text
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0]
      }
      
      // Try to fix common JSON issues
      cleanContent = cleanContent
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      
      console.log(`[MEAL_GEN] Attempting to parse cleaned JSON (${cleanContent.length} chars)`)
      console.log(`[MEAL_GEN] First 200 chars: ${cleanContent.substring(0, 200)}`)
      
      parsedResponse = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error(`[MEAL_GEN] JSON parsing failed. Original content:`, content)
      console.error(`[MEAL_GEN] Parse error:`, parseError)
      
      // Try one more aggressive cleaning attempt
      try {
        let aggressiveClean = content
          .replace(/```json/g, '') // Remove markdown
          .replace(/```/g, '') // Remove markdown
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        // Find the main JSON object
        const startBrace = aggressiveClean.indexOf('{')
        const lastBrace = aggressiveClean.lastIndexOf('}')
        
        if (startBrace !== -1 && lastBrace !== -1 && lastBrace > startBrace) {
          aggressiveClean = aggressiveClean.substring(startBrace, lastBrace + 1)
          console.log(`[MEAL_GEN] Trying aggressive cleanup: ${aggressiveClean.substring(0, 200)}...`)
          parsedResponse = JSON.parse(aggressiveClean)
        } else {
          throw parseError
        }
      } catch (secondaryError) {
        throw new Error(`Failed to parse ChatGPT response as JSON: ${parseError}`)
      }
    }

    if (!parsedResponse.groups || !Array.isArray(parsedResponse.groups)) {
      throw new Error('ChatGPT response missing groups array')
    }

    // Convert to grouped meals
    const groupedMeals: Record<string, GeneratedMeal[]> = {}

    parsedResponse.groups.forEach(group => {
      const groupMeals: GeneratedMeal[] = group.meals.map((meal, index) => ({
        id: `meal-${Date.now()}-${group.group_name}-${index}`,
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
        group_id: group.group_name, // Using group_name as identifier for now
        created_at: new Date().toISOString()
      }))

      // Validate each generated meal
      const validMeals: GeneratedMeal[] = []
      groupMeals.forEach(meal => {
        const isValid = validateGeneratedMeal(meal)
        if (isValid) {
          validMeals.push(meal)
        } else {
          console.warn('Invalid meal generated:', (meal as any)?.title || 'Unknown')
        }
      })

      if (validMeals.length > 0) {
        groupedMeals[group.group_name] = validMeals
      }
    })

    if (Object.keys(groupedMeals).length === 0) {
      throw new Error('No valid meals were generated for any group')
    }

    return groupedMeals

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Combined meal generation failed: ${error.message}`)
    }
    throw new Error('Combined meal generation failed with unknown error')
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
 * Validate that meal generation makes sense for the plan
 */
export function validatePlanForGeneration(planData: PlanData, availableGroups: StoredGroup[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if we have groups available
  if (availableGroups.length === 0) {
    errors.push('No family groups found. Create groups first.')
    return { isValid: false, errors, warnings }
  }

  // Check if plan groups exist
  const groupIds = new Set(availableGroups.map(g => g.id))
  const missingGroups = planData.group_meals.filter(gm => !groupIds.has(gm.group_id))
  
  if (missingGroups.length > 0) {
    errors.push(`Groups not found: ${missingGroups.map(g => g.group_id).join(', ')}`)
  }

  // Check meal count limits
  const highMealCounts = planData.group_meals.filter(gm => gm.meal_count > 7)
  if (highMealCounts.length > 0) {
    warnings.push('Some groups have high meal counts (>7). Generation may take longer.')
  }

  // Check total meal count
  const totalMeals = planData.group_meals.reduce((sum, gm) => sum + gm.meal_count, 0)
  if (totalMeals > 25) {
    warnings.push('Large number of total meals requested. Consider splitting into multiple plans.')
  }

  // Check for groups with dietary restrictions
  const groupsWithDietaryRestrictions = availableGroups.filter(g => 
    planData.group_meals.some(gm => gm.group_id === g.id) && 
    g.dietary_restrictions.length > 0
  )
  
  if (groupsWithDietaryRestrictions.length > 0) {
    warnings.push('Some groups have dietary restrictions. AI will accommodate these preferences.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
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

/**
 * Generate mock meals for development mode
 */
function generateMockMealsForCombinedRequest(
  request: CombinedChatGPTMealRequest
): Record<string, GeneratedMeal[]> {
  const mockMeals: Record<string, GeneratedMeal[]> = {}
  
  request.groups.forEach((group, groupIndex) => {
    const meals: GeneratedMeal[] = []
    
    for (let i = 0; i < group.meals_to_generate; i++) {
      const meal: GeneratedMeal = {
        id: `mock-meal-${Date.now()}-${groupIndex}-${i}`,
        title: getMockMealTitle(i),
        description: getMockMealDescription(i),
        prep_time: 15 + (i * 5),
        cook_time: 20 + (i * 10),
        total_time: 35 + (i * 15),
        servings: 4,
        ingredients: getMockIngredients(i),
        instructions: getMockInstructions(i),
        tags: getMockTags(i, group.dietary_restrictions),
        dietary_info: group.dietary_restrictions.length > 0 ? group.dietary_restrictions : ['family-friendly'],
        difficulty: ['easy', 'medium', 'hard'][i % 3] as 'easy' | 'medium' | 'hard',
        group_id: group.group_name,
        created_at: new Date().toISOString()
      }
      meals.push(meal)
    }
    
    mockMeals[group.group_name] = meals
  })
  
  return mockMeals
}

function getMockMealTitle(index: number): string {
  const titles = [
    'Spaghetti with Marinara Sauce',
    'Grilled Chicken and Vegetables',
    'Beef Stir Fry with Rice',
    'Baked Salmon with Lemon',
    'Turkey and Cheese Sandwiches',
    'Vegetable Curry with Quinoa',
    'BBQ Pork Ribs',
    'Chicken Caesar Salad'
  ]
  return titles[index % titles.length]
}

function getMockMealDescription(index: number): string {
  const descriptions = [
    'A classic Italian pasta dish with rich tomato sauce',
    'Healthy grilled protein with seasonal vegetables',
    'Quick and easy Asian-inspired stir fry',
    'Omega-rich fish with bright citrus flavors',
    'Simple and satisfying lunch option',
    'Nutritious plant-based meal with spices',
    'Tender, smoky ribs perfect for family dinner',
    'Fresh salad with crispy chicken and parmesan'
  ]
  return descriptions[index % descriptions.length]
}

function getMockIngredients(index: number): Ingredient[] {
  const ingredientSets = [
    [
      { name: 'Spaghetti pasta', amount: 1, unit: 'lb', category: 'grains' },
      { name: 'Marinara sauce', amount: 2, unit: 'cups', category: 'condiments' },
      { name: 'Ground beef', amount: 0.5, unit: 'lb', category: 'protein' },
      { name: 'Parmesan cheese', amount: 0.5, unit: 'cup', category: 'dairy' }
    ],
    [
      { name: 'Chicken breast', amount: 1.5, unit: 'lbs', category: 'protein' },
      { name: 'Bell peppers', amount: 2, unit: 'whole', category: 'vegetables' },
      { name: 'Zucchini', amount: 1, unit: 'whole', category: 'vegetables' },
      { name: 'Olive oil', amount: 2, unit: 'tbsp', category: 'oils_fats' }
    ],
    [
      { name: 'Beef strips', amount: 1, unit: 'lb', category: 'protein' },
      { name: 'White rice', amount: 1, unit: 'cup', category: 'grains' },
      { name: 'Mixed vegetables', amount: 2, unit: 'cups', category: 'frozen' },
      { name: 'Soy sauce', amount: 3, unit: 'tbsp', category: 'condiments' }
    ]
  ]
  return ingredientSets[index % ingredientSets.length]
}

function getMockInstructions(index: number): string[] {
  const instructionSets = [
    [
      'Boil water and cook spaghetti according to package directions',
      'Brown ground beef in a large pan',
      'Add marinara sauce and simmer for 10 minutes',
      'Drain pasta and serve with sauce',
      'Top with parmesan cheese'
    ],
    [
      'Preheat grill to medium-high heat',
      'Season chicken breasts with salt and pepper',
      'Grill chicken for 6-8 minutes per side',
      'Grill vegetables until tender',
      'Let rest for 5 minutes before serving'
    ],
    [
      'Cook rice according to package directions',
      'Heat oil in large wok or skillet',
      'Add beef and cook until browned',
      'Add vegetables and stir-fry for 5 minutes',
      'Add soy sauce and serve over rice'
    ]
  ]
  return instructionSets[index % instructionSets.length]
}

function getMockTags(index: number, dietaryRestrictions: string[]): string[] {
  const baseTags = ['family-friendly', 'easy', 'weeknight']
  const extraTags = [
    ['pasta', 'italian'],
    ['grilled', 'healthy'],
    ['asian', 'quick']
  ]
  
  let tags = [...baseTags, ...extraTags[index % extraTags.length]]
  
  if (dietaryRestrictions.includes('vegetarian')) {
    tags.push('vegetarian')
  }
  if (dietaryRestrictions.includes('gluten-free')) {
    tags.push('gluten-free')
  }
  
  return tags
}