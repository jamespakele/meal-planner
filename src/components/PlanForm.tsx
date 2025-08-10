'use client'

import React, { useState, useEffect } from 'react'
import { PlanData, validatePlan, sanitizePlanName, GroupMealAssignment } from '@/lib/planValidation'
import { getStoredGroups, StoredGroup } from '@/lib/mockStorage'

interface PlanFormProps {
  onSubmit: (data: PlanData) => void | Promise<void>
  onCancel: () => void
  initialData?: PlanData
}

export default function PlanForm({ onSubmit, onCancel, initialData }: PlanFormProps) {
  const [formData, setFormData] = useState<PlanData>({
    name: initialData?.name || '',
    week_start: initialData?.week_start || '',
    group_meals: initialData?.group_meals || [],
    notes: initialData?.notes || ''
  })

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<StoredGroup[]>([])

  const isEditing = Boolean(initialData)

  useEffect(() => {
    // Load available groups
    const groups = getStoredGroups()
    setAvailableGroups(groups)
  }, [])

  const handleInputChange = (field: keyof PlanData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleGroupMealChange = (groupId: string, mealCount: number, notes?: string) => {
    const currentGroupMeals = formData.group_meals
    const existingIndex = currentGroupMeals.findIndex(gm => gm.group_id === groupId)
    
    let newGroupMeals: GroupMealAssignment[]
    
    if (mealCount === 0) {
      // Remove the group meal assignment if meal count is 0
      newGroupMeals = currentGroupMeals.filter(gm => gm.group_id !== groupId)
    } else {
      // Update or add the group meal assignment
      const groupMealAssignment: GroupMealAssignment = {
        group_id: groupId,
        meal_count: mealCount,
        notes: notes || undefined
      }
      
      if (existingIndex >= 0) {
        newGroupMeals = [...currentGroupMeals]
        newGroupMeals[existingIndex] = groupMealAssignment
      } else {
        newGroupMeals = [...currentGroupMeals, groupMealAssignment]
      }
    }
    
    handleInputChange('group_meals', newGroupMeals)
  }

  const getGroupMealCount = (groupId: string): number => {
    const groupMeal = formData.group_meals.find(gm => gm.group_id === groupId)
    return groupMeal?.meal_count || 0
  }

  const getGroupNotes = (groupId: string): string => {
    const groupMeal = formData.group_meals.find(gm => gm.group_id === groupId)
    return groupMeal?.notes || ''
  }

  const getTotalMealCount = (): number => {
    return formData.group_meals.reduce((sum, gm) => sum + gm.meal_count, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const sanitizedData = {
      ...formData,
      name: sanitizePlanName(formData.name)
    }
    
    const validation = validatePlan(sanitizedData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({}) // Clear any previous errors
    
    try {
      await onSubmit(sanitizedData)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const noGroupsAvailable = availableGroups.length === 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditing ? 'Edit Plan' : 'Create New Plan'}
        </h2>
      </div>

      {/* Plan Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Plan Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter plan name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
        )}
      </div>

      {/* Week Start Date */}
      <div>
        <label htmlFor="week_start" className="block text-sm font-medium text-gray-700 mb-2">
          Week Start Date
        </label>
        <input
          type="date"
          id="week_start"
          value={formData.week_start}
          onChange={(e) => handleInputChange('week_start', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {errors.week_start && (
          <p className="mt-1 text-sm text-red-600">{errors.week_start[0]}</p>
        )}
      </div>

      {/* Group Meal Assignments */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Assign Meals to Groups
          </label>
          {getTotalMealCount() > 0 && (
            <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
              Total: {getTotalMealCount()} meals
            </span>
          )}
        </div>
        
        {noGroupsAvailable ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              No groups available. Please create a group first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {availableGroups.map((group) => {
              const mealCount = getGroupMealCount(group.id)
              const notes = getGroupNotes(group.id)
              const isSelected = mealCount > 0
              
              return (
                <div 
                  key={group.id} 
                  className={`border rounded-lg p-4 transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {group.adults} adults, {group.teens} teens, {group.kids} kids, {group.toddlers} toddlers
                      </p>
                      {group.dietary_restrictions.length > 0 && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {group.dietary_restrictions.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Meal Count Controls */}
                  <div className="flex items-center space-x-4 mb-3">
                    <label className="text-sm text-gray-700 font-medium">
                      Meals:
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleGroupMealChange(group.id, Math.max(0, mealCount - 1), notes)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={mealCount === 0}
                      >
                        −
                      </button>
                      
                      <input
                        type="number"
                        min="0"
                        max="14"
                        value={mealCount}
                        onChange={(e) => {
                          const newCount = Math.max(0, Math.min(14, parseInt(e.target.value) || 0))
                          handleGroupMealChange(group.id, newCount, notes)
                        }}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      
                      <button
                        type="button"
                        onClick={() => handleGroupMealChange(group.id, Math.min(14, mealCount + 1), notes)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={mealCount >= 14}
                      >
                        +
                      </button>
                    </div>
                    
                    <span className="text-xs text-gray-500">
                      (max 14 per group)
                    </span>
                  </div>
                  
                  {/* Group-specific Notes (only show when meals are assigned) */}
                  {isSelected && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes for this group (optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => handleGroupMealChange(group.id, mealCount, e.target.value)}
                        placeholder="e.g., 'Main household meals' or 'Special dietary requirements'"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        maxLength={200}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {notes.length}/200 characters
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {errors.group_meals && (
          <p className="mt-2 text-sm text-red-600">{errors.group_meals[0]}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Add any notes or special instructions for this meal plan"
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes[0]}</p>
        )}
      </div>

      {/* General Errors */}
      {errors.general && (
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-600">{errors.general[0]}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={isSubmitting || noGroupsAvailable || getTotalMealCount() === 0}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting 
            ? (isEditing ? 'Updating...' : 'Creating...') 
            : (isEditing ? 'Update Plan' : 'Create Plan')
          }
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}