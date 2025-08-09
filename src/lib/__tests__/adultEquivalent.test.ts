import { calculateAdultEquivalent, validateDemographics, AE_WEIGHTS, Demographics } from '../adultEquivalent'

describe('Adult Equivalent Calculator', () => {
  describe('calculateAdultEquivalent', () => {
    it('calculates AE for adults only', () => {
      const demographics: Demographics = { adults: 2, teens: 0, kids: 0, toddlers: 0 }
      expect(calculateAdultEquivalent(demographics)).toBe(2.0)
    })

    it('calculates AE for teens only', () => {
      const demographics: Demographics = { adults: 0, teens: 2, kids: 0, toddlers: 0 }
      expect(calculateAdultEquivalent(demographics)).toBe(2.4) // 2 × 1.2
    })

    it('calculates AE for kids only', () => {
      const demographics: Demographics = { adults: 0, teens: 0, kids: 2, toddlers: 0 }
      expect(calculateAdultEquivalent(demographics)).toBe(1.4) // 2 × 0.7
    })

    it('calculates AE for toddlers only', () => {
      const demographics: Demographics = { adults: 0, teens: 0, kids: 0, toddlers: 2 }
      expect(calculateAdultEquivalent(demographics)).toBe(0.8) // 2 × 0.4
    })

    it('calculates AE for mixed demographics', () => {
      const demographics: Demographics = { adults: 2, teens: 1, kids: 2, toddlers: 1 }
      const expected = (2 * 1.0) + (1 * 1.2) + (2 * 0.7) + (1 * 0.4) // 2.0 + 1.2 + 1.4 + 0.4 = 5.0
      expect(calculateAdultEquivalent(demographics)).toBe(5.0)
    })

    it('calculates AE for PRD example scenario', () => {
      // Example from PRD: family with typical demographics
      const demographics: Demographics = { adults: 2, teens: 1, kids: 1, toddlers: 1 }
      const expected = (2 * 1.0) + (1 * 1.2) + (1 * 0.7) + (1 * 0.4) // 2.0 + 1.2 + 0.7 + 0.4 = 4.3
      expect(calculateAdultEquivalent(demographics)).toBe(4.3)
    })

    it('handles zero demographics', () => {
      const demographics: Demographics = { adults: 0, teens: 0, kids: 0, toddlers: 0 }
      expect(calculateAdultEquivalent(demographics)).toBe(0)
    })

    it('maintains precision for decimal results', () => {
      const demographics: Demographics = { adults: 1, teens: 1, kids: 1, toddlers: 1 }
      const expected = 1.0 + 1.2 + 0.7 + 0.4 // 3.3
      expect(calculateAdultEquivalent(demographics)).toBe(3.3)
    })
  })

  describe('AE_WEIGHTS constants', () => {
    it('has correct weight values as per PRD', () => {
      expect(AE_WEIGHTS.adults).toBe(1.0)
      expect(AE_WEIGHTS.teens).toBe(1.2)
      expect(AE_WEIGHTS.kids).toBe(0.7)
      expect(AE_WEIGHTS.toddlers).toBe(0.4)
    })
  })

  describe('validateDemographics', () => {
    it('validates correct demographics', () => {
      const demographics: Demographics = { adults: 2, teens: 1, kids: 2, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toHaveLength(0)
    })

    it('rejects negative values', () => {
      const demographics: Demographics = { adults: -1, teens: 1, kids: 2, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toContain('adults must be a non-negative integer')
    })

    it('rejects non-integer values', () => {
      const demographics: Demographics = { adults: 1.5, teens: 1, kids: 2, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toContain('adults must be a non-negative integer')
    })

    it('rejects empty group (all zeros)', () => {
      const demographics: Demographics = { adults: 0, teens: 0, kids: 0, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toContain('Group must have at least one person')
    })

    it('validates multiple demographic errors', () => {
      const demographics: Demographics = { adults: -1, teens: 1.5, kids: 2, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toContain('adults must be a non-negative integer')
      expect(errors).toContain('teens must be a non-negative integer')
      expect(errors).toHaveLength(2)
    })

    it('accepts single person group', () => {
      const demographics: Demographics = { adults: 1, teens: 0, kids: 0, toddlers: 0 }
      const errors = validateDemographics(demographics)
      expect(errors).toHaveLength(0)
    })
  })
})