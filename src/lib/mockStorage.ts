/**
 * Mock storage utilities for MVP development
 * In production, this would be replaced with real database operations
 */

export interface StoredGroup {
  id: string
  name: string
  adults: number
  teens: number
  kids: number
  toddlers: number
  dietary_restrictions: string[]
  user_id: string
  status: string
  created_at: string
  updated_at: string
}

const GROUPS_STORAGE_KEY = 'meal_planner_groups'

export function getStoredGroups(): StoredGroup[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(GROUPS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading groups from localStorage:', error)
    return []
  }
}

export function storeGroup(group: StoredGroup): void {
  if (typeof window === 'undefined') return
  
  try {
    const groups = getStoredGroups()
    const existingIndex = groups.findIndex(g => g.id === group.id)
    
    if (existingIndex >= 0) {
      groups[existingIndex] = group
    } else {
      groups.push(group)
    }
    
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups))
  } catch (error) {
    console.error('Error storing group to localStorage:', error)
  }
}

export function removeStoredGroup(groupId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const groups = getStoredGroups().filter(g => g.id !== groupId)
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups))
  } catch (error) {
    console.error('Error removing group from localStorage:', error)
  }
}

export function clearStoredGroups(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(GROUPS_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing groups from localStorage:', error)
  }
}