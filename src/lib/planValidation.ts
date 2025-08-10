/**
 * Plan validation logic for creating and editing meal plans
 */

export interface PlanData {
  name: string
  week_start: string
  group_ids: string[]
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
  
  // Validate group_ids
  if (!data.group_ids) {
    errors.group_ids = ['At least one group must be selected']
  } else if (!Array.isArray(data.group_ids)) {
    errors.group_ids = ['Group IDs must be an array']
  } else if (data.group_ids.length === 0) {
    errors.group_ids = ['At least one group must be selected']
  } else {
    const invalidGroupIds = data.group_ids.filter(
      id => typeof id !== 'string' || id.trim().length === 0
    )
    if (invalidGroupIds.length > 0) {
      errors.group_ids = ['All group IDs must be valid strings']
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