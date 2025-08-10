/**
 * Plan validation logic for creating and editing meal plans
 */

export interface GroupMealAssignment {
  group_id: string
  meal_count: number
  notes?: string
}

export interface PlanData {
  name: string
  week_start: string
  group_meals: GroupMealAssignment[]
  notes?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string[]>
}

/**
 * Validates plan data for creation or update
 */
export function validatePlan(data: Partial<PlanData>): ValidationResult {
  const errors: Record<string, string[]> = {}
  
  // Validate name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = ['Name is required']
  } else if (data.name.trim().length > 100) {
    errors.name = ['Name must be 100 characters or less']
  }
  
  // Validate week_start
  if (!data.week_start || typeof data.week_start !== 'string') {
    errors.week_start = ['Week start date is required']
  } else {
    const startDate = new Date(data.week_start)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time for date-only comparison
    
    if (isNaN(startDate.getTime())) {
      errors.week_start = ['Week start must be a valid date']
    } else if (startDate < today) {
      errors.week_start = ['Week start cannot be in the past']
    }
  }
  
  // Validate group_meals
  if (!data.group_meals) {
    errors.group_meals = ['At least one group must be assigned meals']
  } else if (!Array.isArray(data.group_meals)) {
    errors.group_meals = ['Group meals must be an array']
  } else if (data.group_meals.length === 0) {
    errors.group_meals = ['At least one group must be assigned meals']
  } else {
    // Validate each group meal assignment
    const invalidGroupIds = data.group_meals.filter(
      assignment => !assignment.group_id || typeof assignment.group_id !== 'string' || assignment.group_id.trim().length === 0
    )
    if (invalidGroupIds.length > 0) {
      errors.group_meals = ['All group assignments must have valid group IDs']
    }
    
    // Validate meal counts
    const invalidMealCounts = data.group_meals.filter(
      assignment => assignment.meal_count === undefined || 
                   assignment.meal_count === null || 
                   !Number.isInteger(assignment.meal_count) || 
                   assignment.meal_count < 1
    )
    if (invalidMealCounts.length > 0) {
      errors.group_meals = ['All meal counts must be positive integers']
    }
    
    // Validate meal count limits per group
    const highMealCounts = data.group_meals.filter(
      assignment => assignment.meal_count > 14
    )
    if (highMealCounts.length > 0) {
      errors.group_meals = ['Meal count cannot exceed 14 per group']
    }
    
    // Validate total meal count
    const totalMeals = data.group_meals.reduce((sum, assignment) => sum + (assignment.meal_count || 0), 0)
    if (totalMeals > 50) {
      errors.group_meals = ['Total meals cannot exceed 50 per plan']
    }
    
    // Check for duplicate group IDs
    const groupIds = data.group_meals.map(assignment => assignment.group_id).filter(Boolean)
    const uniqueGroupIds = new Set(groupIds)
    if (groupIds.length !== uniqueGroupIds.size) {
      errors.group_meals = ['Each group can only be assigned meals once']
    }
    
    // Validate group meal notes length
    const longNotes = data.group_meals.filter(
      assignment => assignment.notes && assignment.notes.length > 200
    )
    if (longNotes.length > 0) {
      errors.group_meals = ['Group meal notes must be 200 characters or less']
    }
  }
  
  // Validate notes (optional)
  if (data.notes !== undefined) {
    if (typeof data.notes !== 'string') {
      errors.notes = ['Notes must be a string']
    } else if (data.notes.length > 500) {
      errors.notes = ['Notes must be 500 characters or less']
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Common plan durations for dropdown suggestions
 */
export const COMMON_PLAN_DURATIONS = [
  '1 week',
  '2 weeks',
  '1 month'
] as const

/**
 * Sanitizes plan name by trimming whitespace
 */
export function sanitizePlanName(name: string): string {
  return name.trim()
}