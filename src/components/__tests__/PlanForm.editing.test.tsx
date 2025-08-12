/**
 * Unit tests for PlanForm component editing functionality with group meal loading
 * Tests the fix for issue: "when editing the meal plans, the number of plans for each group do not properly load"
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PlanForm from '../PlanForm'
import { PlanData, GroupMealAssignment } from '@/lib/planValidation'
import * as mockStorage from '@/lib/mockStorage'

// Mock the mockStorage module
jest.mock('@/lib/mockStorage', () => ({
  getStoredGroups: jest.fn(),
  StoredGroup: jest.fn()
}))

const mockGetStoredGroups = mockStorage.getStoredGroups as jest.MockedFunction<typeof mockStorage.getStoredGroups>

describe('PlanForm - Editing with Group Meal Loading', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()
  
  // Helper function to get future date for tests
  const getFutureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const sampleGroups = [
    {
      id: 'group-1',
      name: 'Family A',
      adults: 2,
      teens: 1,
      kids: 2,
      toddlers: 0,
      dietary_restrictions: ['vegetarian']
    },
    {
      id: 'group-2', 
      name: 'Family B',
      adults: 1,
      teens: 0,
      kids: 1,
      toddlers: 1,
      dietary_restrictions: []
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStoredGroups.mockReturnValue(sampleGroups)
  })

  describe('Editing existing plans with group_meals data', () => {
    test('should load existing group meal assignments when editing', () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Main family meals' },
          { group_id: 'group-2', meal_count: 3, notes: 'Side meals' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Check that form title shows editing mode
      expect(screen.getByText('Edit Plan')).toBeInTheDocument()

      // Check that existing meal counts are loaded
      const group1MealInput = screen.getByDisplayValue('5')
      const group2MealInput = screen.getByDisplayValue('3')
      
      expect(group1MealInput).toBeInTheDocument()
      expect(group2MealInput).toBeInTheDocument()

      // Check that group notes are loaded
      expect(screen.getByDisplayValue('Main family meals')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Side meals')).toBeInTheDocument()

      // Check total meal count display
      expect(screen.getByText('Total: 8 meals')).toBeInTheDocument()
    })

    test('should preserve existing meal assignments when submitting edited plan', async () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Main family meals' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Update plan name
      const nameInput = screen.getByDisplayValue('Test Plan')
      fireEvent.change(nameInput, { target: { value: 'Updated Plan' } })

      // Submit form
      const submitButton = screen.getByText('Update Plan')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Updated Plan',
          week_start: futureDate,
          notes: 'Test notes',
          group_meals: [
            { group_id: 'group-1', meal_count: 5, notes: 'Main family meals' }
          ]
        })
      })
    })

    test('should allow modifying meal counts during editing', async () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Original notes' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Find meal count input and change it
      const mealInput = screen.getByDisplayValue('5')
      fireEvent.change(mealInput, { target: { value: '7' } })

      // Update group notes
      const notesInput = screen.getByDisplayValue('Original notes')
      fireEvent.change(notesInput, { target: { value: 'Updated notes' } })

      // Submit form
      const submitButton = screen.getByText('Update Plan')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: futureDate,
          notes: 'Test notes',
          group_meals: [
            { group_id: 'group-1', meal_count: 7, notes: 'Updated notes' }
          ]
        })
      })
    })

    test('should handle adding new group assignments during editing', async () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Existing assignment' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Find meal input for group-2 by using a more specific selector
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs).toHaveLength(2) // Should have 2 meal count inputs
      
      const group2MealInput = numberInputs[1] // Second group input (group-2)
      
      // Set meals for group 2 directly
      fireEvent.change(group2MealInput, { target: { value: '3' } })

      // Submit form
      const submitButton = screen.getByText('Update Plan')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: futureDate,
          notes: 'Test notes',
          group_meals: [
            { group_id: 'group-1', meal_count: 5, notes: 'Existing assignment' },
            { group_id: 'group-2', meal_count: 3, notes: undefined }
          ]
        })
      })
    })

    test('should handle removing group assignments during editing', async () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Keep this' },
          { group_id: 'group-2', meal_count: 3, notes: 'Remove this' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Find the second group meal input and set it to 0
      const group2MealInput = screen.getByDisplayValue('3')
      fireEvent.change(group2MealInput, { target: { value: '0' } })

      // Submit form
      const submitButton = screen.getByText('Update Plan')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Plan',
          week_start: futureDate,
          notes: 'Test notes',
          group_meals: [
            { group_id: 'group-1', meal_count: 5, notes: 'Keep this' }
          ]
        })
      })
    })
  })

  describe('Editing plans without group_meals data (backward compatibility)', () => {
    test('should handle editing plans that lack group_meals field', () => {
      const futureDate = getFutureDate()
      // Simulate a plan from database that doesn't have group_meals field
      const existingPlanWithoutGroupMeals = {
        name: 'Legacy Plan',
        week_start: futureDate,
        notes: 'Legacy notes'
        // No group_meals field
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlanWithoutGroupMeals}
        />
      )

      // Should still render form in edit mode
      expect(screen.getByText('Edit Plan')).toBeInTheDocument()

      // Should show groups with 0 meal counts (fallback behavior)
      expect(screen.getByText('Family A')).toBeInTheDocument()
      expect(screen.getByText('Family B')).toBeInTheDocument()
      
      // All meal inputs should start at 0
      const mealInputs = screen.getAllByDisplayValue('0')
      expect(mealInputs).toHaveLength(2) // One for each group
    })

    test('should handle editing plans with undefined group_meals', () => {
      const futureDate = getFutureDate()
      const existingPlan = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: undefined // Explicitly undefined
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Should render without errors
      expect(screen.getByText('Edit Plan')).toBeInTheDocument()
      
      // Should show groups with 0 meal counts
      const mealInputs = screen.getAllByDisplayValue('0')
      expect(mealInputs).toHaveLength(2)
    })

    test('should allow assigning meals to groups when editing legacy plans', async () => {
      const futureDate = getFutureDate()
      const existingPlan = {
        name: 'Legacy Plan',
        week_start: futureDate,
        notes: 'Legacy notes'
        // No group_meals field
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Find first group and assign meals
      const firstMealInput = screen.getAllByDisplayValue('0')[0]
      fireEvent.change(firstMealInput, { target: { value: '4' } })

      // Submit form
      const submitButton = screen.getByText('Update Plan')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Legacy Plan',
          week_start: futureDate,
          notes: 'Legacy notes',
          group_meals: [
            { group_id: 'group-1', meal_count: 4, notes: undefined }
          ]
        })
      })
    })
  })

  describe('Form validation during editing', () => {
    test('should validate meal assignments when editing', async () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 5, notes: 'Valid assignment' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Remove all meal assignments to trigger validation
      const mealInput = screen.getByDisplayValue('5')
      fireEvent.change(mealInput, { target: { value: '0' } })

      // Try to submit - should be disabled due to no meal assignments
      const submitButton = screen.getByText('Update Plan')
      expect(submitButton).toBeDisabled()
    })

    test('should preserve total meal count display during editing', () => {
      const futureDate = getFutureDate()
      const existingPlan: PlanData = {
        name: 'Test Plan',
        week_start: futureDate,
        notes: 'Test notes',
        group_meals: [
          { group_id: 'group-1', meal_count: 3, notes: 'Group 1' },
          { group_id: 'group-2', meal_count: 4, notes: 'Group 2' }
        ]
      }

      render(
        <PlanForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          initialData={existingPlan}
        />
      )

      // Should show correct total
      expect(screen.getByText('Total: 7 meals')).toBeInTheDocument()

      // Change meal count and verify total updates
      const firstMealInput = screen.getByDisplayValue('3')
      fireEvent.change(firstMealInput, { target: { value: '5' } })

      // Total should update to 9 (5 + 4)
      expect(screen.getByText('Total: 9 meals')).toBeInTheDocument()
    })
  })
})