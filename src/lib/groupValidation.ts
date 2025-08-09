/**
 * Group validation logic for creating and editing groups
 */

export interface GroupData {
  name: string
  adults: number
  teens: number
  kids: number
  toddlers: number
  dietary_restrictions: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string[]>
}

/**
 * Validates group data for creation or update
 */
export function validateGroup(data: Partial<GroupData>): ValidationResult {
  const errors: Record<string, string[]> = {}
  
  // Validate name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = ['Name is required']
  } else if (data.name.trim().length > 100) {
    errors.name = ['Name must be 100 characters or less']
  }
  
  // Validate demographics
  const demographics = ['adults', 'teens', 'kids', 'toddlers'] as const
  
  demographics.forEach(field => {
    const value = data[field]
    if (value === undefined || value === null) {
      errors[field] = [`${field} is required`]
    } else if (!Number.isInteger(value) || value < 0) {
      errors[field] = [`${field} must be a non-negative integer`]
    } else if (value > 99) {
      errors[field] = [`${field} must be 99 or less`]
    }
  })
  
  // Check that at least one person is in the group
  const total = (data.adults || 0) + (data.teens || 0) + (data.kids || 0) + (data.toddlers || 0)
  if (total === 0) {
    errors.general = ['Group must have at least one person']
  }
  
  // Validate dietary restrictions
  if (data.dietary_restrictions !== undefined) {
    if (!Array.isArray(data.dietary_restrictions)) {
      errors.dietary_restrictions = ['Dietary restrictions must be an array']
    } else {
      const invalidRestrictions = data.dietary_restrictions.filter(
        restriction => typeof restriction !== 'string' || restriction.trim().length === 0
      )
      if (invalidRestrictions.length > 0) {
        errors.dietary_restrictions = ['All dietary restrictions must be non-empty strings']
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Common dietary restrictions for dropdown suggestions
 */
export const COMMON_DIETARY_RESTRICTIONS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'shellfish-free',
  'kosher',
  'halal',
  'low-carb',
  'keto'
] as const

/**
 * Sanitizes group name by trimming whitespace
 */
export function sanitizeGroupName(name: string): string {
  return name.trim()
}