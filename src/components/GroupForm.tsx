'use client'

import React, { useState, useEffect } from 'react'
import { GroupData, validateGroup, COMMON_DIETARY_RESTRICTIONS, sanitizeGroupName } from '@/lib/groupValidation'
import { calculateAdultEquivalent } from '@/lib/adultEquivalent'

interface GroupFormProps {
  onSubmit: (data: GroupData) => void | Promise<void>
  onCancel: () => void
  initialData?: GroupData
}

export default function GroupForm({ onSubmit, onCancel, initialData }: GroupFormProps) {
  const [formData, setFormData] = useState<GroupData>({
    name: initialData?.name || '',
    adults: initialData?.adults || 0,
    teens: initialData?.teens || 0,
    kids: initialData?.kids || 0,
    toddlers: initialData?.toddlers || 0,
    dietary_restrictions: initialData?.dietary_restrictions || []
  })

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dietaryInput, setDietaryInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const isEditing = Boolean(initialData)
  const adultEquivalent = calculateAdultEquivalent({
    adults: formData.adults,
    teens: formData.teens,
    kids: formData.kids,
    toddlers: formData.toddlers
  })

  const handleInputChange = (field: keyof GroupData, value: any) => {
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

  const handleNumberInput = (field: 'adults' | 'teens' | 'kids' | 'toddlers', value: string) => {
    const numValue = parseInt(value, 10)
    // Handle NaN and negative values
    const sanitizedValue = isNaN(numValue) ? 0 : Math.max(0, numValue)
    handleInputChange(field, sanitizedValue)
  }

  const addDietaryRestriction = (restriction: string) => {
    const trimmed = restriction.trim()
    if (trimmed && !formData.dietary_restrictions.includes(trimmed)) {
      handleInputChange('dietary_restrictions', [...formData.dietary_restrictions, trimmed])
    }
    setDietaryInput('')
    setShowSuggestions(false)
  }

  const removeDietaryRestriction = (index: number) => {
    const newRestrictions = formData.dietary_restrictions.filter((_, i) => i !== index)
    handleInputChange('dietary_restrictions', newRestrictions)
  }

  const handleDietaryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && dietaryInput.trim()) {
      e.preventDefault()
      addDietaryRestriction(dietaryInput)
    }
  }

  const getSuggestions = () => {
    const query = dietaryInput.toLowerCase()
    return COMMON_DIETARY_RESTRICTIONS.filter(restriction =>
      restriction.toLowerCase().includes(query) &&
      !formData.dietary_restrictions.includes(restriction)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const sanitizedData = {
      ...formData,
      name: sanitizeGroupName(formData.name)
    }
    
    const validation = validateGroup(sanitizedData)
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

  const suggestions = showSuggestions && dietaryInput ? getSuggestions() : []

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditing ? 'Edit Group' : 'Create New Group'}
        </h2>
      </div>

      {/* Group Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Group Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter group name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>
        )}
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="adults" className="block text-sm font-medium text-gray-700 mb-2">
            Adults
          </label>
          <input
            type="number"
            id="adults"
            min="0"
            value={formData.adults}
            onChange={(e) => handleNumberInput('adults', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.adults && (
            <p className="mt-1 text-sm text-red-600">{errors.adults[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="teens" className="block text-sm font-medium text-gray-700 mb-2">
            Teens
          </label>
          <input
            type="number"
            id="teens"
            min="0"
            value={formData.teens}
            onChange={(e) => handleNumberInput('teens', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.teens && (
            <p className="mt-1 text-sm text-red-600">{errors.teens[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="kids" className="block text-sm font-medium text-gray-700 mb-2">
            Kids
          </label>
          <input
            type="number"
            id="kids"
            min="0"
            value={formData.kids}
            onChange={(e) => handleNumberInput('kids', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.kids && (
            <p className="mt-1 text-sm text-red-600">{errors.kids[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="toddlers" className="block text-sm font-medium text-gray-700 mb-2">
            Toddlers
          </label>
          <input
            type="number"
            id="toddlers"
            min="0"
            value={formData.toddlers}
            onChange={(e) => handleNumberInput('toddlers', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.toddlers && (
            <p className="mt-1 text-sm text-red-600">{errors.toddlers[0]}</p>
          )}
        </div>
      </div>

      {/* Adult Equivalent Display */}
      <div className="bg-blue-50 p-4 rounded-md">
        <p className="text-sm font-medium text-blue-800">
          Adult Equivalent: {adultEquivalent}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          This value is used to scale meal portions and ingredients
        </p>
      </div>

      {/* General Errors */}
      {errors.general && (
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-600">{errors.general[0]}</p>
        </div>
      )}

      {/* Dietary Restrictions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Dietary Restrictions
        </label>
        
        {/* Current Restrictions */}
        <div className="mb-3">
          {formData.dietary_restrictions.map((restriction, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 mr-2 mb-2"
            >
              {restriction}
              <button
                type="button"
                onClick={() => removeDietaryRestriction(index)}
                className="ml-2 text-gray-600 hover:text-gray-800"
                aria-label={`Remove ${restriction}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Add New Restriction */}
        <div className="relative">
          <input
            type="text"
            value={dietaryInput}
            onChange={(e) => {
              setDietaryInput(e.target.value)
              setShowSuggestions(e.target.value.length > 0)
            }}
            onKeyPress={handleDietaryKeyPress}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add dietary restriction and press Enter"
          />
          
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addDietaryRestriction(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-900 hover:text-gray-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {errors.dietary_restrictions && (
          <p className="mt-1 text-sm text-red-600">{errors.dietary_restrictions[0]}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Group' : 'Create Group')}
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