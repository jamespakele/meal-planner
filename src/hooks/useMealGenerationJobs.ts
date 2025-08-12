'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MealGenerationJob {
  id: string
  plan_name: string
  week_start: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  current_step: string | null
  total_meals_generated: number | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface JobCreationResponse {
  jobId: string
  status: string
  message: string
}

export function useMealGenerationJobs() {
  const [jobs, setJobs] = useState<MealGenerationJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all jobs for the user
  const fetchJobs = useCallback(async (status?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (status) {
        params.set('status', status)
      }

      const response = await fetch(`/api/meal-generation/jobs?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch jobs')
      }

      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create a new meal generation job
  const createJob = useCallback(async (planData: any): Promise<JobCreationResponse> => {
    try {
      setError(null)
      
      const response = await fetch('/api/meal-generation/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create job')
      }

      const result: JobCreationResponse = await response.json()
      
      // Refresh jobs list
      await fetchJobs()
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [fetchJobs])

  // Get a specific job by ID
  const getJob = useCallback(async (jobId: string): Promise<MealGenerationJob | null> => {
    try {
      setError(null)
      
      const response = await fetch(`/api/meal-generation/jobs?jobId=${jobId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch job')
      }

      const data = await response.json()
      return data.jobs?.[0] || null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching job:', err)
      return null
    }
  }, [])

  // Poll for job updates (for active jobs)
  const startPolling = useCallback((jobId: string, onUpdate?: (job: MealGenerationJob) => void) => {
    const pollInterval = setInterval(async () => {
      try {
        const job = await getJob(jobId)
        if (job) {
          // Update the job in the jobs list
          setJobs(prev => prev.map(j => j.id === jobId ? job : j))
          
          if (onUpdate) {
            onUpdate(job)
          }

          // Stop polling if job is completed or failed
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval)
          }
        }
      } catch (err) {
        console.error('Error polling job:', err)
        clearInterval(pollInterval)
      }
    }, 2000) // Poll every 2 seconds

    // Return cleanup function
    return () => clearInterval(pollInterval)
  }, [getJob])

  // Get active jobs (pending or processing)
  const activeJobs = jobs.filter(job => 
    job.status === 'pending' || job.status === 'processing'
  )

  // Get completed jobs
  const completedJobs = jobs.filter(job => job.status === 'completed')

  // Get failed jobs
  const failedJobs = jobs.filter(job => job.status === 'failed')

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    loading,
    error,
    fetchJobs,
    createJob,
    getJob,
    startPolling,
    setError
  }
}

// Hook for managing generated meals from a specific job
export function useGeneratedMeals(jobId: string | null) {
  const [meals, setMeals] = useState<any[]>([])
  const [groupedMeals, setGroupedMeals] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCount, setSelectedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch meals for a job
  const fetchMeals = useCallback(async (selectedOnly = false) => {
    if (!jobId) return

    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (selectedOnly) {
        params.set('selectedOnly', 'true')
      }

      const response = await fetch(`/api/meal-generation/jobs/${jobId}/meals?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch meals')
      }

      const data = await response.json()
      setMeals(data.meals || [])
      setGroupedMeals(data.groupedMeals || {})
      setSelectedCount(data.selectedMeals || 0)
      setTotalCount(data.totalMeals || 0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching meals:', err)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  // Update meal selection
  const updateMealSelection = useCallback(async (mealId: string, selected: boolean) => {
    if (!jobId) return

    try {
      setError(null)
      
      const response = await fetch(`/api/meal-generation/jobs/${jobId}/meals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mealId, selected }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update meal selection')
      }

      // Refresh meals
      await fetchMeals()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error updating meal selection:', err)
    }
  }, [jobId, fetchMeals])

  // Bulk update meal selections
  const updateMealSelections = useCallback(async (mealIds: string[]) => {
    if (!jobId) return

    try {
      setError(null)
      
      const response = await fetch(`/api/meal-generation/jobs/${jobId}/meals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mealIds }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update meal selections')
      }

      // Refresh meals
      await fetchMeals()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error updating meal selections:', err)
    }
  }, [jobId, fetchMeals])

  // Load meals when jobId changes
  useEffect(() => {
    if (jobId) {
      fetchMeals()
    }
  }, [jobId, fetchMeals])

  return {
    meals,
    groupedMeals,
    selectedCount,
    totalCount,
    loading,
    error,
    fetchMeals,
    updateMealSelection,
    updateMealSelections,
    setError
  }
}