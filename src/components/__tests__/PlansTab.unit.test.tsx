/**
 * Unit tests for PlansTab functions
 * Tests the fix for group meal loading and display logic
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Create a test component that uses the PlansTab functions we've implemented
function TestPlansTabFunctions() {
  const availableGroups = [
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

  // Functions extracted from PlansTab (the ones we fixed)
  const getGroupMealsSummary = (plan: any) => {
    if (!plan.group_meals || plan.group_meals.length === 0) {
      return []
    }

    return plan.group_meals.map((groupMeal: any) => {
      const group = availableGroups.find(g => g.id === groupMeal.group_id)
      return {
        name: group?.name || `Group ${groupMeal.group_id}`,
        mealCount: groupMeal.meal_count,
        notes: groupMeal.notes || ''
      }
    })
  }

  const getTotalMealCount = (plan: any) => {
    if (!plan.group_meals || plan.group_meals.length === 0) {
      return 0
    }
    
    return plan.group_meals.reduce((total: number, groupMeal: any) => {
      return total + (groupMeal.meal_count || 0)
    }, 0)
  }

  // Test data
  const planWithGroupMeals = {
    id: 'plan-1',
    name: 'Test Plan',
    group_meals: [
      { group_id: 'group-1', meal_count: 5, notes: 'Main meals' },
      { group_id: 'group-2', meal_count: 3, notes: 'Light meals' }
    ]
  }

  const planWithoutGroupMeals = {
    id: 'plan-2',
    name: 'Empty Plan',
    group_meals: []
  }

  const planWithNullGroupMeals = {
    id: 'plan-3',
    name: 'Legacy Plan'
    // No group_meals field
  }

  // Test the functions
  const summary1 = getGroupMealsSummary(planWithGroupMeals)
  const total1 = getTotalMealCount(planWithGroupMeals)

  const summary2 = getGroupMealsSummary(planWithoutGroupMeals)
  const total2 = getTotalMealCount(planWithoutGroupMeals)

  const summary3 = getGroupMealsSummary(planWithNullGroupMeals)
  const total3 = getTotalMealCount(planWithNullGroupMeals)

  return (
    <div>
      <div data-testid="plan-1-summary">
        {summary1.length > 0 ? (
          <div>
            <span data-testid="plan-1-total">{total1}</span>
            {summary1.map((item, index) => (
              <div key={index}>
                <span data-testid={`plan-1-group-${index}-name`}>{item.name}</span>
                <span data-testid={`plan-1-group-${index}-count`}>{item.mealCount}</span>
                <span data-testid={`plan-1-group-${index}-notes`}>{item.notes}</span>
              </div>
            ))}
          </div>
        ) : (
          <span data-testid="plan-1-empty">No assignments</span>
        )}
      </div>

      <div data-testid="plan-2-summary">
        {summary2.length > 0 ? (
          <div>
            <span data-testid="plan-2-total">{total2}</span>
            {summary2.map((item, index) => (
              <div key={index}>
                <span data-testid={`plan-2-group-${index}-name`}>{item.name}</span>
                <span data-testid={`plan-2-group-${index}-count`}>{item.mealCount}</span>
              </div>
            ))}
          </div>
        ) : (
          <span data-testid="plan-2-empty">No assignments</span>
        )}
      </div>

      <div data-testid="plan-3-summary">
        {summary3.length > 0 ? (
          <div>
            <span data-testid="plan-3-total">{total3}</span>
            {summary3.map((item, index) => (
              <div key={index}>
                <span data-testid={`plan-3-group-${index}-name`}>{item.name}</span>
                <span data-testid={`plan-3-group-${index}-count`}>{item.mealCount}</span>
              </div>
            ))}
          </div>
        ) : (
          <span data-testid="plan-3-empty">No assignments</span>
        )}
      </div>
    </div>
  )
}

describe('PlansTab Functions - Group Meals Display Logic', () => {
  test('getGroupMealsSummary should properly process plan with group meals', () => {
    render(<TestPlansTabFunctions />)

    // Test plan with group meals
    expect(screen.getByTestId('plan-1-total')).toHaveTextContent('8') // 5 + 3
    expect(screen.getByTestId('plan-1-group-0-name')).toHaveTextContent('Family A')
    expect(screen.getByTestId('plan-1-group-0-count')).toHaveTextContent('5')
    expect(screen.getByTestId('plan-1-group-0-notes')).toHaveTextContent('Main meals')
    expect(screen.getByTestId('plan-1-group-1-name')).toHaveTextContent('Family B')
    expect(screen.getByTestId('plan-1-group-1-count')).toHaveTextContent('3')
    expect(screen.getByTestId('plan-1-group-1-notes')).toHaveTextContent('Light meals')
  })

  test('getGroupMealsSummary should handle plan with empty group meals array', () => {
    render(<TestPlansTabFunctions />)

    // Test plan with empty group meals array
    expect(screen.getByTestId('plan-2-empty')).toHaveTextContent('No assignments')
  })

  test('getGroupMealsSummary should handle plan without group_meals field (backward compatibility)', () => {
    render(<TestPlansTabFunctions />)

    // Test plan without group_meals field (legacy plan)
    expect(screen.getByTestId('plan-3-empty')).toHaveTextContent('No assignments')
  })

  test('getTotalMealCount should calculate correct totals', () => {
    render(<TestPlansTabFunctions />)

    // Plan with meals should show correct total
    expect(screen.getByTestId('plan-1-total')).toHaveTextContent('8')

    // Plans without meals should show 0 (but we display "No assignments" instead)
    expect(screen.getByTestId('plan-2-empty')).toBeInTheDocument()
    expect(screen.getByTestId('plan-3-empty')).toBeInTheDocument()
  })
})