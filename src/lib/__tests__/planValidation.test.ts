import {
  validatePlan,
  sanitizePlanName,
  PlanData,
  GroupMealAssignment,
  ValidationResult,
  COMMON_PLAN_DURATIONS
} from '../planValidation'

describe('Plan Validation', () => {
  // Use a future date for valid test data
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)
  const futureDateString = futureDate.toISOString().split('T')[0]
  
  const validPlanData: PlanData = {
    name: 'Weekly Meal Plan',
    week_start: futureDateString,
    group_meals: [
      {
        group_id: 'group-123',
        meal_count: 2,
        notes: 'Main household meals'
      }
    ],
    notes: 'Test plan'
  }

  describe('validatePlan', () => {
    describe('name validation', () => {
      it('should pass with valid name', () => {
        const result = validatePlan(validPlanData)
        expect(result.isValid).toBe(true)
        expect(result.errors.name).toBeUndefined()
      })

      it('should fail when name is missing', () => {
        const data = { ...validPlanData, name: '' }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toEqual(['Name is required'])
      })

      it('should fail when name is only whitespace', () => {
        const data = { ...validPlanData, name: '   ' }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toEqual(['Name is required'])
      })

      it('should fail when name is too long', () => {
        const data = { ...validPlanData, name: 'a'.repeat(101) }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toEqual(['Name must be 100 characters or less'])
      })

      it('should fail when name is not a string', () => {
        const data = { ...validPlanData, name: 123 as any }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toEqual(['Name is required'])
      })
    })

    describe('week_start validation', () => {
      it('should pass with valid date string', () => {
        const futureTestDate = new Date()
        futureTestDate.setDate(futureTestDate.getDate() + 14)
        const data = { ...validPlanData, week_start: futureTestDate.toISOString().split('T')[0] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.week_start).toBeUndefined()
      })

      it('should fail when week_start is missing', () => {
        const data = { ...validPlanData }
        delete (data as any).week_start
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.week_start).toEqual(['Week start date is required'])
      })

      it('should fail with invalid date format', () => {
        const data = { ...validPlanData, week_start: 'invalid-date' }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.week_start).toEqual(['Week start must be a valid date'])
      })

      it('should fail with date in the past', () => {
        const pastDate = new Date()
        pastDate.setDate(pastDate.getDate() - 7)
        const data = { ...validPlanData, week_start: pastDate.toISOString().split('T')[0] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.week_start).toEqual(['Week start cannot be in the past'])
      })

      it('should pass with today\'s date', () => {
        const today = new Date().toISOString().split('T')[0]
        const data = { ...validPlanData, week_start: today }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.week_start).toBeUndefined()
      })

      it('should pass with future date', () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7)
        const data = { ...validPlanData, week_start: futureDate.toISOString().split('T')[0] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.week_start).toBeUndefined()
      })
    })

    describe('group_meals validation', () => {
      it('should pass with valid group meal assignments', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 2, notes: 'Family meals' },
            { group_id: 'group-2', meal_count: 1 }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.group_meals).toBeUndefined()
      })

      it('should fail when group_meals is empty', () => {
        const data = { ...validPlanData, group_meals: [] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['At least one group must be assigned meals'])
      })

      it('should fail when group_meals is missing', () => {
        const data = { ...validPlanData }
        delete (data as any).group_meals
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['At least one group must be assigned meals'])
      })

      it('should fail when group_meals is not an array', () => {
        const data = { ...validPlanData, group_meals: 'group-123' as any }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['Group meals must be an array'])
      })

      it('should fail when group_id is missing or invalid', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: '', meal_count: 2 },
            { meal_count: 1 } as any
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['All group assignments must have valid group IDs'])
      })

      it('should fail when meal_count is missing or invalid', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 0 },
            { group_id: 'group-2', meal_count: -1 },
            { group_id: 'group-3' } as any
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['All meal counts must be positive integers'])
      })

      it('should fail when meal_count is too high', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 15 }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['Meal count cannot exceed 14 per group'])
      })

      it('should fail when total meal count is too high', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 14 },
            { group_id: 'group-2', meal_count: 14 },
            { group_id: 'group-3', meal_count: 14 },
            { group_id: 'group-4', meal_count: 14 }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['Total meals cannot exceed 50 per plan'])
      })

      it('should fail when duplicate group_ids are present', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 2 },
            { group_id: 'group-1', meal_count: 3 }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['Each group can only be assigned meals once'])
      })

      it('should fail when group meal notes are too long', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { 
              group_id: 'group-1', 
              meal_count: 2, 
              notes: 'a'.repeat(201)  // Max 200 chars for group notes
            }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_meals).toEqual(['Group meal notes must be 200 characters or less'])
      })

      it('should pass when group meal notes are valid', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { 
              group_id: 'group-1', 
              meal_count: 2, 
              notes: 'Valid notes for this group'
            },
            { 
              group_id: 'group-2', 
              meal_count: 1
              // notes is optional
            }
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.group_meals).toBeUndefined()
      })

      it('should pass with boundary values', () => {
        const data = { 
          ...validPlanData, 
          group_meals: [
            { group_id: 'group-1', meal_count: 1 },  // Min valid count
            { group_id: 'group-2', meal_count: 14 }  // Max valid count
          ]
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.group_meals).toBeUndefined()
      })
    })

    describe('notes validation', () => {
      it('should pass with valid notes', () => {
        const data = { ...validPlanData, notes: 'Some helpful notes' }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.notes).toBeUndefined()
      })

      it('should pass when notes is undefined (optional)', () => {
        const data = { ...validPlanData }
        delete (data as any).notes
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.notes).toBeUndefined()
      })

      it('should pass with empty notes', () => {
        const data = { ...validPlanData, notes: '' }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.notes).toBeUndefined()
      })

      it('should fail when notes is too long', () => {
        const data = { ...validPlanData, notes: 'a'.repeat(501) }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.notes).toEqual(['Notes must be 500 characters or less'])
      })

      it('should fail when notes is not a string', () => {
        const data = { ...validPlanData, notes: 123 as any }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.notes).toEqual(['Notes must be a string'])
      })
    })

    describe('multiple validation errors', () => {
      it('should return multiple errors when multiple fields are invalid', () => {
        const data = {
          name: '',
          week_start: 'invalid-date',
          group_meals: [],
          notes: 'a'.repeat(501)
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(Object.keys(result.errors)).toHaveLength(4)
        expect(result.errors.name).toEqual(['Name is required'])
        expect(result.errors.week_start).toEqual(['Week start must be a valid date'])
        expect(result.errors.group_meals).toEqual(['At least one group must be assigned meals'])
        expect(result.errors.notes).toEqual(['Notes must be 500 characters or less'])
      })
    })
  })

  describe('sanitizePlanName', () => {
    it('should trim whitespace from plan name', () => {
      expect(sanitizePlanName('  Plan Name  ')).toBe('Plan Name')
    })

    it('should handle empty string', () => {
      expect(sanitizePlanName('')).toBe('')
    })

    it('should handle string with only whitespace', () => {
      expect(sanitizePlanName('   ')).toBe('')
    })

    it('should preserve internal whitespace', () => {
      expect(sanitizePlanName('  My Meal Plan  ')).toBe('My Meal Plan')
    })
  })

  describe('COMMON_PLAN_DURATIONS', () => {
    it('should be defined and contain expected durations', () => {
      expect(COMMON_PLAN_DURATIONS).toBeDefined()
      expect(Array.isArray(COMMON_PLAN_DURATIONS)).toBe(true)
      expect(COMMON_PLAN_DURATIONS.length).toBeGreaterThan(0)
      expect(COMMON_PLAN_DURATIONS).toContain('1 week')
    })
  })
})