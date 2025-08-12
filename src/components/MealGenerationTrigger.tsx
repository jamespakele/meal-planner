'use client'

import React, { useEffect, useState } from 'react'
import { useMealGenerationProgress } from '@/hooks/useMealGenerationProgress'
import { generateMealsForPlan } from '@/lib/mealGenerationService'

interface MealGenerationTriggerProps {
  plan: {
    id: string
    name: string
    week_start: string
    group_meals: Array<{
      group_id: string
      meal_count: number
      notes?: string
    }>
    notes?: string
  }
  onSuccess: (planId: string, totalMeals: number) => void
  onError?: (error: string) => void
}

export default function MealGenerationTrigger({ plan, onSuccess, onError }: MealGenerationTriggerProps) {
  const [localError, setLocalError] = useState<string | null>(null)

  // Calculate if the plan is ready for generation
  const canGenerate = plan && 
    plan.group_meals && 
    plan.group_meals.length > 0 && 
    plan.group_meals.some(gm => gm.meal_count > 0)

  const totalMealCount = plan?.group_meals?.reduce((sum, gm) => sum + gm.meal_count, 0) || 0

  const {
    progress,
    status,
    error: progressError,
    currentStep,
    totalMeals,
    startPolling,
    stopPolling,
    reset
  } = useMealGenerationProgress({
    autoStart: false,
    onComplete: (planId: string, mealsGenerated: number) => {
      onSuccess(planId, mealsGenerated)
    },
    onError: (error: string) => {
      onError?.(error)
    }
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Handle success callback when status changes to completed
  useEffect(() => {
    if (status === 'completed' && totalMeals !== null) {
      onSuccess(plan?.id || '', totalMeals)
    }
  }, [status, totalMeals, plan?.id, onSuccess])

  const handleGenerate = async () => {
    if (!plan || status === 'processing') {
      return
    }

    setLocalError(null)

    try {
      const result = await generateMealsForPlan(plan.id, {
        name: plan.name,
        week_start: plan.week_start,
        notes: plan.notes || '',
        group_meals: plan.group_meals
      })

      if (result.jobId) {
        startPolling(result.jobId)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setLocalError(`Failed to start meal generation: ${errorMessage}`)
      onError?.(errorMessage)
    }
  }

  const handleRetry = () => {
    reset()
    setLocalError(null)
    handleGenerate()
  }

  const handleGenerateAgain = () => {
    reset()
    setLocalError(null)
  }

  // Handle edge cases
  if (!plan) {
    return (
      <div className="text-center py-4">
        <button 
          disabled 
          className="bg-gray-400 text-white font-medium py-2 px-4 rounded cursor-not-allowed"
        >
          No Plan Selected
        </button>
        <p className="text-sm text-gray-600 mt-2">No plan selected</p>
      </div>
    )
  }

  if (!plan.group_meals || plan.group_meals.length === 0) {
    return (
      <div className="text-center py-4">
        <button 
          disabled 
          className="bg-gray-400 text-white font-medium py-2 px-4 rounded cursor-not-allowed"
        >
          Generate Meals
        </button>
        <p className="text-sm text-gray-600 mt-2">Assign meals to groups first</p>
      </div>
    )
  }

  if (totalMealCount === 0) {
    return (
      <div className="text-center py-4">
        <button 
          disabled 
          className="bg-gray-400 text-white font-medium py-2 px-4 rounded cursor-not-allowed"
        >
          Generate Meals
        </button>
        <p className="text-sm text-gray-600 mt-2">No meals requested</p>
      </div>
    )
  }

  // Error state
  if (status === 'failed' || progressError || localError) {
    const errorMessage = progressError || localError || 'Unknown error'
    
    return (
      <div className="text-center py-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition-colors"
          aria-describedby="error-description"
        >
          Try Again
        </button>
        <p id="error-description" className="sr-only">Retry meal generation after error</p>
      </div>
    )
  }

  // Success state
  if (status === 'completed') {
    return (
      <div className="text-center py-4">
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                ✓ {totalMeals} meals generated successfully!
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleGenerateAgain}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Generate Again
        </button>
      </div>
    )
  }

  // Processing state
  if (status === 'processing') {
    return (
      <div className="text-center py-4">
        <button 
          disabled 
          className="bg-gray-400 text-white font-medium py-2 px-4 rounded cursor-not-allowed flex items-center justify-center mx-auto"
        >
          <div 
            className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
            role="status"
            aria-live="polite"
          ></div>
          Generating Meals...
        </button>
        
        {/* Progress Bar */}
        <div className="mt-4 max-w-md mx-auto">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            ></div>
          </div>
          
          {/* Current Step */}
          {currentStep && (
            <p className="text-sm text-gray-600 mt-2">{currentStep}</p>
          )}
          
          {/* Progress Percentage */}
          <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% complete</p>
        </div>
      </div>
    )
  }

  // Default state - ready to generate
  return (
    <div className="text-center py-4">
      <button
        onClick={handleGenerate}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
        aria-describedby="generation-description"
      >
        Generate Meals for {plan.name}
      </button>
      <p 
        id="generation-description" 
        className="text-sm text-gray-600 mt-2"
      >
        Generate {totalMealCount} AI-powered meal{totalMealCount !== 1 ? 's' : ''} for this plan
      </p>
    </div>
  )
}