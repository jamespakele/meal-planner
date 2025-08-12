import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MealGenerationTrigger from '../MealGenerationTrigger'

// Mock the meal generation service
jest.mock('@/lib/mealGenerationService', () => ({
  generateMealsForPlan: jest.fn(),
}))

// Mock the hooks
jest.mock('@/hooks/useMealGenerationProgress', () => ({
  useMealGenerationProgress: jest.fn(),
}))

import { generateMealsForPlan } from '@/lib/mealGenerationService'
import { useMealGenerationProgress } from '@/hooks/useMealGenerationProgress'

const mockGenerateMealsForPlan = generateMealsForPlan as jest.MockedFunction<typeof generateMealsForPlan>
const mockUseMealGenerationProgress = useMealGenerationProgress as jest.MockedFunction<typeof useMealGenerationProgress>

describe('MealGenerationTrigger', () => {
  const mockPlan = {
    id: 'plan-1',
    name: 'Test Plan',
    week_start: '2025-01-13',
    group_meals: [
      { group_id: 'group-1', meal_count: 7, notes: 'Test notes' }
    ],
    notes: 'Plan notes'
  }

  const defaultProgressHookReturn = {
    progress: 0,
    status: 'idle' as const,
    error: null,
    currentStep: null,
    totalMeals: null,
    startPolling: jest.fn(),
    stopPolling: jest.fn(),
    reset: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMealGenerationProgress.mockReturnValue(defaultProgressHookReturn)
  })

  describe('Initial Render', () => {
    it('renders Generate Meals button with correct styling', () => {
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button', { name: /generate meals/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-green-500', 'hover:bg-green-700', 'text-white')
      expect(button).not.toBeDisabled()
    })

    it('displays plan name in button text', () => {
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText(/generate meals for test plan/i)).toBeInTheDocument()
    })

    it('is disabled when plan has no group meals', () => {
      const emptyPlan = { ...mockPlan, group_meals: [] }
      render(<MealGenerationTrigger plan={emptyPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button', { name: /generate meals/i })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('bg-gray-400', 'cursor-not-allowed')
    })

    it('shows tooltip when disabled', () => {
      const emptyPlan = { ...mockPlan, group_meals: [] }
      render(<MealGenerationTrigger plan={emptyPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText(/assign meals to groups first/i)).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('displays loading state correctly during generation', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
        progress: 30,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('bg-gray-400')
      expect(screen.getByText(/generating meals.../i)).toBeInTheDocument()
      
      // Progress bar should be visible
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '30')
    })

    it('shows spinner during loading', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
        progress: 50,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      // Look for spinning animation class
      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('animate-spin')
    })

    it('displays current step during generation', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
        progress: 60,
        currentStep: 'Generating meals with AI...',
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText('Generating meals with AI...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message when generation fails', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'failed',
        error: 'Failed to generate meals: API error',
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText(/failed to generate meals: api error/i)).toBeInTheDocument()
      
      const button = screen.getByRole('button', { name: /try again/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-red-500', 'hover:bg-red-600')
    })

    it('allows retry after failure', async () => {
      const mockReset = jest.fn()
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'failed',
        error: 'Network error',
        reset: mockReset,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const retryButton = screen.getByRole('button', { name: /try again/i })
      fireEvent.click(retryButton)
      
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('Success State', () => {
    it('displays success message when generation completes', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'completed',
        progress: 100,
        totalMeals: 21,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText(/21 meals generated successfully!/i)).toBeInTheDocument()
      expect(screen.getByText(/✓/)).toBeInTheDocument()
    })

    it('calls onSuccess callback when generation completes', () => {
      const mockOnSuccess = jest.fn()
      
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'completed',
        progress: 100,
        totalMeals: 21,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={mockOnSuccess} />)
      
      expect(mockOnSuccess).toHaveBeenCalledWith(mockPlan.id, 21)
    })

    it('shows generate again button after success', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'completed',
        progress: 100,
        totalMeals: 21,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const generateAgainButton = screen.getByRole('button', { name: /generate again/i })
      expect(generateAgainButton).toBeInTheDocument()
      expect(generateAgainButton).toHaveClass('bg-blue-500', 'hover:bg-blue-600')
    })
  })

  describe('Button Interactions', () => {
    it('triggers meal generation when clicked', async () => {
      mockGenerateMealsForPlan.mockResolvedValue({ jobId: 'job-123' })
      
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button', { name: /generate meals/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(mockGenerateMealsForPlan).toHaveBeenCalledWith(mockPlan.id, mockPlan)
      })
      
      expect(defaultProgressHookReturn.startPolling).toHaveBeenCalledWith('job-123')
    })

    it('handles generation service errors gracefully', async () => {
      mockGenerateMealsForPlan.mockRejectedValue(new Error('Service unavailable'))
      
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button', { name: /generate meals/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to start meal generation/i)).toBeInTheDocument()
      })
    })

    it('prevents multiple simultaneous generation requests', async () => {
      mockGenerateMealsForPlan.mockResolvedValue({ jobId: 'job-123' })
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
      })
      
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      
      fireEvent.click(button)
      expect(mockGenerateMealsForPlan).not.toHaveBeenCalled()
    })
  })

  describe('Progress Tracking', () => {
    it('initializes progress tracking hook with correct parameters', () => {
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      expect(mockUseMealGenerationProgress).toHaveBeenCalledWith({
        autoStart: false,
        onComplete: expect.any(Function),
        onError: expect.any(Function),
      })
    })

    it('stops polling when component unmounts', () => {
      const { unmount } = render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      unmount()
      
      expect(defaultProgressHookReturn.stopPolling).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button', { name: /generate meals for test plan/i })
      expect(button).toHaveAttribute('aria-describedby')
    })

    it('progress bar has correct ARIA attributes', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
        progress: 45,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '45')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('provides screen reader feedback for status changes', () => {
      mockUseMealGenerationProgress.mockReturnValue({
        ...defaultProgressHookReturn,
        status: 'processing',
        progress: 75,
      })

      render(<MealGenerationTrigger plan={mockPlan} onSuccess={jest.fn()} />)
      
      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toBeInTheDocument()
      expect(statusRegion).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Edge Cases', () => {
    it('handles undefined plan gracefully', () => {
      render(<MealGenerationTrigger plan={undefined as any} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(screen.getByText(/no plan selected/i)).toBeInTheDocument()
    })

    it('handles plan with invalid group_meals structure', () => {
      const invalidPlan = { ...mockPlan, group_meals: null as any }
      render(<MealGenerationTrigger plan={invalidPlan} onSuccess={jest.fn()} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('displays appropriate message for plans with zero total meals', () => {
      const zeroPlan = {
        ...mockPlan,
        group_meals: [
          { group_id: 'group-1', meal_count: 0, notes: '' }
        ]
      }
      render(<MealGenerationTrigger plan={zeroPlan} onSuccess={jest.fn()} />)
      
      expect(screen.getByText(/no meals requested/i)).toBeInTheDocument()
    })
  })
})