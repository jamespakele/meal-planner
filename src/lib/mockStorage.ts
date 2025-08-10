/**
 * Mock storage utilities for MVP development
 * In production, this would be replaced with real database operations
 */

export interface StoredGroup {
  id: string
  name: string
  adults: number
  teens: number
  kids: number
  toddlers: number
  dietary_restrictions: string[]
  user_id: string
  status: string
  created_at: string
  updated_at: string
}

const GROUPS_STORAGE_KEY = 'meal_planner_groups'

export function getStoredGroups(): StoredGroup[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(GROUPS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading groups from localStorage:', error)
    return []
  }
}

export function storeGroup(group: StoredGroup): void {
  if (typeof window === 'undefined') return
  
  try {
    const groups = getStoredGroups()
    const existingIndex = groups.findIndex(g => g.id === group.id)
    
    if (existingIndex >= 0) {
      groups[existingIndex] = group
    } else {
      groups.push(group)
    }
    
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups))
  } catch (error) {
    console.error('Error storing group to localStorage:', error)
  }
}

export function removeStoredGroup(groupId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const groups = getStoredGroups().filter(g => g.id !== groupId)
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups))
  } catch (error) {
    console.error('Error removing group from localStorage:', error)
  }
}

export function clearStoredGroups(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(GROUPS_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing groups from localStorage:', error)
  }
}

// Plan Storage Functions
export interface StoredPlan {
  id: string
  name: string
  week_start: string
  group_meals: import('./planValidation').GroupMealAssignment[]
  notes?: string
  user_id: string
  status: string
  created_at: string
  updated_at: string
}

const PLANS_STORAGE_KEY = 'meal_planner_plans'

export function getStoredPlans(): StoredPlan[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(PLANS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading plans from localStorage:', error)
    return []
  }
}

export function storePlan(plan: StoredPlan): void {
  if (typeof window === 'undefined') return
  
  try {
    const plans = getStoredPlans()
    const existingIndex = plans.findIndex(p => p.id === plan.id)
    
    if (existingIndex >= 0) {
      plans[existingIndex] = plan
    } else {
      plans.push(plan)
    }
    
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans))
  } catch (error) {
    console.error('Error storing plan to localStorage:', error)
  }
}

export function removeStoredPlan(planId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const plans = getStoredPlans().filter(p => p.id !== planId)
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans))
  } catch (error) {
    console.error('Error removing plan from localStorage:', error)
  }
}

export function clearStoredPlans(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(PLANS_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing plans from localStorage:', error)
  }
}

// Generated Meals Storage Functions
export interface StoredGeneratedMeal {
  id: string
  plan_id: string
  group_id: string
  title: string
  description: string
  prep_time: number
  cook_time: number
  total_time: number
  servings: number
  ingredients: import('./mealGenerator').Ingredient[]
  instructions: string[]
  tags: string[]
  dietary_info: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  selected: boolean // Whether this meal was selected for the final plan
  created_at: string
  updated_at: string
}

export interface StoredMealGeneration {
  id: string
  plan_id: string
  generated_at: string
  total_meals_generated: number
  group_meal_options: import('./mealGenerator').GroupMealOptions[]
  generation_metadata: {
    api_calls_made: number
    total_tokens_used?: number
    generation_time_ms: number
  }
  user_id: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

const MEALS_STORAGE_KEY = 'meal_planner_generated_meals'
const GENERATIONS_STORAGE_KEY = 'meal_planner_generations'

export function getStoredGeneratedMeals(planId?: string): StoredGeneratedMeal[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(MEALS_STORAGE_KEY)
    const meals = stored ? JSON.parse(stored) : []
    
    if (planId) {
      return meals.filter((meal: StoredGeneratedMeal) => meal.plan_id === planId)
    }
    
    return meals
  } catch (error) {
    console.error('Error reading generated meals from localStorage:', error)
    return []
  }
}

