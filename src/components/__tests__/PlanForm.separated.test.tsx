import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanForm from '../PlanForm'
import { PlanData } from '@/lib/planValidation'

// Mock the validation functions
const mockValidatePlan = jest.fn()
jest.mock('@/lib/planValidation', () => ({
  validatePlan: mockValidatePlan,
  COMMON_PLAN_DURATIONS: ['1 week', '2 weeks', '1 month'],
  sanitizePlanName: jest.fn((name: string) => name.trim()),
  GroupMealAssignment: {}
}))

// Mock Supabase - use real database operations
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockGroups,
            error: null
          }))
        }))
      }))
    }))
  }
}))

// Mock the auth provider
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false
  })
}))

// Mock meal generation functions - they should NOT be called in separated workflow
const mockValidatePlanForGeneration = jest.fn()
const mockCreateJob = jest.fn()
jest.mock('@/lib/mealGenerationWorkflow', () => ({
  validatePlanForGeneration: mockValidatePlanForGeneration,
  generateAndStoreMealsForPlan: jest.fn(),
  planHasGeneratedMeals: jest.fn()
}))

jest.mock('@/hooks/useMealGenerationJobs', () => ({
  useMealGenerationJobs: () => ({
    createJob: mockCreateJob,
    getJob: jest.fn(),
    startPolling: jest.fn()
  }),
  useGeneratedMeals: () => ({
    meals: [],
    selectedCount: 0,
    updateMealSelections: jest.fn()
  })
}))

// Mock meal generation progress component
jest.mock('../MealGenerationProgress', () => ({
  __esModule: true,
  default: () => <div data-testid="meal-generation-progress">Progress</div>,
  useMealGenerationProgress: () => ({
    reset: jest.fn(),
    startValidation: jest.fn(),
    startGeneration: jest.fn(),
    updateProgress: jest.fn(),
    complete: jest.fn(),
    setError: jest.fn()
  })
}))

// Mock meal selection view
jest.mock('../MealSelectionView', () => ({
  __esModule: true,
  default: () => <div data-testid="meal-selection-view">Meal Selection</div>
}))

// Mock AI prompt debugger
jest.mock('../AIPromptDebugger', () => ({
  __esModule: true,
  default: () => <div data-testid="ai-prompt-debugger">AI Debugger</div>
}))

// Mock meal generator functions
jest.mock('@/lib/mealGenerator', () => ({
  buildGroupContexts: jest.fn(),
  ChatGPTMealRequest: {},
  CombinedChatGPTMealRequest: {}
}))

// Mock adult equivalent calculation
jest.mock('@/lib/adultEquivalent', () => ({
  calculateAdultEquivalent: jest.fn()
}))

