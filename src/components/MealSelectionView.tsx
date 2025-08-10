'use client'

import React, { useState, useEffect, useCallback } from 'react'
import MealCard from './MealCard'
import { 
  StoredGeneratedMeal, 
  StoredGroup, 
  getStoredGroups 
} from '@/lib/mockStorage'
import {
  getMealsForPlan,
  selectMealsForPlan,
  getMealStatistics,
  getMealsGroupedByGroup
} from '@/lib/mealGenerationWorkflow'

interface MealSelectionViewProps {
  planId: string
  onSelectionChange?: (selectedCount: number) => void
  onComplete?: () => void
  compact?: boolean
}

export default function MealSelectionView({
  planId,
  onSelectionChange,
  onComplete,
  compact = false
}: MealSelectionViewProps) {
  const [groupedMeals, setGroupedMeals] = useState<Record<string, StoredGeneratedMeal[]>>({})
  const [availableGroups, setAvailableGroups] = useState<Record<string, StoredGroup>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState({
    totalGenerated: 0,
    totalSelected: 0,
    byGroup: {} as Record<string, { generated: number; selected: number }>
  })

  const loadData = useCallback(() => {
    try {
      setLoading(true)
      
      // Load grouped meals
      const meals = getMealsGroupedByGroup(planId)
      setGroupedMeals(meals)
      
      // Load group information
      const groups = getStoredGroups()
      const groupsMap = groups.reduce((acc, group) => {
        acc[group.id] = group
        return acc
      }, {} as Record<string, StoredGroup>)
      setAvailableGroups(groupsMap)
      
      // Load statistics
      const stats = getMealStatistics(planId)
      setStatistics(stats)
      
      setError(null)
    } catch (error) {
      console.error('Error loading meal data:', error)
      setError('Failed to load meals')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleMealSelection = (mealId: string, selected: boolean) => {
    // Update local state immediately for responsiveness
    setGroupedMeals(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(groupId => {
        updated[groupId] = updated[groupId].map(meal =>
          meal.id === mealId ? { ...meal, selected } : meal
        )
      })
      return updated
    })

    // Get current selections and update
    const allMeals = Object.values(groupedMeals).flat()
    const currentSelected = allMeals.filter(m => m.selected).map(m => m.id)
    const newSelected = selected
      ? [...currentSelected, mealId]
      : currentSelected.filter(id => id !== mealId)

    // Persist selection
    selectMealsForPlan(planId, newSelected)
    
    // Update statistics
    const newStats = getMealStatistics(planId)
    setStatistics(newStats)
    
    // Notify parent of selection change
    if (onSelectionChange) {
      onSelectionChange(newSelected.length)
    }
  }

  const handleSelectAllForGroup = (groupId: string) => {
    const groupMeals = groupedMeals[groupId] || []
    const allSelected = groupMeals.every(meal => meal.selected)
    
    // Toggle all meals in the group
    groupMeals.forEach(meal => {
      handleMealSelection(meal.id, !allSelected)
    })
  }

  const getGroupSelectionStatus = (groupId: string) => {
    const groupMeals = groupedMeals[groupId] || []
    if (groupMeals.length === 0) return { selected: 0, total: 0, allSelected: false, noneSelected: true }
    
    const selected = groupMeals.filter(meal => meal.selected).length
    const total = groupMeals.length
    const allSelected = selected === total
    const noneSelected = selected === 0
    
    return { selected, total, allSelected, noneSelected }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-sm text-gray-600">Loading generated meals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Meals</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-3">
              <button
                onClick={loadData}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 text-sm rounded-md"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const groupIds = Object.keys(groupedMeals)
  
  if (groupIds.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2h4a1 1 0 011 1v2H3V5a1 1 0 011-1h3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Meals Found</h3>
        <p className="mt-1 text-sm text-gray-500">
          No generated meals found for this plan. Please generate meals first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Statistics Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Your Meals</h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose from {statistics.totalGenerated} AI-generated meal options
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.totalSelected}
            </div>
            <div className="text-sm text-gray-500">meals selected</div>
          </div>
        </div>
        
        {statistics.totalSelected > 0 && onComplete && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={onComplete}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
            >
              Continue with Selected Meals
            </button>
          </div>
        )}
      </div>

      {/* Group Sections */}
      {groupIds.map(groupId => {
        const group = availableGroups[groupId]
        const meals = groupedMeals[groupId] || []
        const selectionStatus = getGroupSelectionStatus(groupId)
        
        return (
          <div key={groupId} className="space-y-4">
            {/* Group Header */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {group?.name || `Group ${groupId}`}
                </h3>
                {group && (
                  <p className="text-sm text-gray-600">
                    {group.adults} adults, {group.teens} teens, {group.kids} kids, {group.toddlers} toddlers
                    {group.dietary_restrictions.length > 0 && (
                      <span className="ml-2">
                        • {group.dietary_restrictions.join(', ')}
                      </span>
                    )}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  {selectionStatus.selected} of {selectionStatus.total} selected
                </div>
                
                <button
                  onClick={() => handleSelectAllForGroup(groupId)}
                  className={`px-3 py-1 text-sm rounded-md font-medium ${
                    selectionStatus.allSelected
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {selectionStatus.allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            
            {/* Meals Grid */}
            <div className={compact 
              ? "space-y-3" 
              : "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
            }>
              {meals.map(meal => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onSelect={handleMealSelection}
                  showSelection={true}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}