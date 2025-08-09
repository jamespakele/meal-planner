/**
 * Adult Equivalent (AE) Calculator
 * 
 * Calculates the adult equivalent serving size based on demographic composition
 * as defined in the PRD specification.
 */

export interface Demographics {
  adults: number
  teens: number
  kids: number
  toddlers: number
}

export const AE_WEIGHTS = {
  adults: 1.0,
  teens: 1.2,
  kids: 0.7,
  toddlers: 0.4
} as const

/**
 * Calculates Adult Equivalent (AE) value from demographics
 * Formula: (Adults × 1.0) + (Teens × 1.2) + (Kids × 0.7) + (Toddlers × 0.4)
 */
export function calculateAdultEquivalent(demographics: Demographics): number {
  const { adults, teens, kids, toddlers } = demographics
  
  const result = (
    adults * AE_WEIGHTS.adults +
    teens * AE_WEIGHTS.teens +
    kids * AE_WEIGHTS.kids +
    toddlers * AE_WEIGHTS.toddlers
  )
  
  // Round to 1 decimal place to handle floating point precision
  return Math.round(result * 10) / 10
}

/**
 * Validates that demographic values are non-negative integers
 */
export function validateDemographics(demographics: Demographics): string[] {
  const errors: string[] = []
  
  Object.entries(demographics).forEach(([key, value]) => {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${key} must be a non-negative integer`)
    }
  })
  
  // Check that at least one person is in the group
  const total = demographics.adults + demographics.teens + demographics.kids + demographics.toddlers
  if (total === 0) {
    errors.push('Group must have at least one person')
  }
  
  return errors
}