import { renderHook, act, waitFor } from '@testing-library/react'
import { useMealGenerationJobs, useGeneratedMeals } from '../useMealGenerationJobs'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useMealGenerationJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('Dependency Errors', () => {
    test('should handle fetch API not being available', async () => {
      // Simulate missing fetch API
      delete (global as any).fetch

      const { result } = renderHook(() => useMealGenerationJobs())

      await act(async () => {
        try {
          await result.current.createJob({ name: 'Test Plan' })
        } catch (error) {
          expect(error.message).toContain('fetch is not defined')
        }
      })

      // Restore fetch for other tests
      global.fetch = mockFetch
    })

    test('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useMealGenerationJobs())

      await act(async () => {
        await result.current.fetchJobs()
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.jobs).toEqual([])
    })

    test('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      })

      const { result } = renderHook(() => useMealGenerationJobs())

      await act(async () => {
        await result.current.fetchJobs()
      })

      expect(result.current.error).toBe('Invalid JSON')
    })
  })

  describe('API Response Handling', () => {
    test('should handle successful job creation', async () => {
      const mockJobResponse = {
        jobId: 'job-123',
        status: 'pending',
        message: 'Job created successfully'
      }

      const mockJobsResponse = {
        jobs: [{
          id: 'job-123',
          plan_name: 'Test Plan',
          status: 'pending',
          created_at: new Date().toISOString()
        }]
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockJobResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockJobsResponse)
        })

      const { result } = renderHook(() => useMealGenerationJobs())

      let jobResult
      await act(async () => {
        jobResult = await result.current.createJob({ name: 'Test Plan' })
      })

      expect(jobResult).toEqual(mockJobResponse)
      expect(result.current.jobs).toHaveLength(1)
      expect(result.current.jobs[0].id).toBe('job-123')
    })

    test('should handle job creation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid plan data'
        })
      })

      const { result } = renderHook(() => useMealGenerationJobs())

      await act(async () => {
        try {
          await result.current.createJob({ name: '' })
        } catch (error) {
          expect(error.message).toBe('Invalid plan data')
        }
      })

      expect(result.current.error).toBe('Invalid plan data')
    })

    test('should handle polling updates correctly', async () => {
      const initialJob = {
        id: 'job-123',
        plan_name: 'Test Plan',
        status: 'pending',
        progress: 0
      }

      const updatedJob = {
        ...initialJob,
        status: 'processing',
        progress: 50
      }

      const completedJob = {
        ...initialJob,
        status: 'completed',
        progress: 100
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ jobs: [updatedJob] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ jobs: [completedJob] })
        })

      const { result } = renderHook(() => useMealGenerationJobs())

      let onUpdateCalls: any[] = []
      const mockOnUpdate = jest.fn((job) => {
        onUpdateCalls.push(job)
      })

      await act(async () => {
        const stopPolling = result.current.startPolling('job-123', mockOnUpdate)
        
        // Wait for polling to complete
        await new Promise(resolve => setTimeout(resolve, 100))
        
        stopPolling()
      })

      expect(mockOnUpdate).toHaveBeenCalled()
    })
  })

  describe('Job State Management', () => {
    test('should categorize jobs correctly', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'pending', plan_name: 'Plan 1' },
        { id: 'job-2', status: 'processing', plan_name: 'Plan 2' },
        { id: 'job-3', status: 'completed', plan_name: 'Plan 3' },
        { id: 'job-4', status: 'failed', plan_name: 'Plan 4' }
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ jobs: mockJobs })
      })

      const { result } = renderHook(() => useMealGenerationJobs())

      await act(async () => {
        await result.current.fetchJobs()
      })

      expect(result.current.activeJobs).toHaveLength(2) // pending + processing
      expect(result.current.completedJobs).toHaveLength(1)
      expect(result.current.failedJobs).toHaveLength(1)
    })
  })
})

describe('useGeneratedMeals', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('Meal Management', () => {
    test('should fetch meals for a job', async () => {
      const mockMealsResponse = {
        jobId: 'job-123',
        totalMeals: 10,
        selectedMeals: 5,
        groupedMeals: {
          'Group 1': [
            { id: 'meal-1', title: 'Spaghetti', selected: true },
            { id: 'meal-2', title: 'Pizza', selected: false }
          ]
        },
        meals: [
          { id: 'meal-1', title: 'Spaghetti', selected: true },
          { id: 'meal-2', title: 'Pizza', selected: false }
        ]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockMealsResponse)
      })

      const { result } = renderHook(() => useGeneratedMeals('job-123'))

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(2)
        expect(result.current.selectedCount).toBe(5)
        expect(result.current.totalCount).toBe(10)
      })
    })

    test('should handle meal selection updates', async () => {
      const mockUpdateResponse = { success: true }
      const mockRefreshResponse = {
        meals: [
          { id: 'meal-1', title: 'Spaghetti', selected: false }, // Changed selection
          { id: 'meal-2', title: 'Pizza', selected: false }
        ],
        selectedMeals: 0,
        totalMeals: 2
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUpdateResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockRefreshResponse)
        })

      const { result } = renderHook(() => useGeneratedMeals('job-123'))

      await act(async () => {
        await result.current.updateMealSelection('meal-1', false)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/meal-generation/jobs/job-123/meals',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mealId: 'meal-1', selected: false })
        })
      )
    })

    test('should handle bulk meal selection updates', async () => {
      const mockUpdateResponse = { success: true, selectedCount: 3 }
      const mockRefreshResponse = {
        meals: [
          { id: 'meal-1', selected: true },
          { id: 'meal-2', selected: true },
          { id: 'meal-3', selected: true }
        ],
        selectedMeals: 3,
        totalMeals: 5
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUpdateResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockRefreshResponse)
        })

      const { result } = renderHook(() => useGeneratedMeals('job-123'))

      await act(async () => {
        await result.current.updateMealSelections(['meal-1', 'meal-2', 'meal-3'])
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/meal-generation/jobs/job-123/meals',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mealIds: ['meal-1', 'meal-2', 'meal-3'] })
        })
      )
    })
  })

  describe('Error Handling', () => {
    test('should handle missing jobId gracefully', () => {
      const { result } = renderHook(() => useGeneratedMeals(null))

      expect(result.current.meals).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should handle API errors during meal updates', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Job not found'
        })
      })

      const { result } = renderHook(() => useGeneratedMeals('invalid-job'))

      await act(async () => {
        await result.current.updateMealSelection('meal-1', true)
      })

      expect(result.current.error).toBe('Job not found')
    })
  })
})