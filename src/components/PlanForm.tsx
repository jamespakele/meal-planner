'use client'

import React, { useState, useEffect } from 'react'
import { PlanData, validatePlan, sanitizePlanName } from '@/lib/planValidation'
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
    group_ids: initialData?.group_ids || [],
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

  const handleGroupToggle = (groupId: string) => {
    const currentGroups = formData.group_ids
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter(id => id !== groupId)
      : [...currentGroups, groupId]
    
    handleInputChange('group_ids', newGroups)
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

      {/* Group Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Groups
        </label>
        
        {noGroupsAvailable ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              No groups available. Please create a group first.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-4 bg-white">
            {availableGroups.map((group) => (
              <div key={group.id} className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id={`group-${group.id}`}
                  checked={formData.group_ids.includes(group.id)}
                  onChange={() => handleGroupToggle(group.id)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1 min-w-0">
                  <label 
                    htmlFor={`group-${group.id}`} 
                    className="text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    {group.name}
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    {group.adults} adults, {group.teens} teens, {group.kids} kids, {group.toddlers} toddlers
                  </p>
                  {group.dietary_restrictions.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {group.dietary_restrictions.join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {errors.group_ids && (
          <p className="mt-1 text-sm text-red-600">{errors.group_ids[0]}</p>
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
          disabled={isSubmitting || noGroupsAvailable}
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