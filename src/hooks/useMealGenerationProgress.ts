'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createMealGenerationPoller, MealGenerationStatus } from '@/lib/mealGenerationService'

interface UseMealGenerationProgressOptions {
  autoStart?: boolean
  pollingInterval?: number
  onComplete?: (planId: string, mealsGenerated: number) => void
  onError?: (error: string) => void
}

interface UseMealGenerationProgressReturn {
  progress: number
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  error: string | null
  currentStep: string | null
  totalMeals: number | null
  jobId: string | null
  startPolling: (jobId: string) => void
  stopPolling: () => void
  reset: () => void
}

export function useMealGenerationProgress(
  options: UseMealGenerationProgressOptions = {}
): UseMealGenerationProgressReturn {
  const { autoStart = false, pollingInterval = 2000, onComplete, onError } = options

  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [totalMeals, setTotalMeals] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const pollerRef = useRef<ReturnType<typeof createMealGenerationPoller> | null>(null)
  const currentJobIdRef = useRef<string | null>(null)

  const handleUpdate = useCallback((statusData: MealGenerationStatus) => {
    setProgress(statusData.progress || 0)
    setStatus(statusData.status)
    setCurrentStep(statusData.current_step || null)
    
    if (statusData.status === 'completed') {
      setTotalMeals(statusData.total_meals_generated || 0)
    }

    // Clear any previous errors when we get updates
    if (error && statusData.status !== 'failed') {
      setError(null)
    }
  }, [error])

  const handleComplete = useCallback((statusData: MealGenerationStatus) => {
    setProgress(100)
    setStatus('completed')
    setTotalMeals(statusData.total_meals_generated || 0)
    setCurrentStep('Completed')
    setError(null)

    onComplete?.(currentJobIdRef.current || '', statusData.total_meals_generated || 0)
  }, [onComplete])

  const handleError = useCallback((errorMessage: string) => {
    setStatus('failed')
    setError(errorMessage)
    setCurrentStep(null)
    
    onError?.(errorMessage)
  }, [onError])

  const startPolling = useCallback((jobId: string) => {
    if (pollerRef.current) {
      pollerRef.current.stop()
    }

    currentJobIdRef.current = jobId
    setJobId(jobId)
    setStatus('pending')
    setProgress(0)
    setError(null)
    setCurrentStep('Starting...')
    setTotalMeals(null)

    pollerRef.current = createMealGenerationPoller(jobId, {
      onUpdate: handleUpdate,
      onComplete: handleComplete,
      onError: handleError,
      pollingInterval
    })

    pollerRef.current.start()
  }, [handleUpdate, handleComplete, handleError, pollingInterval])

  const stopPolling = useCallback(() => {
    if (pollerRef.current) {
      pollerRef.current.stop()
      pollerRef.current = null
    }
    currentJobIdRef.current = null
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    setProgress(0)
    setStatus('idle')
    setError(null)
    setCurrentStep(null)
    setTotalMeals(null)
    setJobId(null)
  }, [stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Auto-start if requested (though this is typically not used in this context)
  useEffect(() => {
    if (autoStart && status === 'idle') {
      // This would need a jobId to work, so it's mainly here for completeness
      // In practice, startPolling is called explicitly with a jobId
    }
  }, [autoStart, status])

  return {
    progress,
    status,
    error,
    currentStep,
    totalMeals,
    jobId,
    startPolling,
    stopPolling,
    reset
  }
}

// Additional hook for managing multiple concurrent meal generations
export function useMealGenerationProgressMultiple() {
  const [jobs, setJobs] = useState<Map<string, any>>(new Map())

  const createJobTracker = useCallback((jobId: string, options: UseMealGenerationProgressOptions = {}) => {
    // Note: This approach violates rules of hooks. For multiple job tracking,
    // consider using a different pattern like a job manager service or context.
    // This is kept as a placeholder but should not be used in production.
    
    const tracker = {
      progress: 0,
      status: 'idle' as const,
      error: null,
      currentStep: null,
      totalMeals: null,
      startPolling: (jobId: string) => {},
      stopPolling: () => {},
      reset: () => {}
    }
    
    setJobs(prevJobs => {
      const newJobs = new Map(prevJobs)
      newJobs.set(jobId, tracker)
      return newJobs
    })

    return tracker
  }, [])

  const removeJobTracker = useCallback((jobId: string) => {
    const tracker = jobs.get(jobId)
    if (tracker) {
      tracker.stopPolling()
      setJobs(prevJobs => {
        const newJobs = new Map(prevJobs)
        newJobs.delete(jobId)
        return newJobs
      })
    }
  }, [jobs])

  const getJobTracker = useCallback((jobId: string) => {
    return jobs.get(jobId)
  }, [jobs])

  const getAllJobs = useCallback(() => {
    return Array.from(jobs.entries()).map(([jobId, tracker]) => ({
      jobId,
      ...tracker
    }))
  }, [jobs])

  const clearAllJobs = useCallback(() => {
    jobs.forEach(tracker => tracker.stopPolling())
    setJobs(new Map())
  }, [jobs])

  // Cleanup all jobs on unmount
  useEffect(() => {
    return () => {
      clearAllJobs()
    }
  }, [clearAllJobs])

  return {
    createJobTracker,
    removeJobTracker,
    getJobTracker,
    getAllJobs,
    clearAllJobs,
    activeJobsCount: jobs.size
  }
}

// Hook for tracking meal generation with automatic cleanup
export function useMealGenerationProgressWithCleanup(
  options: UseMealGenerationProgressOptions & {
    autoCleanupDelay?: number // Delay before cleaning up completed/failed jobs (ms)
  } = {}
): UseMealGenerationProgressReturn {
  const { autoCleanupDelay = 30000, ...progressOptions } = options // Default 30 seconds
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const progressTracker = useMealGenerationProgress({
    ...progressOptions,
    onComplete: (planId, mealsGenerated) => {
      // Call the original onComplete
      options.onComplete?.(planId, mealsGenerated)
      
      // Schedule cleanup
      if (autoCleanupDelay > 0) {
        cleanupTimeoutRef.current = setTimeout(() => {
          progressTracker.reset()
        }, autoCleanupDelay)
      }
    },
    onError: (error) => {
      // Call the original onError
      options.onError?.(error)
      
      // Schedule cleanup
      if (autoCleanupDelay > 0) {
        cleanupTimeoutRef.current = setTimeout(() => {
          progressTracker.reset()
        }, autoCleanupDelay)
      }
    }
  })

  const originalReset = progressTracker.reset

  const reset = useCallback(() => {
    // Clear any pending cleanup
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }
    
    originalReset()
  }, [originalReset])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...progressTracker,
    reset
  }
}