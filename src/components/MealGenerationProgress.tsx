'use client'

import React from 'react'

interface MealGenerationProgressProps {
  status: 'idle' | 'validating' | 'generating' | 'processing' | 'completed' | 'error'
  progress?: number // 0-100
  currentStep?: string
  totalGroups?: number
  processedGroups?: number
  error?: string
  onRetry?: () => void
  onCancel?: () => void
}

export default function MealGenerationProgress({
  status,
  progress = 0,
  currentStep,
  totalGroups = 0,
  processedGroups = 0,
  error,
  onRetry,
  onCancel
}: MealGenerationProgressProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'idle':
        return {
          title: 'Ready to Generate Meals',
          description: 'Click generate to create AI-powered meal suggestions',
          icon: '🍽️'
        }
      case 'validating':
        return {
          title: 'Validating Plan',
          description: 'Checking groups and meal assignments...',
          icon: '🔍'
        }
      case 'generating':
        return {
          title: 'Generating Meals',
          description: currentStep || `Processing group ${processedGroups + 1} of ${totalGroups}...`,
          icon: '🤖'
        }
      case 'processing':
        return {
          title: 'Processing Results',
          description: 'Organizing and storing your meal options...',
          icon: '⚡'
        }
      case 'completed':
        return {
          title: 'Meals Generated Successfully!',
          description: 'Your AI-powered meal options are ready to review',
          icon: '✅'
        }
      case 'error':
        return {
          title: 'Generation Failed',
          description: error || 'An unexpected error occurred',
          icon: '❌'
        }
      default:
        return {
          title: 'Processing',
          description: 'Working on your request...',
          icon: '⏳'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const isActive = ['validating', 'generating', 'processing'].includes(status)
  const isCompleted = status === 'completed'
  const isError = status === 'error'

  return (
    <div className="max-w-md mx-auto">
      {/* Status Card */}
      <div className={`border rounded-lg p-6 text-center ${
        isCompleted 
          ? 'border-green-500 bg-green-50' 
          : isError 
            ? 'border-red-500 bg-red-50'
            : isActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white'
      }`}>
        {/* Icon */}
        <div className="text-4xl mb-4">
          {isActive ? (
            <div className="animate-bounce">
              {statusInfo.icon}
            </div>
          ) : (
            statusInfo.icon
          )}
        </div>

        {/* Title */}
        <h3 className={`text-lg font-semibold mb-2 ${
          isCompleted ? 'text-green-900' : isError ? 'text-red-900' : 'text-gray-900'
        }`}>
          {statusInfo.title}
        </h3>

        {/* Description */}
        <p className={`text-sm mb-4 ${
          isCompleted ? 'text-green-700' : isError ? 'text-red-700' : 'text-gray-600'
        }`}>
          {statusInfo.description}
        </p>

        {/* Progress Bar (only show during active states) */}
        {isActive && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: progress > 0 ? `${progress}%` : '0%'
                }}
              />
            </div>
            {progress > 0 && (
              <p className="text-xs text-gray-500 mt-2">{Math.round(progress)}% complete</p>
            )}
          </div>
        )}

        {/* Group Progress (during generation) */}
        {status === 'generating' && totalGroups > 0 && (
          <div className="mb-4 p-3 bg-white rounded-md border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress:</span>
              <span className="font-medium text-gray-900">
                {processedGroups} / {totalGroups} groups
              </span>
            </div>
            
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: totalGroups > 0 ? `${(processedGroups / totalGroups) * 100}%` : '0%'
                }}
              />
            </div>
          </div>
        )}

        {/* Loading Spinner for Active States */}
        {isActive && (
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-3">
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Try Again
            </button>
          )}
          
          {isActive && onCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Additional Info */}
      {isActive && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            This may take a few moments while we generate personalized meal suggestions for your groups
          </p>
        </div>
      )}

      {/* Error Details */}
      {isError && error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-sm font-medium text-red-900 mb-1">Error Details:</h4>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Success Details */}
      {isCompleted && totalGroups > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-sm text-green-900">
            <p className="font-medium mb-1">Generation Complete!</p>
            <ul className="text-xs space-y-1">
              <li>✅ Processed {totalGroups} group{totalGroups !== 1 ? 's' : ''}</li>
              <li>✅ Generated personalized meal options</li>
              <li>✅ Applied dietary restrictions</li>
              <li>✅ Calculated serving sizes</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// Utility hook for managing generation progress
export function useMealGenerationProgress() {
  const [status, setStatus] = React.useState<MealGenerationProgressProps['status']>('idle')
  const [progress, setProgress] = React.useState(0)
  const [currentStep, setCurrentStep] = React.useState<string>()
  const [error, setError] = React.useState<string>()
  const [processedGroups, setProcessedGroups] = React.useState(0)
  const [totalGroups, setTotalGroups] = React.useState(0)

  const reset = () => {
    setStatus('idle')
    setProgress(0)
    setCurrentStep(undefined)
    setError(undefined)
    setProcessedGroups(0)
    setTotalGroups(0)
  }

  const startValidation = () => {
    setStatus('validating')
    setProgress(10)
    setError(undefined)
  }

  const startGeneration = (total: number) => {
    setStatus('generating')
    setTotalGroups(total)
    setProcessedGroups(0)
    setProgress(20)
  }

  const updateProgress = (processed: number, step?: string) => {
    setProcessedGroups(processed)
    setCurrentStep(step)
    // Progress from 20% to 80% based on group completion
    const groupProgress = (processed / totalGroups) * 60
    setProgress(20 + groupProgress)
  }

  const startProcessing = () => {
    setStatus('processing')
    setProgress(90)
  }

  const complete = () => {
    setStatus('completed')
    setProgress(100)
  }

  const setErrorState = (errorMessage: string) => {
    setStatus('error')
    setError(errorMessage)
  }

  return {
    status,
    progress,
    currentStep,
    error,
    processedGroups,
    totalGroups,
    reset,
    startValidation,
    startGeneration,
    updateProgress,
    startProcessing,
    complete,
    setError: setErrorState
  }
}