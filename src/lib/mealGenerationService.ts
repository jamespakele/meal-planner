/**
 * Meal Generation Service
 * Frontend service to coordinate meal generation with the backend API
 */

export interface MealGenerationRequest {
  name: string
  week_start: string
  notes?: string
  group_meals: Array<{
    group_id: string
    meal_count: number
    notes?: string
  }>
}

export interface MealGenerationResponse {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  planId?: string
}

export interface MealGenerationStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  current_step?: string
  total_meals_generated?: number
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

/**
 * Initiates meal generation for a specific plan
 */
export async function generateMealsForPlan(
  planId: string, 
  planData: MealGenerationRequest
): Promise<MealGenerationResponse> {
  try {
    const response = await fetch(`/api/plans/${planId}/generate-meals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planData),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.error || 'Unknown error'
      const errorDetails = data.details

      if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0) {
        throw new Error(`${errorMessage}: ${errorDetails.join(', ')}`)
      }

      throw new Error(errorMessage)
    }

    if (!data) {
      throw new Error('Empty response from server')
    }

    return data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to start meal generation')
  }
}

/**
 * Gets the current status of a meal generation job
 */
export async function getMealGenerationStatus(jobId: string): Promise<MealGenerationStatus | null> {
  try {
    const response = await fetch(`/api/meal-generation/jobs?jobId=${jobId}`)
    
    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.error || 'Unknown error'
      throw new Error(errorMessage)
    }

    if (!data || !data.jobs) {
      throw new Error('Invalid response structure')
    }

    const jobs = data.jobs
    if (jobs.length === 0) {
      return null
    }

    return jobs[0]
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to check meal generation status')
  }
}

/**
 * Cancels a meal generation job
 */
export async function cancelMealGeneration(jobId: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch(`/api/meal-generation/jobs/${jobId}/cancel`, {
      method: 'POST',
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.error || 'Unknown error'
      throw new Error(errorMessage)
    }

    return data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to cancel meal generation')
  }
}

/**
 * Polls for meal generation status updates
 */
export class MealGenerationPoller {
  private jobId: string
  private intervalId: NodeJS.Timeout | null = null
  private onUpdate: (status: MealGenerationStatus) => void
  private onComplete: (status: MealGenerationStatus) => void
  private onError: (error: string) => void
  private pollingInterval: number

  constructor(
    jobId: string,
    options: {
      onUpdate: (status: MealGenerationStatus) => void
      onComplete: (status: MealGenerationStatus) => void
      onError: (error: string) => void
      pollingInterval?: number
    }
  ) {
    this.jobId = jobId
    this.onUpdate = options.onUpdate
    this.onComplete = options.onComplete
    this.onError = options.onError
    this.pollingInterval = options.pollingInterval || 2000 // Default 2 seconds
  }

  start() {
    if (this.intervalId) {
      return // Already started
    }

    // Initial check
    this.checkStatus()

    // Set up polling
    this.intervalId = setInterval(() => {
      this.checkStatus()
    }, this.pollingInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async checkStatus() {
    try {
      const status = await getMealGenerationStatus(this.jobId)
      
      if (!status) {
        this.onError('Job not found')
        this.stop()
        return
      }

      this.onUpdate(status)

      if (status.status === 'completed') {
        this.onComplete(status)
        this.stop()
      } else if (status.status === 'failed') {
        this.onError(status.error_message || 'Job failed')
        this.stop()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.onError(errorMessage)
      this.stop()
    }
  }
}

/**
 * Utility function to create and manage a meal generation poller
 */
export function createMealGenerationPoller(
  jobId: string,
  callbacks: {
    onUpdate: (status: MealGenerationStatus) => void
    onComplete: (status: MealGenerationStatus) => void
    onError: (error: string) => void
    pollingInterval?: number
  }
): MealGenerationPoller {
  return new MealGenerationPoller(jobId, callbacks)
}

/**
 * Helper function to format meal generation status for display
 */
export function formatMealGenerationStatus(status: MealGenerationStatus): {
  displayStatus: string
  displayStep: string
  isComplete: boolean
  isError: boolean
  progressPercentage: number
} {
  const displayStatus = status.status.charAt(0).toUpperCase() + status.status.slice(1)
  const displayStep = status.current_step || 'Processing...'
  const isComplete = status.status === 'completed'
  const isError = status.status === 'failed'
  const progressPercentage = Math.round(status.progress || 0)

  return {
    displayStatus,
    displayStep,
    isComplete,
    isError,
    progressPercentage
  }
}

/**
 * Calculate estimated time remaining for meal generation
 * Based on typical generation times and current progress
 */
export function estimateTimeRemaining(status: MealGenerationStatus): {
  estimatedMinutes: number
  displayText: string
} {
  if (status.status === 'completed' || status.status === 'failed') {
    return { estimatedMinutes: 0, displayText: 'Complete' }
  }

  // Base estimates (in minutes) for different stages
  const stageEstimates: Record<string, number> = {
    'Preparing AI request...': 0.5,
    'Generating meals with AI...': 3,
    'Saving generated meals...': 1,
    'Completed': 0
  }

  const currentStage = status.current_step || 'Processing...'
  const progress = Math.max(status.progress || 0, 1) // Avoid division by zero
  
  // Estimate based on current stage
  let baseEstimate = stageEstimates[currentStage] || 2
  
  // Adjust based on progress
  const remainingProgress = (100 - progress) / 100
  const estimatedMinutes = Math.round(baseEstimate * remainingProgress)

  let displayText: string
  if (estimatedMinutes < 1) {
    displayText = 'Less than 1 minute'
  } else if (estimatedMinutes === 1) {
    displayText = '1 minute'
  } else {
    displayText = `${estimatedMinutes} minutes`
  }

  return { estimatedMinutes, displayText }
}