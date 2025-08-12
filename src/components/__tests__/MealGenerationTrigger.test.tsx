import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// This component doesn't exist yet - we'll create it as part of the implementation
// For now, we're defining the expected interface
interface MealGenerationTriggerProps {
  planId: string
  planData: {
    name: string
    week_start: string
    notes?: string
  }
  onGenerationComplete?: (jobId: string) => void
  onError?: (error: string) => void
}

// Mock implementation for testing
const MockMealGenerationTrigger: React.FC<MealGenerationTriggerProps> = ({
  planId,
  planData,
  onGenerationComplete,
  onError
}) => {
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      // Mock API call
      const response = await fetch(`/api/plans/${planId}/generate-meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planData })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start meal generation')
      }
      
      const result = await response.json()
      onGenerationComplete?.(result.jobId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div data-testid="meal-generation-trigger">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        data-testid="generate-meals-btn"
      >
        {isGenerating ? 'Generating Meals...' : 'Generate Meals with AI'}
      </button>
      {error && (
        <div data-testid="generation-error" className="error">
          {error}
        </div>
      )}
    </div>
  )
}

// Mock the API endpoint
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('MealGenerationTrigger', () => {
  const mockPlanData = {
    name: 'Test Plan',
    week_start: '2024-01-01',
    notes: 'Test notes'
  }

  const mockOnGenerationComplete = jest.fn()
  const mockOnError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Successful Generation', () => {
    it('should trigger meal generation for existing plan', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123', status: 'pending' })
      })

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
          onGenerationComplete={mockOnGenerationComplete}
          onError={mockOnError}
        />
      )

      const generateButton = screen.getByTestId('generate-meals-btn')
      expect(generateButton).toHaveTextContent('Generate Meals with AI')

      await user.click(generateButton)

      // Should show loading state
      expect(generateButton).toHaveTextContent('Generating Meals...')
      expect(generateButton).toBeDisabled()

      // Should make API call to correct endpoint
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/plans/plan-123/generate-meals',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planData: mockPlanData })
          }
        )
      })

      // Should call success callback
      await waitFor(() => {
        expect(mockOnGenerationComplete).toHaveBeenCalledWith('job-123')
        expect(mockOnError).not.toHaveBeenCalled()
      })
    })

    it('should handle generation completion callback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-456', status: 'pending' })
      })

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-456"
          planData={mockPlanData}
          onGenerationComplete={mockOnGenerationComplete}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      await waitFor(() => {
        expect(mockOnGenerationComplete).toHaveBeenCalledWith('job-456')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Authentication required' })
      })

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
          onError={mockOnError}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('generation-error')).toHaveTextContent(
          'Failed to start meal generation'
        )
      })

      expect(mockOnError).toHaveBeenCalledWith('Failed to start meal generation')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
          onError={mockOnError}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Network error')
      })
    })

    it('should reset error state on retry', async () => {
      const user = userEvent.setup()

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('generation-error')).toBeInTheDocument()
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-retry', status: 'pending' })
      })

      await user.click(screen.getByTestId('generate-meals-btn'))

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByTestId('generation-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Button States', () => {
    it('should disable button during generation', async () => {
      // Mock a delayed response
      mockFetch.mockImplementationOnce(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ jobId: 'job-123' })
          }), 100)
        )
      )

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
        />
      )

      const button = screen.getByTestId('generate-meals-btn')
      await user.click(button)

      // Button should be disabled and show loading text
      expect(button).toBeDisabled()
      expect(button).toHaveTextContent('Generating Meals...')

      // Wait for completion
      await waitFor(() => {
        expect(button).not.toBeDisabled()
        expect(button).toHaveTextContent('Generate Meals with AI')
      })
    })
  })

  describe('Component Integration', () => {
    it('should work with different plan data structures', async () => {
      const complexPlanData = {
        name: 'Complex Plan',
        week_start: '2024-02-01',
        notes: 'Complex notes with special characters: àáâãäå',
        group_meals: [
          { group_id: 'group-1', meal_count: 7 },
          { group_id: 'group-2', meal_count: 14 }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-complex' })
      })

      const user = userEvent.setup()

      render(
        <MockMealGenerationTrigger
          planId="plan-complex"
          planData={complexPlanData}
          onGenerationComplete={mockOnGenerationComplete}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/plans/plan-complex/generate-meals',
          expect.objectContaining({
            body: JSON.stringify({ planData: complexPlanData })
          })
        )
      })
    })

    it('should handle missing callback functions gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-no-callback' })
      })

      const user = userEvent.setup()

      // Render without callbacks
      render(
        <MockMealGenerationTrigger
          planId="plan-123"
          planData={mockPlanData}
        />
      )

      await user.click(screen.getByTestId('generate-meals-btn'))

      // Should not throw errors
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })
})