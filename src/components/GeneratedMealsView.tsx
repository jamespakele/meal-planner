'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { getSupabaseClient } from '@/lib/supabase/singleton'

interface GeneratedMeal {
  id: string
  job_id: string
  group_id: string
  group_name: string
  title: string
  description: string
  prep_time: number
  cook_time: number
  total_time: number
  servings: number
  ingredients: string[]
  instructions: string[]
  tags: string[]
  dietary_info: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  selected: boolean
  created_at: string
}

interface MealGenerationJob {
  id: string
  plan_name: string
  week_start: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  current_step: string
  total_meals_generated: number
  created_at: string
  completed_at: string
}

interface GeneratedMealsViewProps {
  jobId?: string
  planId?: string
  onClose?: () => void
}

export default function GeneratedMealsView({ jobId, planId, onClose }: GeneratedMealsViewProps) {
  const { user } = useAuth()
  const [job, setJob] = useState<MealGenerationJob | null>(null)
  const [meals, setMeals] = useState<GeneratedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<GeneratedMeal | null>(null)
  
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (user && (jobId || planId)) {
      loadMealsData()
    }
  }, [user, jobId, planId])

  const loadMealsData = async () => {
    try {
      setLoading(true)
      setError(null)

      let targetJobId = jobId

      // If we have a planId but no jobId, find the job from the meal_plans table
      if (planId && !jobId) {
        const { data: planData, error: planError } = await supabase
          .from('meal_plans')
          .select('job_id')
          .eq('id', planId)
          .single()

        if (planError) throw planError
        targetJobId = planData.job_id
      }

      if (!targetJobId) {
        throw new Error('No job ID found')
      }

      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('meal_generation_jobs')
        .select('*')
        .eq('id', targetJobId)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load generated meals
      const { data: mealsData, error: mealsError } = await supabase
        .from('generated_meals')
        .select('*')
        .eq('job_id', targetJobId)
        .order('group_name', { ascending: true })
        .order('title', { ascending: true })

      if (mealsError) throw mealsError
      setMeals(mealsData || [])

      // Set the first group as selected if we have meals
      if (mealsData && mealsData.length > 0) {
        const groups = [...new Set(mealsData.map(m => m.group_id))]
        setSelectedGroup(groups[0])
      }

    } catch (error) {
      console.error('Error loading meals data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load meals')
    } finally {
      setLoading(false)
    }
  }

  const handleMealToggle = async (meal: GeneratedMeal) => {
    try {
      const newSelected = !meal.selected
      
      const { error } = await supabase
        .from('generated_meals')
        .update({ selected: newSelected })
        .eq('id', meal.id)

      if (error) throw error

      // Update local state
      setMeals(meals.map(m => 
        m.id === meal.id ? { ...m, selected: newSelected } : m
      ))
    } catch (error) {
      console.error('Error updating meal selection:', error)
      setError('Failed to update meal selection')
    }
  }

  const getUniqueGroups = () => {
    const groups = meals.reduce((acc, meal) => {
      if (!acc.find(g => g.id === meal.group_id)) {
        acc.push({ id: meal.group_id, name: meal.group_name })
      }
      return acc
    }, [] as { id: string, name: string }[])
    return groups
  }

  const getSelectedMealsCount = () => {
    return meals.filter(m => m.selected).length
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading generated meals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-600">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading meals</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    )
  }

  const groups = getUniqueGroups()
  const filteredMeals = selectedGroup 
    ? meals.filter(m => m.group_id === selectedGroup)
    : meals

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generated Meals</h1>
              {job && (
                <p className="text-gray-700">
                  {job.plan_name} - Week of {new Date(job.week_start).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{getSelectedMealsCount()}</span> of {meals.length} meals selected
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar - Group Filter */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filter by Group</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                    selectedGroup === null
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Groups ({meals.length})
                </button>
                {groups.map((group) => {
                  const groupMealCount = meals.filter(m => m.group_id === group.id).length
                  const groupSelectedCount = meals.filter(m => m.group_id === group.id && m.selected).length
                  
                  return (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(group.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                        selectedGroup === group.id
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {group.name} ({groupSelectedCount}/{groupMealCount})
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Main Content - Meals Grid */}
          <div className="mt-8 lg:mt-0 lg:col-span-9">
            {filteredMeals.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No meals found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedGroup ? 'No meals found for this group.' : 'No meals have been generated yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className={`bg-white shadow rounded-lg overflow-hidden transition-all ${
                      meal.selected ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {/* Meal Header */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{meal.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{meal.group_name}</p>
                        </div>
                        <div className="ml-4 flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(meal.difficulty)}`}>
                            {meal.difficulty}
                          </span>
                          <button
                            onClick={() => handleMealToggle(meal)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              meal.selected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                            }`}
                          >
                            {meal.selected && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meal Details */}
                    <div className="p-4">
                      {meal.description && (
                        <p className="text-sm text-gray-700 mb-3">{meal.description}</p>
                      )}

                      {/* Time and Servings */}
                      <div className="flex items-center space-x-4 mb-3 text-sm text-gray-600">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {meal.total_time} min
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {meal.servings} servings
                        </div>
                      </div>

                      {/* Tags */}
                      {meal.tags && meal.tags.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {meal.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dietary Info */}
                      {meal.dietary_info && meal.dietary_info.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {meal.dietary_info.map((info, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md"
                              >
                                {info}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* View Details Button */}
                      <button
                        onClick={() => setSelectedMeal(meal)}
                        className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded text-sm"
                      >
                        View Recipe Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{selectedMeal.title}</h3>
                <button
                  onClick={() => setSelectedMeal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {/* Description */}
                  {selectedMeal.description && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-700">{selectedMeal.description}</p>
                    </div>
                  )}

                  {/* Ingredients */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {selectedMeal.ingredients.map((ingredient, index) => (
                        <li key={index}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Instructions</h4>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      {selectedMeal.instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setSelectedMeal(null)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded mr-2"
                >
                  Close
                </button>
                <button
                  onClick={() => handleMealToggle(selectedMeal)}
                  className={`font-medium py-2 px-4 rounded ${
                    selectedMeal.selected
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {selectedMeal.selected ? 'Remove from Plan' : 'Add to Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}