const mockGroups = [
  {
    id: 'group-1',
    name: 'Smith Family',
    adults: 2,
    teens: 1,
    kids: 1,
    toddlers: 0,
    dietary_restrictions: ['vegetarian'],
    user_id: 'user-1',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

describe('PlanForm - Separated Workflow', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })
  })

  describe('Plan Creation Only Mode', () => {
    it('should render form with Save Plan button (not Generate Meals)', async () => {
      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          enableMealGeneration={false}
        />
      )

      // Should show Save Plan button, not Generate Meals
      expect(screen.getByRole('button', { name: /save plan/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /generate meals/i })).not.toBeInTheDocument()
    })

    it('should submit plan data without triggering meal generation', async () => {
      const user = userEvent.setup()

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          enableMealGeneration={false}
        />
      )

      // Fill out plan details
      await user.type(screen.getByLabelText(/plan name/i), 'Test Plan')
      await user.type(screen.getByLabelText(/week start/i), '2024-01-01')
      await user.type(screen.getByLabelText(/notes/i), 'Test notes')

      // Submit the form
      await user.click(screen.getByRole('button', { name: /save plan/i }))

      // Wait for submission
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: '2024-01-01',
          group_meals: [],
          notes: 'Test notes'
        })
      })

      // Meal generation should NOT be triggered
      expect(mockValidatePlanForGeneration).not.toHaveBeenCalled()
      expect(mockCreateJob).not.toHaveBeenCalled()
    })

    it('should only validate plan data (not generation requirements)', async () => {
      const user = userEvent.setup()

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          enableMealGeneration={false}
        />
      )

      await user.type(screen.getByLabelText(/plan name/i), 'Test Plan')
      await user.click(screen.getByRole('button', { name: /save plan/i }))

      await waitFor(() => {
        expect(mockValidatePlan).toHaveBeenCalled()
      })

      // Generation validation should NOT be called
      expect(mockValidatePlanForGeneration).not.toHaveBeenCalled()
    })

    it('should handle validation errors without meal generation context', async () => {
      mockValidatePlan.mockReturnValue({
        isValid: false,
        errors: {
          name: ['Plan name is required'],
          week_start: ['Week start date is required']
        }
      })

      const user = userEvent.setup()

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          enableMealGeneration={false}
        />
      )

      await user.click(screen.getByRole('button', { name: /save plan/i }))

      // Should show validation errors
      expect(screen.getByText(/plan name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/week start date is required/i)).toBeInTheDocument()

      // Should not submit
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Editing Mode', () => {
    const initialData: PlanData = {
      name: 'Existing Plan',
      week_start: '2024-01-01',
      group_meals: [],
      notes: 'Existing notes'
    }

    it('should not show meal generation options when editing', () => {
      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={initialData}
          enableMealGeneration={true}
        />
      )

      // Should show Update Plan button, not Generate Meals
      expect(screen.getByRole('button', { name: /update plan/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /generate meals/i })).not.toBeInTheDocument()
    })

    it('should update existing plan without triggering meal generation', async () => {
      const user = userEvent.setup()

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={initialData}
          enableMealGeneration={true}
        />
      )

      // Modify the plan
      const nameInput = screen.getByDisplayValue('Existing Plan')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Plan')

      await user.click(screen.getByRole('button', { name: /update plan/i }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Updated Plan',
          week_start: '2024-01-01',
          group_meals: [],
          notes: 'Existing notes'
        })
      })

      // Meal generation should not be triggered during edit
      expect(mockCreateJob).not.toHaveBeenCalled()
    })
  })

  describe('Form Reset and Cancel', () => {
    it('should reset form without triggering any generation logic', async () => {
      const user = userEvent.setup()

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          enableMealGeneration={false}
        />
      )

      // Fill form
      await user.type(screen.getByLabelText(/plan name/i), 'Test Plan')
      
      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockCreateJob).not.toHaveBeenCalled()
    })
  })
})

describe('PlanForm - Meal Generation Integration Points', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })
  })

  it('should not expose meal generation functions when disabled', () => {
    render(
      <PlanForm
        onSubmit={() => {}}
        onCancel={() => {}}
        enableMealGeneration={false}
      />
    )

    // Should not render any meal generation UI elements
    expect(screen.queryByTestId('meal-generation-progress')).not.toBeInTheDocument()
    expect(screen.queryByTestId('meal-selection-view')).not.toBeInTheDocument()
    expect(screen.queryByText(/generate meals/i)).not.toBeInTheDocument()
  })

  it('should be ready for separate meal generation workflow', () => {
    // This test verifies the component can be used in a separated workflow
    // where meal generation is triggered independently after plan creation
    
    const mockOnSubmit = jest.fn()
    
    render(
      <PlanForm
        onSubmit={mockOnSubmit}
        onCancel={() => {}}
        enableMealGeneration={false}
      />
    )

    // Component should render successfully without meal generation dependencies
    expect(screen.getByRole('button', { name: /save plan/i })).toBeInTheDocument()
    
    // No meal generation hooks should be active
    expect(mockCreateJob).not.toHaveBeenCalled()
  })
})