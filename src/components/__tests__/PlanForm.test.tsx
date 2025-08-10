import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanForm from '../PlanForm'
import { PlanData } from '@/lib/planValidation'

// Mock the validation functions
jest.mock('@/lib/planValidation', () => ({
  validatePlan: jest.fn(),
  COMMON_PLAN_DURATIONS: ['1 week', '2 weeks', '1 month'],
  sanitizePlanName: jest.fn((name: string) => name.trim()),
  GroupMealAssignment: {}
}))

// Mock the group storage functions
jest.mock('@/lib/mockStorage', () => ({
  getStoredGroups: jest.fn()
}))

const mockValidatePlan = require('@/lib/planValidation').validatePlan
const mockGetStoredGroups = require('@/lib/mockStorage').getStoredGroups

describe('PlanForm', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()
  
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
    },
    {
      id: 'group-2',
      name: 'Johnson Family',
      adults: 2,
      teens: 0,
      kids: 2,
      toddlers: 1,
      dietary_restrictions: ['gluten-free'],
      user_id: 'user-1',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    // Default valid validation
    mockValidatePlan.mockReturnValue({ isValid: true, errors: {} })
    // Default available groups
    mockGetStoredGroups.mockReturnValue(mockGroups)
  })

  describe('form rendering', () => {
    it('should render all form fields for creating new plan', () => {
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByText('Create New Plan')).toBeInTheDocument()
      expect(screen.getByLabelText('Plan Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Week Start Date')).toBeInTheDocument()
      expect(screen.getByText('Assign Meals to Groups')).toBeInTheDocument()
      expect(screen.getByLabelText('Notes (Optional)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('should render form fields for editing existing plan', () => {
      const initialData: PlanData = {
        name: 'Weekly Plan',
        week_start: '2024-12-01',
        group_meals: [
          { group_id: 'group-1', meal_count: 3, notes: 'Family meals' }
        ],
        notes: 'Test notes'
      }
      
      render(
        <PlanForm 
          onSubmit={mockOnSubmit} 
          onCancel={mockOnCancel} 
          initialData={initialData}
        />
      )
      
      expect(screen.getByText('Edit Plan')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Weekly Plan')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2024-12-01')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Update Plan' })).toBeInTheDocument()
    })

    it('should display available groups with meal count controls', () => {
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByText('Smith Family')).toBeInTheDocument()
      expect(screen.getByText('Johnson Family')).toBeInTheDocument()
      expect(screen.getByText('2 adults, 1 teens, 1 kids, 0 toddlers')).toBeInTheDocument()
      expect(screen.getByText('2 adults, 0 teens, 2 kids, 1 toddlers')).toBeInTheDocument()
      expect(screen.getByText('vegetarian')).toBeInTheDocument()
      expect(screen.getByText('gluten-free')).toBeInTheDocument()
      
      // Should show meal count controls for each group
      expect(screen.getAllByText('Meals:')).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: '−' })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: '+' })).toHaveLength(2)
    })

    it('should show message when no groups available', () => {
      mockGetStoredGroups.mockReturnValue([])
      
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      expect(screen.getByText('No groups available. Please create a group first.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Plan' })).toBeDisabled()
    })
  })

  describe('form interaction', () => {
    it('should update plan name field', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const nameInput = screen.getByLabelText('Plan Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'My New Plan')
      
      expect(nameInput).toHaveValue('My New Plan')
    })

    it('should update week start date field', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const dateInput = screen.getByLabelText('Week Start Date')
      await user.clear(dateInput)
      await user.type(dateInput, '2024-12-15')
      
      expect(dateInput).toHaveValue('2024-12-15')
    })

    it('should update meal counts using controls', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const mealCountInputs = screen.getAllByRole('spinbutton')
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      const decrementButtons = screen.getAllByRole('button', { name: '−' })
      
      // Initially all meal counts should be 0
      expect(mealCountInputs[0]).toHaveValue(0)
      expect(mealCountInputs[1]).toHaveValue(0)
      
      // Increment first group meal count
      await user.click(incrementButtons[0])
      expect(mealCountInputs[0]).toHaveValue(1)
      
      // Increment second group meal count
      await user.click(incrementButtons[1])
      expect(mealCountInputs[1]).toHaveValue(1)
      
      // Decrement first group back to 0
      await user.click(decrementButtons[0])
      expect(mealCountInputs[0]).toHaveValue(0)
      
      // Type directly in input
      await user.clear(mealCountInputs[1])
      await user.type(mealCountInputs[1], '5')
      expect(mealCountInputs[1]).toHaveValue(5)
    })

    it('should update notes field', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const notesInput = screen.getByLabelText('Notes (Optional)')
      await user.type(notesInput, 'These are my notes')
      
      expect(notesInput).toHaveValue('These are my notes')
    })

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)
      
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('form validation', () => {
    it('should display validation errors', async () => {
      mockValidatePlan.mockReturnValue({
        isValid: false,
        errors: {
          name: ['Name is required'],
          week_start: ['Week start must be a valid date'],
          group_meals: ['At least one group must be assigned meals'],
          notes: ['Notes must be 500 characters or less']
        }
      })
      
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Add at least one meal to enable the submit button
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      await user.click(incrementButtons[0])
      
      const submitButton = screen.getByRole('button', { name: 'Create Plan' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
        expect(screen.getByText('Week start must be a valid date')).toBeInTheDocument()
        expect(screen.getByText('At least one group must be assigned meals')).toBeInTheDocument()
        expect(screen.getByText('Notes must be 500 characters or less')).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should clear field error when user starts typing', async () => {
      // First render with errors
      mockValidatePlan.mockReturnValue({
        isValid: false,
        errors: {
          name: ['Name is required']
        }
      })
      
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Add at least one meal to enable the submit button
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      await user.click(incrementButtons[0])
      
      const submitButton = screen.getByRole('button', { name: 'Create Plan' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })
      
      // Now type in the field - error should clear
      const nameInput = screen.getByLabelText('Plan Name')
      await user.type(nameInput, 'Test Plan')
      
      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('should submit valid form data', async () => {
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill in the form
      await user.type(screen.getByLabelText('Plan Name'), 'Test Plan')
      await user.type(screen.getByLabelText('Week Start Date'), '2024-12-01')
      
      // Assign meals to first group
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      await user.click(incrementButtons[0]) // Set Smith Family to 1 meal
      await user.click(incrementButtons[0]) // Set Smith Family to 2 meals
      
      await user.type(screen.getByLabelText('Notes (Optional)'), 'Test notes')
      
      const submitButton = screen.getByRole('button', { name: 'Create Plan' })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockValidatePlan).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: '2024-12-01',
          group_meals: [{ group_id: 'group-1', meal_count: 2, notes: undefined }],
          notes: 'Test notes'
        })
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: '2024-12-01',
          group_meals: [{ group_id: 'group-1', meal_count: 2, notes: undefined }],
          notes: 'Test notes'
        })
      })
    })

    it('should show loading state during submission', async () => {
      // Make onSubmit return a promise that resolves after delay
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill in the form
      await user.type(screen.getByLabelText('Plan Name'), 'Test Plan')
      await user.type(screen.getByLabelText('Week Start Date'), '2024-12-01')
      
      // Assign meals to first group
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      await user.click(incrementButtons[0])
      
      const submitButton = screen.getByRole('button', { name: 'Create Plan' })
      await user.click(submitButton)
      
      // Should show loading state
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
      
      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument()
      })
    })

    it('should handle submission errors gracefully', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'))
      
      const user = userEvent.setup()
      render(<PlanForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill in the form
      await user.type(screen.getByLabelText('Plan Name'), 'Test Plan')
      await user.type(screen.getByLabelText('Week Start Date'), '2024-12-01')
      
      // Assign meals to first group
      const incrementButtons = screen.getAllByRole('button', { name: '+' })
      await user.click(incrementButtons[0])
      
      const submitButton = screen.getByRole('button', { name: 'Create Plan' })
      await user.click(submitButton)
      
      // Should return to normal state after error
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create Plan' })).not.toBeDisabled()
      })
    })
  })

  describe('initial data handling', () => {
    it('should populate form with initial data when editing', () => {
      const initialData: PlanData = {
        name: 'Existing Plan',
        week_start: '2024-12-01',
        group_meals: [
          { group_id: 'group-1', meal_count: 3, notes: 'Family meals' },
          { group_id: 'group-2', meal_count: 2, notes: 'Special diet' }
        ],
        notes: 'Existing notes'
      }
      
      render(
        <PlanForm 
          onSubmit={mockOnSubmit} 
          onCancel={mockOnCancel} 
          initialData={initialData}
        />
      )
      
      expect(screen.getByDisplayValue('Existing Plan')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2024-12-01')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Existing notes')).toBeInTheDocument()
      
      // Both groups should show their assigned meal counts
      const mealCountInputs = screen.getAllByRole('spinbutton')
      expect(mealCountInputs[0]).toHaveValue(3) // Smith Family
      expect(mealCountInputs[1]).toHaveValue(2) // Johnson Family
      
      // Should show group-specific notes
      expect(screen.getByDisplayValue('Family meals')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Special diet')).toBeInTheDocument()
      
      // Should show total meal count
      expect(screen.getByText('Total: 5 meals')).toBeInTheDocument()
    })

    it('should handle missing optional fields in initial data', () => {
      const initialData: PlanData = {
        name: 'Minimal Plan',
        week_start: '2024-12-01',
        group_meals: [
          { group_id: 'group-1', meal_count: 1 }
          // notes is optional in group meals
        ]
        // notes is optional and not provided
      }
      
      render(
        <PlanForm 
          onSubmit={mockOnSubmit} 
          onCancel={mockOnCancel} 
          initialData={initialData}
        />
      )
      
      expect(screen.getByDisplayValue('Minimal Plan')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2024-12-01')).toBeInTheDocument()
      expect(screen.getByLabelText('Notes (Optional)')).toHaveValue('')
      
      // Should show 1 meal assigned to first group
      const mealCountInputs = screen.getAllByRole('spinbutton')
      expect(mealCountInputs[0]).toHaveValue(1)
      expect(mealCountInputs[1]).toHaveValue(0)
    })
  })
})