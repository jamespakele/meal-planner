/**
 * Meal Generation Workflow Utilities
 * Integrates meal generation with storage and plan management
 */

import {
  generateMealsForPlan,
  MealGenerationResult,
  GeneratedMeal
} from './mealGenerator'
import {
  getStoredGroups,
  getStoredPlans,
  convertGeneratedMealToStored,
  convertMealGenerationToStored,
  storeGeneratedMeals,
  storeMealGeneration,
  getStoredGeneratedMeals,
  updateMealSelection,
  StoredGeneratedMeal
} from './mockStorage'
import { PlanData } from './planValidation'

export interface WorkflowResult {
  success: boolean
  planId?: string
  totalMealsGenerated?: number
  generatedMeals?: StoredGeneratedMeal[]
  error?: string
  details?: any
}

/**
 * Complete workflow: Generate meals for a plan and store them
 */
export async function generateAndStoreMealsForPlan(
  planData: PlanData,
  userId: string = 'default-user'
): Promise<WorkflowResult> {
  try {
    // Get available groups for the plan
    const availableGroups = getStoredGroups()
    
    if (availableGroups.length === 0) {
      return {
        success: false,
        error: 'No groups available for meal generation'
      }
    }

    // Generate meals using AI
    const generationResult: MealGenerationResult = await generateMealsForPlan(
      planData,
      availableGroups
    )

    if (!generationResult.success || !generationResult.data) {
      return {
        success: false,
        error: 'Meal generation failed',
        details: generationResult.errors
      }
    }

    // Generate a plan ID
    const planId = `plan-${Date.now()}`

    // Convert generated meals to storable format
    const allGeneratedMeals: StoredGeneratedMeal[] = []
    
    generationResult.data.group_meal_options.forEach(groupOption => {
      groupOption.meals.forEach(meal => {
        const storedMeal = convertGeneratedMealToStored(meal, planId)
        allGeneratedMeals.push(storedMeal)
      })
    })

    // Store the meals
    storeGeneratedMeals(allGeneratedMeals)

    // Store the generation metadata
    const storedGeneration = convertMealGenerationToStored(
      generationResult.data,
      planId,
      userId
    )
    storeMealGeneration(storedGeneration)

    return {
      success: true,
      planId,
      totalMealsGenerated: generationResult.data.total_meals_generated,
      generatedMeals: allGeneratedMeals
    }

  } catch (error) {
    return {
      success: false,
      error: 'Unexpected error in meal generation workflow',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get all generated meals for a specific plan
 */
export function getMealsForPlan(planId: string): StoredGeneratedMeal[] {
  return getStoredGeneratedMeals(planId)
}

/**
 * Select meals for final plan
 */
export function selectMealsForPlan(
  planId: string,
  selectedMealIds: string[]
): { success: boolean; selectedCount: number; error?: string } {
  try {
    const allMeals = getStoredGeneratedMeals(planId)
    let selectedCount = 0

    // First, unselect all meals for this plan
    allMeals.forEach(meal => {
      const shouldSelect = selectedMealIds.includes(meal.id)
      updateMealSelection(meal.id, shouldSelect)
      if (shouldSelect) {
        selectedCount++
      }
    })

    return {
      success: true,
      selectedCount
    }
  } catch (error) {
    return {
      success: false,
      selectedCount: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get selected meals for a plan
 */
export function getSelectedMealsForPlan(planId: string): StoredGeneratedMeal[] {
  return getStoredGeneratedMeals(planId).filter(meal => meal.selected)
}

/**
 * Get meals organized by group for display
 */
export function getMealsGroupedByGroup(planId: string): Record<string, StoredGeneratedMeal[]> {
  const meals = getStoredGeneratedMeals(planId)
  const grouped: Record<string, StoredGeneratedMeal[]> = {}

  meals.forEach(meal => {
    if (!grouped[meal.group_id]) {
      grouped[meal.group_id] = []
    }
    grouped[meal.group_id].push(meal)
  })

  return grouped
}

/**
 * Calculate meal statistics for a plan
 */
export function getMealStatistics(planId: string): {
  totalGenerated: number
  totalSelected: number
  byGroup: Record<string, { generated: number; selected: number }>
} {
  const meals = getStoredGeneratedMeals(planId)
  const stats = {
    totalGenerated: meals.length,
    totalSelected: meals.filter(m => m.selected).length,
    byGroup: {} as Record<string, { generated: number; selected: number }>
  }

  meals.forEach(meal => {
    if (!stats.byGroup[meal.group_id]) {
      stats.byGroup[meal.group_id] = { generated: 0, selected: 0 }
    }
    stats.byGroup[meal.group_id].generated++
    if (meal.selected) {
      stats.byGroup[meal.group_id].selected++
    }
  })

  return stats
}

/**
 * Validate that meal generation makes sense for the plan
 */
export function validatePlanForGeneration(planData: PlanData): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if we have groups available
  const availableGroups = getStoredGroups()
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
 * Check if plan already has generated meals
 */
export function planHasGeneratedMeals(planId: string): boolean {
  return getStoredGeneratedMeals(planId).length > 0
}

/**
 * Regenerate meals for a specific group in a plan
 */
export async function regenerateMealsForGroup(
  planId: string,
  groupId: string,
  userId: string = 'default-user'
): Promise<WorkflowResult> {
  try {
    // Get the current stored plan info - for now we'll reconstruct from stored meals
    const existingMeals = getStoredGeneratedMeals(planId)
    const groupMeals = existingMeals.filter(m => m.group_id === groupId)
    
    if (groupMeals.length === 0) {
      return {
        success: false,
        error: `No meals found for group ${groupId} in plan ${planId}`
      }
    }

    // For now, return success without actual regeneration
    // This would require storing the original plan data or reconstructing it
    return {
      success: false,
      error: 'Meal regeneration not yet implemented. Generate a new plan instead.'
    }

  } catch (error) {
    return {
      success: false,
      error: 'Error during meal regeneration',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}