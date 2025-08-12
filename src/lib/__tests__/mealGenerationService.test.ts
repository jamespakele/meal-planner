import { generateMealsForPlan, getMealGenerationStatus, cancelMealGeneration } from '../mealGenerationService'

// Mock global fetch
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('mealGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateMealsForPlan', () => {
    const mockPlanId = 'plan-123'
    const mockPlanData = {
      name: 'Test Plan',
      week_start: '2025-01-13',
      notes: 'Test notes',
      group_meals: [
        { group_id: 'group-1', meal_count: 7, notes: 'Family meals' }
      ]
    }

    it('successfully initiates meal generation', async () => {
      const mockResponse = {
        jobId: 'job-456',
        status: 'pending',
        message: 'Meal generation job created successfully',
        planId: mockPlanId
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await generateMealsForPlan(mockPlanId, mockPlanData)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/plans/${mockPlanId}/generate-meals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockPlanData),
        }
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles API errors gracefully', async () => {
      const mockErrorResponse = {
        error: 'Plan not found or access denied',
        details: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response)

      await expect(generateMealsForPlan(mockPlanId, mockPlanData))
        .rejects.toThrow('Plan not found or access denied')

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/plans/${mockPlanId}/generate-meals`,
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(generateMealsForPlan(mockPlanId, mockPlanData))
        .rejects.toThrow('Network error')
    })

    it('handles authentication errors', async () => {
      const mockErrorResponse = {
        error: 'Authentication required'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response)

      await expect(generateMealsForPlan(mockPlanId, mockPlanData))
        .rejects.toThrow('Authentication required')
    })

    it('handles validation errors with details', async () => {
      const mockErrorResponse = {
        error: 'Invalid plan data for generation',
        details: ['Name is required', 'Week start is invalid']
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response)

      await expect(generateMealsForPlan(mockPlanId, mockPlanData))
        .rejects.toThrow('Invalid plan data for generation: Name is required, Week start is invalid')
    })

    it('includes all required plan data in request', async () => {
      const complexPlanData = {
        name: 'Complex Plan',
        week_start: '2025-01-20',
        notes: 'Complex notes with special characters: àáâãäå',
        group_meals: [
          { group_id: 'group-1', meal_count: 7, notes: 'Breakfast meals' },
          { group_id: 'group-2', meal_count: 14, notes: 'All meals' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-complex', status: 'pending' }),
      } as Response)

      await generateMealsForPlan(mockPlanId, complexPlanData)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/plans/${mockPlanId}/generate-meals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(complexPlanData),
        }
      )
    })

    it('handles empty response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response)

      await expect(generateMealsForPlan(mockPlanId, mockPlanData))
        .rejects.toThrow('Empty response from server')
    })
  })

  describe('getMealGenerationStatus', () => {
    const mockJobId = 'job-456'

    it('successfully fetches job status', async () => {
      const mockStatusResponse = {
        jobs: [
          {
            id: mockJobId,
            status: 'processing',
            progress: 45,
            current_step: 'Generating meals with AI...',
            total_meals_generated: 0,
            created_at: '2025-01-13T10:00:00.000Z',
            started_at: '2025-01-13T10:00:01.000Z',
            completed_at: null
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatusResponse),
      } as Response)

      const result = await getMealGenerationStatus(mockJobId)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/meal-generation/jobs?jobId=${mockJobId}`
      )

      expect(result).toEqual(mockStatusResponse.jobs[0])
    })

    it('handles job not found', async () => {
      const mockStatusResponse = {
        jobs: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatusResponse),
      } as Response)

      const result = await getMealGenerationStatus(mockJobId)

      expect(result).toBeNull()
    })

    it('handles API errors for status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      } as Response)

      await expect(getMealGenerationStatus(mockJobId))
        .rejects.toThrow('Internal server error')
    })

    it('handles network errors for status check', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'))

      await expect(getMealGenerationStatus(mockJobId))
        .rejects.toThrow('Connection timeout')
    })

    it('handles malformed response data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalidStructure: true }),
      } as Response)

      await expect(getMealGenerationStatus(mockJobId))
        .rejects.toThrow('Invalid response structure')
    })
  })

  describe('cancelMealGeneration', () => {
    const mockJobId = 'job-789'

    it('successfully cancels meal generation job', async () => {
      const mockCancelResponse = {
        success: true,
        message: 'Job cancelled successfully'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCancelResponse),
      } as Response)

      const result = await cancelMealGeneration(mockJobId)

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/meal-generation/jobs/${mockJobId}/cancel`,
        {
          method: 'POST',
        }
      )

      expect(result).toEqual(mockCancelResponse)
    })

    it('handles cancellation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Job cannot be cancelled' }),
      } as Response)

      await expect(cancelMealGeneration(mockJobId))
        .rejects.toThrow('Job cannot be cancelled')
    })

    it('handles job not found for cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Job not found' }),
      } as Response)

      await expect(cancelMealGeneration(mockJobId))
        .rejects.toThrow('Job not found')
    })
  })

  describe('Error handling and resilience', () => {
    it('handles JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response)

      await expect(generateMealsForPlan('plan-123', {
        name: 'Test',
        week_start: '2025-01-13',
        notes: '',
        group_meals: []
      })).rejects.toThrow('Invalid JSON')
    })

    it('handles response without ok status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve({}),
      } as Response)

      await expect(generateMealsForPlan('plan-123', {
        name: 'Test',
        week_start: '2025-01-13',
        notes: '',
        group_meals: []
      })).rejects.toThrow('Unknown error')
    })

    it('handles fetch throwing an error', async () => {
      mockFetch.mockImplementationOnce(() => {
        throw new Error('Fetch failed')
      })

      await expect(generateMealsForPlan('plan-123', {
        name: 'Test',
        week_start: '2025-01-13',
        notes: '',
        group_meals: []
      })).rejects.toThrow('Fetch failed')
    })
  })

  describe('Request formatting', () => {
    it('properly encodes special characters in plan data', async () => {
      const planWithSpecialChars = {
        name: 'Plan with émojis 🍕 and spëcial chars',
        week_start: '2025-01-13',
        notes: 'Notes with "quotes" and <tags>',
        group_meals: [
          { group_id: 'group-1', meal_count: 7, notes: 'Café & Restaurant meals' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-special', status: 'pending' }),
      } as Response)

      await generateMealsForPlan('plan-123', planWithSpecialChars)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(planWithSpecialChars),
        })
      )
    })

    it('handles undefined and null values in plan data', async () => {
      const planWithNulls = {
        name: 'Test Plan',
        week_start: '2025-01-13',
        notes: null as any,
        group_meals: [
          { group_id: 'group-1', meal_count: 7, notes: undefined as any }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-nulls', status: 'pending' }),
      } as Response)

      await generateMealsForPlan('plan-123', planWithNulls)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(planWithNulls),
        })
      )
    })
  })

  describe('Concurrent requests', () => {
    it('handles multiple simultaneous generation requests', async () => {
      const planData1 = { name: 'Plan 1', week_start: '2025-01-13', notes: '', group_meals: [] }
      const planData2 = { name: 'Plan 2', week_start: '2025-01-20', notes: '', group_meals: [] }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-1', status: 'pending' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-2', status: 'pending' }),
        } as Response)

      const [result1, result2] = await Promise.all([
        generateMealsForPlan('plan-1', planData1),
        generateMealsForPlan('plan-2', planData2)
      ])

      expect(result1.jobId).toBe('job-1')
      expect(result2.jobId).toBe('job-2')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('handles partial failures in concurrent requests', async () => {
      const planData1 = { name: 'Plan 1', week_start: '2025-01-13', notes: '', group_meals: [] }
      const planData2 = { name: 'Plan 2', week_start: '2025-01-20', notes: '', group_meals: [] }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-1', status: 'pending' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Invalid plan data' }),
        } as Response)

      const results = await Promise.allSettled([
        generateMealsForPlan('plan-1', planData1),
        generateMealsForPlan('plan-2', planData2)
      ])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.jobId).toBe('job-1')
      }
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toBe('Invalid plan data')
      }
    })
  })
})