export function storeGeneratedMeals(meals: StoredGeneratedMeal[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const existingMeals = getStoredGeneratedMeals()
    const updatedMeals = [...existingMeals]
    
    meals.forEach(newMeal => {
      const existingIndex = updatedMeals.findIndex(m => m.id === newMeal.id)
      if (existingIndex >= 0) {
        updatedMeals[existingIndex] = {
          ...newMeal,
          updated_at: new Date().toISOString()
        }
      } else {
        updatedMeals.push({
          ...newMeal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    })
    
    localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(updatedMeals))
  } catch (error) {
    console.error('Error storing generated meals to localStorage:', error)
  }
}

export function updateMealSelection(mealId: string, selected: boolean): void {
  if (typeof window === 'undefined') return
  
  try {
    const meals = getStoredGeneratedMeals()
    const mealIndex = meals.findIndex(m => m.id === mealId)
    
    if (mealIndex >= 0) {
      meals[mealIndex].selected = selected
      meals[mealIndex].updated_at = new Date().toISOString()
      localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(meals))
    }
  } catch (error) {
    console.error('Error updating meal selection in localStorage:', error)
  }
}

export function getSelectedMeals(planId: string): StoredGeneratedMeal[] {
  return getStoredGeneratedMeals(planId).filter(meal => meal.selected)
}

export function clearGeneratedMeals(planId?: string): void {
  if (typeof window === 'undefined') return
  
  try {
    if (planId) {
      const meals = getStoredGeneratedMeals()
      const filteredMeals = meals.filter(meal => meal.plan_id !== planId)
      localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(filteredMeals))
    } else {
      localStorage.removeItem(MEALS_STORAGE_KEY)
    }
  } catch (error) {
    console.error('Error clearing generated meals from localStorage:', error)
  }
}

// Meal Generation Tracking
export function getStoredMealGenerations(planId?: string): StoredMealGeneration[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(GENERATIONS_STORAGE_KEY)
    const generations = stored ? JSON.parse(stored) : []
    
    if (planId) {
      return generations.filter((gen: StoredMealGeneration) => gen.plan_id === planId)
    }
    
    return generations
  } catch (error) {
    console.error('Error reading meal generations from localStorage:', error)
    return []
  }
}

export function storeMealGeneration(generation: StoredMealGeneration): void {
  if (typeof window === 'undefined') return
  
  try {
    const generations = getStoredMealGenerations()
    const existingIndex = generations.findIndex(g => g.id === generation.id)
    
    const timestampedGeneration = {
      ...generation,
      updated_at: new Date().toISOString()
    }
    
    if (existingIndex >= 0) {
      generations[existingIndex] = timestampedGeneration
    } else {
      generations.push({
        ...timestampedGeneration,
        created_at: new Date().toISOString()
      })
    }
    
    localStorage.setItem(GENERATIONS_STORAGE_KEY, JSON.stringify(generations))
  } catch (error) {
    console.error('Error storing meal generation to localStorage:', error)
  }
}

export function clearMealGenerations(planId?: string): void {
  if (typeof window === 'undefined') return
  
  try {
    if (planId) {
      const generations = getStoredMealGenerations()
      const filteredGenerations = generations.filter(gen => gen.plan_id !== planId)
      localStorage.setItem(GENERATIONS_STORAGE_KEY, JSON.stringify(filteredGenerations))
    } else {
      localStorage.removeItem(GENERATIONS_STORAGE_KEY)
    }
  } catch (error) {
    console.error('Error clearing meal generations from localStorage:', error)
  }
}

// Utility functions for meal management
export function convertGeneratedMealToStored(
  generatedMeal: import('./mealGenerator').GeneratedMeal,
  planId: string
): StoredGeneratedMeal {
  return {
    ...generatedMeal,
    plan_id: planId,
    selected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export function convertMealGenerationToStored(
  generationResult: import('./mealGenerator').MealGenerationResponse,
  planId: string,
  userId: string
): StoredMealGeneration {
  return {
    id: `generation-${Date.now()}`,
    plan_id: planId,
    generated_at: generationResult.generated_at,
    total_meals_generated: generationResult.total_meals_generated,
    group_meal_options: generationResult.group_meal_options,
    generation_metadata: generationResult.generation_metadata,
    user_id: userId,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}