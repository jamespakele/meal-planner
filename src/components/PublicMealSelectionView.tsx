'use client'

import React, { useState, useEffect } from 'react'
import MealCard from './MealCard'

interface PublicMealData {
  token: string
  role: 'co_manager' | 'other'
  plan: {
    id: string
    week_start: string
    group: {
      id: string
      name: string
      adults: number
      teens: number
      kids: number
      toddlers: number
      dietary_restrictions: string[]
    }
  }
  job: {
    id: string
    status: string
    total_meals: number
  }
  meals: any[]
  current_selections: any[]
  form_info: {
    role: 'co_manager' | 'other'
    can_override: boolean
    expires_at: string | null
    views_count: number
    instructions: string
  }
  meta: {
    total_meals: number
    groups_represented: string[]
    cached: boolean
  }
}

interface PublicMealSelectionViewProps {
  mealData: PublicMealData
  onSubmissionComplete: (response: any) => void
  onError: (error: string) => void
}

export default function PublicMealSelectionView({ 
  mealData, 
  onSubmissionComplete, 
  onError 
}: PublicMealSelectionViewProps) {
  const [selectedMeals, setSelectedMeals] = useState<Set<string>>(new Set())
  const [filteredGroup, setFilteredGroup] = useState<string>('all')
  const [submitting, setSubmitting] = useState(false)
  const [comments, setComments] = useState('')
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)

  // Initialize selected meals from current selections
  useEffect(() => {
    if (mealData.current_selections && Array.isArray(mealData.current_selections)) {
      const initialSelections = new Set<string>()
      mealData.current_selections.forEach((selection: any) => {
        if (selection.meal_id) {
          initialSelections.add(selection.meal_id)
        }
      })
      setSelectedMeals(initialSelections)
    }
  }, [mealData.current_selections])

  const availableGroups = mealData.meta.groups_represented || []
  const filteredMeals = filteredGroup === 'all' 
    ? mealData.meals 
    : mealData.meals.filter(meal => meal.group_name === filteredGroup)

  const handleMealToggle = (mealId: string) => {
    setSelectedMeals(prev => {
      const newSelections = new Set(prev)
      if (newSelections.has(mealId)) {
        newSelections.delete(mealId)
      } else {
        newSelections.add(mealId)
      }
      return newSelections
    })
  }

  const handleSelectAllForGroup = (groupName: string) => {
    const groupMeals = mealData.meals.filter(meal => meal.group_name === groupName)
    setSelectedMeals(prev => {
      const newSelections = new Set(prev)
      groupMeals.forEach(meal => newSelections.add(meal.id))
      return newSelections
    })
  }

  const handleDeselectAllForGroup = (groupName: string) => {
    const groupMeals = mealData.meals.filter(meal => meal.group_name === groupName)
    setSelectedMeals(prev => {
      const newSelections = new Set(prev)
      groupMeals.forEach(meal => newSelections.delete(meal.id))
      return newSelections
    })
  }

  const handleSubmit = async () => {
    if (selectedMeals.size === 0) {
      onError('Please select at least one meal before submitting.')
      return
    }

    setSubmitting(true)
    try {
      // Prepare selections data
      const selections = Array.from(selectedMeals).map(mealId => {
        const meal = mealData.meals.find(m => m.id === mealId)
        return {
          meal_id: mealId,
          meal_title: meal?.title || '',
          group_name: meal?.group_name || '',
          selected: true
        }
      })

      const response = await fetch('/api/form-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: mealData.token,
          selections,
          comments: comments.trim() || null,
          idempotency_key: `${mealData.token}-${Date.now()}`
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many submissions. Please wait a moment and try again.')
        }
        if (response.status === 401) {
          throw new Error('This form link has expired. Please request a new link.')
        }
        throw new Error('Failed to submit your selections. Please try again.')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit selections')
      }

      // Success!
      onSubmissionComplete(result.data)

    } catch (err) {
      console.error('Error submitting form:', err)
      onError(err instanceof Error ? err.message : 'An unexpected error occurred while submitting.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Selection Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Selections</h2>
          <span className="text-sm text-gray-600">
            {selectedMeals.size} of {mealData.meals.length} meals selected
          </span>
        </div>
        
        {selectedMeals.size > 0 ? (
          <div className="space-y-2">
            {Array.from(selectedMeals).map(mealId => {
              const meal = mealData.meals.find(m => m.id === mealId)
              return meal ? (
                <div key={mealId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium text-gray-900">{meal.title}</span>
                    <span className="text-sm text-gray-500 ml-2">({meal.group_name})</span>
                  </div>
                  <button
                    onClick={() => handleMealToggle(mealId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ) : null
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No meals selected yet</p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {selectedMeals.size > 0 && (
            <button
              onClick={() => setShowSubmissionForm(!showSubmissionForm)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              {showSubmissionForm ? 'Hide Submission Form' : 'Done Selecting'}
            </button>
          )}
          <button
            onClick={() => setSelectedMeals(new Set())}
            className="text-gray-600 hover:text-gray-800 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            disabled={selectedMeals.size === 0}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Submission Form */}
      {showSubmissionForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Your Selections</h3>
          
          {/* Comments */}
          <div className="mb-4">
            <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
              Comments or Special Requests (Optional)
            </label>
            <textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any dietary preferences, substitutions, or notes..."
            />
            <p className="text-xs text-gray-500 mt-1">{comments.length}/1000 characters</p>
          </div>

          {/* Final confirmation */}
          <div className="bg-gray-50 rounded-md p-4 mb-4">
            <p className="text-sm text-gray-700">
              <strong>Ready to submit?</strong> You&apos;ve selected {selectedMeals.size} meals for {mealData.plan.group.name}.
              {mealData.role === 'co_manager' 
                ? ' As co-manager, your selections will be final.'
                : ' Your input will be considered along with the co-manager\'s choices.'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedMeals.size === 0}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit Selections'
              )}
            </button>
            <button
              onClick={() => setShowSubmissionForm(false)}
              className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Keep Selecting
            </button>
          </div>
        </div>
      )}

      {/* Group Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-medium text-gray-900">Filter by Group</h3>
          <span className="text-sm text-gray-600">
            Showing {filteredMeals.length} meals
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilteredGroup('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filteredGroup === 'all'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Groups ({mealData.meals.length})
          </button>
          {availableGroups.map(group => {
            const groupMealCount = mealData.meals.filter(meal => meal.group_name === group).length
            const groupSelectedCount = mealData.meals.filter(meal => 
              meal.group_name === group && selectedMeals.has(meal.id)
            ).length
            
            return (
              <div key={group} className="flex items-center gap-1">
                <button
                  onClick={() => setFilteredGroup(group)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filteredGroup === group
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {group} ({groupMealCount})
                  {groupSelectedCount > 0 && (
                    <span className="ml-1 bg-green-500 text-white text-xs px-1 rounded-full">
                      {groupSelectedCount}
                    </span>
                  )}
                </button>
                {filteredGroup === group && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSelectAllForGroup(group)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="Select all meals in this group"
                    >
                      All
                    </button>
                    <span className="text-xs text-gray-400">|</span>
                    <button
                      onClick={() => handleDeselectAllForGroup(group)}
                      className="text-xs text-red-600 hover:text-red-800"
                      title="Deselect all meals in this group"
                    >
                      None
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Meals Grid */}
      {filteredMeals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onSelect={(mealId) => handleMealToggle(mealId)}
              showSelection={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-3v3m-3-3a4 4 0 118 0M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meals available</h3>
            <p className="text-gray-600">
              {filteredGroup === 'all' 
                ? 'No meals have been generated for this plan yet.'
                : `No meals available for ${filteredGroup}.`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}