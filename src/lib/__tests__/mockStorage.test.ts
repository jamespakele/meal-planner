import { 
  getStoredGroups, storeGroup, removeStoredGroup, clearStoredGroups, StoredGroup,
  getStoredPlans, storePlan, removeStoredPlan, clearStoredPlans, StoredPlan
} from '../mockStorage'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('Mock Storage', () => {
  const mockGroup: StoredGroup = {
    id: 'group-123',
    name: 'Test Family',
    adults: 2,
    teens: 1,
    kids: 2,
    toddlers: 0,
    dietary_restrictions: ['vegetarian'],
    user_id: 'user-123',
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getStoredGroups', () => {
    it('returns empty array when no groups stored', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const result = getStoredGroups()
      
      expect(result).toEqual([])
      expect(localStorageMock.getItem).toHaveBeenCalledWith('meal_planner_groups')
    })

    it('returns parsed groups from localStorage', () => {
      const storedGroups = [mockGroup]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedGroups))
      
      const result = getStoredGroups()
      
      expect(result).toEqual(storedGroups)
    })

    it('handles JSON parse errors gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      const result = getStoredGroups()
      
      expect(result).toEqual([])
    })
  })

  describe('storeGroup', () => {
    it('stores new group', () => {
      localStorageMock.getItem.mockReturnValue('[]')
      
      storeGroup(mockGroup)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meal_planner_groups',
        JSON.stringify([mockGroup])
      )
    })

    it('updates existing group', () => {
      const existingGroups = [mockGroup]
      const updatedGroup = { ...mockGroup, name: 'Updated Family' }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingGroups))
      
      storeGroup(updatedGroup)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meal_planner_groups',
        JSON.stringify([updatedGroup])
      )
    })

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw
      expect(() => storeGroup(mockGroup)).not.toThrow()
    })
  })

  describe('removeStoredGroup', () => {
    it('removes group by id', () => {
      const groups = [mockGroup, { ...mockGroup, id: 'group-456', name: 'Other Family' }]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(groups))
      
      removeStoredGroup('group-123')
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meal_planner_groups',
        JSON.stringify([{ ...mockGroup, id: 'group-456', name: 'Other Family' }])
      )
    })

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw
      expect(() => removeStoredGroup('group-123')).not.toThrow()
    })
  })

  describe('clearStoredGroups', () => {
    it('clears all stored groups', () => {
      clearStoredGroups()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('meal_planner_groups')
    })

    it('handles localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw
      expect(() => clearStoredGroups()).not.toThrow()
    })
  })

  // Plan Storage Tests
  describe('Plan Storage Functions', () => {
    const mockPlan = {
      id: 'plan-123',
      name: 'Weekly Plan',
      week_start: '2024-12-01',
      group_ids: ['group-456'],
      notes: 'Test plan notes',
      user_id: 'user-789',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    describe('getStoredPlans', () => {
      it('should return empty array when no plans stored', () => {
        localStorageMock.getItem.mockReturnValue(null)
        
        const plans = getStoredPlans()
        
        expect(plans).toEqual([])
        expect(localStorageMock.getItem).toHaveBeenCalledWith('meal_planner_plans')
      })

      it('should return parsed plans from localStorage', () => {
        const plans = [mockPlan]
        localStorageMock.getItem.mockReturnValue(JSON.stringify(plans))
        
        const result = getStoredPlans()
        
        expect(result).toEqual(plans)
      })

      it('should handle invalid JSON gracefully', () => {
        localStorageMock.getItem.mockReturnValue('invalid json')
        
        const plans = getStoredPlans()
        
        expect(plans).toEqual([])
      })

      it('should handle localStorage errors gracefully', () => {
        localStorageMock.getItem.mockImplementation(() => {
          throw new Error('localStorage error')
        })
        
        const plans = getStoredPlans()
        
        expect(plans).toEqual([])
      })

      it('should return empty array in server environment', () => {
        const originalWindow = global.window
        delete (global as any).window
        
        const plans = getStoredPlans()
        
        expect(plans).toEqual([])
        
        global.window = originalWindow
      })
    })

    describe('storePlan', () => {
      it('should store new plan', () => {
        localStorageMock.getItem.mockReturnValue('[]')
        
        storePlan(mockPlan)
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'meal_planner_plans',
          JSON.stringify([mockPlan])
        )
      })

      it('should update existing plan', () => {
        const existingPlan = { ...mockPlan, name: 'Old Name' }
        const updatedPlan = { ...mockPlan, name: 'New Name' }
        localStorageMock.getItem.mockReturnValue(JSON.stringify([existingPlan]))
        
        storePlan(updatedPlan)
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'meal_planner_plans',
          JSON.stringify([updatedPlan])
        )
      })

      it('should add plan to existing list', () => {
        const existingPlan = { ...mockPlan, id: 'plan-456', name: 'Other Plan' }
        localStorageMock.getItem.mockReturnValue(JSON.stringify([existingPlan]))
        
        storePlan(mockPlan)
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'meal_planner_plans',
          JSON.stringify([existingPlan, mockPlan])
        )
      })

      it('should handle localStorage errors gracefully', () => {
        localStorageMock.getItem.mockImplementation(() => {
          throw new Error('localStorage error')
        })
        
        // Should not throw
        expect(() => storePlan(mockPlan)).not.toThrow()
      })

      it('should not store in server environment', () => {
        const originalWindow = global.window
        delete (global as any).window
        
        // Should not throw
        expect(() => storePlan(mockPlan)).not.toThrow()
        
        global.window = originalWindow
      })
    })

    describe('removeStoredPlan', () => {
      it('should remove specific plan from storage', () => {
        const plans = [
          mockPlan,
          { ...mockPlan, id: 'plan-456', name: 'Other Plan' }
        ]
        localStorageMock.getItem.mockReturnValue(JSON.stringify(plans))
        
        removeStoredPlan('plan-123')
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'meal_planner_plans',
          JSON.stringify([{ ...mockPlan, id: 'plan-456', name: 'Other Plan' }])
        )
      })

      it('should handle non-existent plan ID', () => {
        const plans = [mockPlan]
        localStorageMock.getItem.mockReturnValue(JSON.stringify(plans))
        
        removeStoredPlan('non-existent')
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'meal_planner_plans',
          JSON.stringify(plans)
        )
      })

      it('should handle localStorage errors gracefully', () => {
        localStorageMock.getItem.mockImplementation(() => {
          throw new Error('localStorage error')
        })
        
        // Should not throw
        expect(() => removeStoredPlan('plan-123')).not.toThrow()
      })

      it('should not remove in server environment', () => {
        const originalWindow = global.window
        delete (global as any).window
        
        // Should not throw
        expect(() => removeStoredPlan('plan-123')).not.toThrow()
        
        global.window = originalWindow
      })
    })

    describe('clearStoredPlans', () => {
      it('should remove all plans from localStorage', () => {
        clearStoredPlans()
        
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('meal_planner_plans')
      })

      it('should handle localStorage errors gracefully', () => {
        localStorageMock.removeItem.mockImplementation(() => {
          throw new Error('localStorage error')
        })
        
        // Should not throw
        expect(() => clearStoredPlans()).not.toThrow()
      })

      it('should not clear in server environment', () => {
        const originalWindow = global.window
        delete (global as any).window
        
        // Should not throw
        expect(() => clearStoredPlans()).not.toThrow()
        
        global.window = originalWindow
      })
    })
  })
})