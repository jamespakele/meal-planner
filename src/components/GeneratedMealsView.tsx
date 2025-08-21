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
  isPublic?: boolean
}

interface ShareLinkData {
  share_url: string
  token: string
  job_id: string
  created_at: string
  expires_at: string | null
  access_count: number
  last_accessed_at: string | null
  is_existing?: boolean
}

export default function GeneratedMealsView({ jobId, planId, onClose, isPublic = false }: GeneratedMealsViewProps) {
  const { user } = useAuth()
  const [job, setJob] = useState<MealGenerationJob | null>(null)
  const [meals, setMeals] = useState<GeneratedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [selectedMeal, setSelectedMeal] = useState<GeneratedMeal | null>(null)
  
  // Sharing state
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  
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

      // Default all groups to expanded when meals are loaded
      if (mealsData && mealsData.length > 0) {
        const initialCollapsedState: Record<string, boolean> = {}
        const uniqueGroups = mealsData.reduce((acc, meal) => {
          if (!acc.find((g: any) => g.id === meal.group_id)) {
            acc.push({ id: meal.group_id, name: meal.group_name })
          }
          return acc
        }, [] as { id: string, name: string }[])
        
        uniqueGroups.forEach((group: { id: string; name: string }) => {
          initialCollapsedState[group.id] = false // false means expanded
        })
        setCollapsedGroups(initialCollapsedState)
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

  const handleGenerateShareLink = async () => {
    if (!job?.id) return

    try {
      setShareLoading(true)
      setShareError(null)

      const response = await fetch('/api/shared-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate share link')
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate share link')
      }

      setShareData(result.data)
    } catch (error) {
      console.error('Error generating share link:', error)
      setShareError(error instanceof Error ? error.message : 'Failed to generate share link')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!shareData?.share_url) return

    try {
      await navigator.clipboard.writeText(shareData.share_url)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const openShareModal = () => {
    setShowShareModal(true)
    setShareError(null)
    setShareData(null)
    setCopyFeedback(false)
  }

  const parseGroupRequirements = () => {
    if (!(job as any)?.groups_data) return {}
    
    const requirements: Record<string, number> = {}
    try {
      const groupsData = Array.isArray((job as any).groups_data) ? (job as any).groups_data : []
      groupsData.forEach((group: any) => {
        if (group.group_id && typeof group.meals_to_generate === 'number') {
          // Calculate original requirement: meals_to_generate = meal_count_requested + 2
          const originalRequirement = Math.max(0, group.meals_to_generate - 2)
          requirements[group.group_id] = originalRequirement
        }
      })
    } catch (error) {
      console.warn('Failed to parse group requirements:', error)
    }
    return requirements
  }

  const getGroupsWithMeals = () => {
    const groupsMap = new Map<string, {
      id: string
      name: string
      meals: GeneratedMeal[]
      selectedCount: number
      totalCount: number
      requiredCount: number
    }>()
    
    const requirements = parseGroupRequirements()

    meals.forEach(meal => {
      if (!groupsMap.has(meal.group_id)) {
        groupsMap.set(meal.group_id, {
          id: meal.group_id,
          name: meal.group_name,
          meals: [],
          selectedCount: 0,
          totalCount: 0,
          requiredCount: requirements[meal.group_id] || 0
        })
      }
      
      const group = groupsMap.get(meal.group_id)!
      group.meals.push(meal)
      group.totalCount++
      if (meal.selected) {
        group.selectedCount++
      }
    })

    return Array.from(groupsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
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

  const groupsWithMeals = getGroupsWithMeals()
  
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const getSelectionStatus = (selectedCount: number, requiredCount: number) => {
    if (requiredCount === 0) return 'neutral'
    if (selectedCount === 0) return 'neutral'
    if (selectedCount < requiredCount) return 'progress'
    if (selectedCount === requiredCount) return 'complete'
    return 'over'
  }

  const getSelectionInstruction = (selectedCount: number, requiredCount: number) => {
    const status = getSelectionStatus(selectedCount, requiredCount)
    
    if (requiredCount === 0) {
      return { text: 'Optional meals - select any you like', icon: '📄' }
    }
    
    switch (status) {
      case 'complete':
        return { 
          text: `✓ ${requiredCount} meal${requiredCount === 1 ? '' : 's'} selected (complete!)`, 
          icon: '✅' 
        }
      case 'over':
        return { 
          text: `⚠ ${selectedCount} selected (only need ${requiredCount})`, 
          icon: '⚠️' 
        }
      default:
        return { 
          text: `Select ${requiredCount} meal${requiredCount === 1 ? '' : 's'} for this group`, 
          icon: '📋' 
        }
    }
  }

  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'over':
        return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'progress':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

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
              {!isPublic && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{getSelectedMealsCount()}</span> of {meals.length} meals selected
                </div>
              )}
              {!isPublic && job?.status === 'completed' && (
                <button
                  onClick={openShareModal}
                  className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Share
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
                >
                  {isPublic ? 'Close' : 'Back to Dashboard'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Content - Grouped Meals */}
        {groupsWithMeals.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No meals found</h3>
            <p className="mt-1 text-sm text-gray-500">No meals have been generated yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupsWithMeals.map((group) => {
              const isCollapsed = collapsedGroups[group.id] || false
              const status = getSelectionStatus(group.selectedCount, group.requiredCount)
              const instruction = getSelectionInstruction(group.selectedCount, group.requiredCount)
              const statusStyling = getStatusStyling(status)
              
              return (
                <div key={group.id} className="bg-white shadow rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    aria-expanded={!isCollapsed}
                    aria-controls={`group-${group.id}-content`}
                    aria-describedby={`group-${group.id}-instruction`}
                  >
                    <div className="flex items-center space-x-3">
                      <h2 className="text-xl font-semibold text-gray-900">{group.name}</h2>
                      <span className="text-sm text-gray-600">
                        ({group.selectedCount}/{group.totalCount} meals selected)
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        isCollapsed ? 'rotate-0' : 'rotate-180'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Instruction Bar */}
                  {!isCollapsed && (
                    <div 
                      id={`group-${group.id}-instruction`}
                      className={`px-6 py-3 border-t border-gray-100 ${statusStyling} transition-colors`}
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg" role="img" aria-hidden="true">
                          {instruction.icon}
                        </span>
                        <span className="text-sm font-medium">
                          {instruction.text}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Group Content */}
                  <div
                    id={`group-${group.id}-content`}
                    className={`${isCollapsed ? 'hidden' : 'block'} p-6 pt-0`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {group.meals.map((meal) => (
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* Share Modal */}
      {showShareModal && !isPublic && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Share Meal Plan</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                {!shareData && !shareLoading && (
                  <div className="text-center py-6">
                    <div className="mx-auto h-12 w-12 text-blue-500 mb-4">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Share this meal plan</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Create a public link that anyone can access to view your generated meals.
                    </p>
                    <button
                      onClick={handleGenerateShareLink}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                    >
                      Generate Share Link
                    </button>
                  </div>
                )}

                {shareLoading && (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating share link...</p>
                  </div>
                )}

                {shareError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Failed to generate share link</h3>
                        <p className="mt-1 text-sm text-red-700">{shareError}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={handleGenerateShareLink}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {shareData && (
                  <div className="space-y-4">
                    {shareData.is_existing && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Existing share link</span> - This meal plan has already been shared.
                        </p>
                      </div>
                    )}

                    {/* Share URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Share URL
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          readOnly
                          value={shareData.share_url}
                          className="flex-1 min-w-0 border border-gray-300 rounded-l-md px-3 py-2 text-sm bg-gray-50"
                        />
                        <button
                          onClick={handleCopyShareLink}
                          className={`inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md text-sm font-medium ${
                            copyFeedback 
                              ? 'bg-green-50 text-green-700 border-green-300' 
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {copyFeedback ? (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Analytics */}
                    {shareData.access_count !== undefined && (
                      <div className="bg-gray-50 rounded-md p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Share Analytics</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Views:</span>
                            <span className="ml-2 font-medium">{shareData.access_count} {shareData.access_count === 1 ? 'view' : 'views'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Created:</span>
                            <span className="ml-2 font-medium">
                              {new Date(shareData.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {shareData.last_accessed_at && (
                            <div className="col-span-2">
                              <span className="text-gray-600">Last viewed:</span>
                              <span className="ml-2 font-medium">
                                {new Date(shareData.last_accessed_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {shareData.expires_at && (
                            <div className="col-span-2">
                              <span className="text-gray-600">Expires:</span>
                              <span className="ml-2 font-medium">
                                {new Date(shareData.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-blue-50 rounded-md p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">How to share</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Copy the link above and share it with anyone</li>
                        <li>• Recipients can view the meal plan without creating an account</li>
                        <li>• The shared link shows all generated meals in read-only format</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}