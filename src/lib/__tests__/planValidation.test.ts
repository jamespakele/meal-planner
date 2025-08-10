import {
  validatePlan,
  sanitizePlanName,
  PlanData,
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
    group_ids: ['group-123'],
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

    describe('group_ids validation', () => {
      it('should pass with valid group IDs array', () => {
        const data = { ...validPlanData, group_ids: ['group-1', 'group-2'] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(true)
        expect(result.errors.group_ids).toBeUndefined()
      })

      it('should fail when group_ids is empty', () => {
        const data = { ...validPlanData, group_ids: [] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_ids).toEqual(['At least one group must be selected'])
      })

      it('should fail when group_ids is missing', () => {
        const data = { ...validPlanData }
        delete (data as any).group_ids
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_ids).toEqual(['At least one group must be selected'])
      })

      it('should fail when group_ids is not an array', () => {
        const data = { ...validPlanData, group_ids: 'group-123' as any }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_ids).toEqual(['Group IDs must be an array'])
      })

      it('should fail when group_ids contains non-strings', () => {
        const data = { ...validPlanData, group_ids: ['group-1', 123, null] as any }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_ids).toEqual(['All group IDs must be valid strings'])
      })

      it('should fail when group_ids contains empty strings', () => {
        const data = { ...validPlanData, group_ids: ['group-1', '', '   '] }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.group_ids).toEqual(['All group IDs must be valid strings'])
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
          group_ids: [],
          notes: 'a'.repeat(501)
        }
        const result = validatePlan(data)
        expect(result.isValid).toBe(false)
        expect(Object.keys(result.errors)).toHaveLength(4)
        expect(result.errors.name).toEqual(['Name is required'])
        expect(result.errors.week_start).toEqual(['Week start must be a valid date'])
        expect(result.errors.group_ids).toEqual(['At least one group must be selected'])
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