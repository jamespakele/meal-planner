import { 
  validateGroup, 
  sanitizeGroupName, 
  COMMON_DIETARY_RESTRICTIONS, 
  GroupData 
} from '../groupValidation'

describe('Group Validation', () => {
  describe('validateGroup', () => {
    const validGroupData: GroupData = {
      name: 'Smith Family',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian']
    }

    it('validates correct group data', () => {
      const result = validateGroup(validGroupData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual({})
    })

    describe('name validation', () => {
      it('requires name field', () => {
        const data = { ...validGroupData, name: undefined as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toContain('Name is required')
      })

      it('rejects empty name', () => {
        const data = { ...validGroupData, name: '' }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toContain('Name is required')
      })

      it('rejects name with only whitespace', () => {
        const data = { ...validGroupData, name: '   ' }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toContain('Name is required')
      })

      it('rejects name longer than 100 characters', () => {
        const data = { ...validGroupData, name: 'a'.repeat(101) }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.name).toContain('Name must be 100 characters or less')
      })

      it('accepts name exactly 100 characters', () => {
        const data = { ...validGroupData, name: 'a'.repeat(100) }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })
    })

    describe('demographics validation', () => {
      it('requires adults field', () => {
        const data = { ...validGroupData, adults: undefined as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.adults).toContain('adults is required')
      })

      it('requires teens field', () => {
        const data = { ...validGroupData, teens: undefined as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.teens).toContain('teens is required')
      })

      it('requires kids field', () => {
        const data = { ...validGroupData, kids: undefined as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.kids).toContain('kids is required')
      })

      it('requires toddlers field', () => {
        const data = { ...validGroupData, toddlers: undefined as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.toddlers).toContain('toddlers is required')
      })

      it('rejects negative adults', () => {
        const data = { ...validGroupData, adults: -1 }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.adults).toContain('adults must be a non-negative integer')
      })

      it('rejects decimal values', () => {
        const data = { ...validGroupData, teens: 1.5 }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.teens).toContain('teens must be a non-negative integer')
      })

      it('rejects values over 99', () => {
        const data = { ...validGroupData, kids: 100 }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.kids).toContain('kids must be 99 or less')
      })

      it('accepts zero values', () => {
        const data = { ...validGroupData, toddlers: 0 }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })

      it('accepts maximum value of 99', () => {
        const data = { ...validGroupData, adults: 99 }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })
    })

    describe('group size validation', () => {
      it('rejects empty group (all zeros)', () => {
        const data = {
          ...validGroupData,
          adults: 0,
          teens: 0,
          kids: 0,
          toddlers: 0
        }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.general).toContain('Group must have at least one person')
      })

      it('accepts single person group', () => {
        const data = {
          ...validGroupData,
          adults: 1,
          teens: 0,
          kids: 0,
          toddlers: 0
        }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })
    })

    describe('dietary restrictions validation', () => {
      it('accepts empty dietary restrictions', () => {
        const data = { ...validGroupData, dietary_restrictions: [] }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })

      it('accepts valid dietary restrictions array', () => {
        const data = { ...validGroupData, dietary_restrictions: ['vegetarian', 'gluten-free'] }
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })

      it('rejects non-array dietary restrictions', () => {
        const data = { ...validGroupData, dietary_restrictions: 'vegetarian' as any }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.dietary_restrictions).toContain('Dietary restrictions must be an array')
      })

      it('rejects empty strings in dietary restrictions', () => {
        const data = { ...validGroupData, dietary_restrictions: ['vegetarian', '', 'gluten-free'] }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.dietary_restrictions).toContain('All dietary restrictions must be non-empty strings')
      })

      it('rejects non-string values in dietary restrictions', () => {
        const data = { ...validGroupData, dietary_restrictions: ['vegetarian', 123 as any] }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(result.errors.dietary_restrictions).toContain('All dietary restrictions must be non-empty strings')
      })

      it('accepts undefined dietary restrictions (optional field)', () => {
        const data = { ...validGroupData }
        delete data.dietary_restrictions
        const result = validateGroup(data)
        expect(result.isValid).toBe(true)
      })
    })

    describe('multiple validation errors', () => {
      it('collects multiple validation errors', () => {
        const data = {
          name: '',
          adults: -1,
          teens: 1.5,
          kids: 1,
          toddlers: 0,
          dietary_restrictions: [''] as string[]
        }
        const result = validateGroup(data)
        expect(result.isValid).toBe(false)
        expect(Object.keys(result.errors)).toContain('name')
        expect(Object.keys(result.errors)).toContain('adults')
        expect(Object.keys(result.errors)).toContain('teens')
        expect(Object.keys(result.errors)).toContain('dietary_restrictions')
      })
    })
  })

  describe('sanitizeGroupName', () => {
    it('trims whitespace from group name', () => {
      expect(sanitizeGroupName('  Smith Family  ')).toBe('Smith Family')
    })

    it('preserves internal spaces', () => {
      expect(sanitizeGroupName(' The  Jones   Family ')).toBe('The  Jones   Family')
    })

    it('handles empty string', () => {
      expect(sanitizeGroupName('')).toBe('')
    })

    it('handles only whitespace', () => {
      expect(sanitizeGroupName('   ')).toBe('')
    })
  })

  describe('COMMON_DIETARY_RESTRICTIONS', () => {
    it('contains expected dietary restrictions', () => {
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('vegetarian')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('vegan')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('gluten-free')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('dairy-free')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('nut-free')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('shellfish-free')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('kosher')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('halal')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('low-carb')
      expect(COMMON_DIETARY_RESTRICTIONS).toContain('keto')
    })

    it('has at least 10 common restrictions', () => {
      expect(COMMON_DIETARY_RESTRICTIONS.length).toBeGreaterThanOrEqual(10)
    })
  })
})