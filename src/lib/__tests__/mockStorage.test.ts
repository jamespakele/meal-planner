import { getStoredGroups, storeGroup, removeStoredGroup, clearStoredGroups, StoredGroup } from '../mockStorage'

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
})