import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import MealCard from '../MealCard'
import { StoredGeneratedMeal } from '@/lib/mockStorage'

// Mock meal data
const mockMeal: StoredGeneratedMeal = {
  id: 'meal-1',
  plan_id: 'plan-1',
  group_id: 'group-1',
  title: 'Spaghetti Bolognese',
  description: 'Classic Italian pasta dish with meat sauce',
  prep_time: 15,
  cook_time: 30,
  total_time: 45,
  servings: 4,
  selected: false,
  ingredients: [
    {
      name: 'Ground beef',
      amount: 1,
      unit: 'lb',
      category: 'protein'
    },
    {
      name: 'Spaghetti pasta',
      amount: 1,
      unit: 'lb',
      category: 'grains'
    }
  ],
  instructions: [
    'Heat oil in a large pan',
    'Brown the ground beef',
    'Add tomato sauce and simmer',
    'Cook pasta according to package directions',
    'Serve pasta with sauce'
  ],
  tags: ['dinner', 'family-friendly'],
  dietary_info: ['gluten-free'],
  difficulty: 'easy' as const,
  created_at: '2025-08-10T12:00:00Z'
}

describe('MealCard Component', () => {
  it('renders without crashing', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
    expect(screen.getByText('Classic Italian pasta dish with meat sauce')).toBeInTheDocument()
  })

  it('displays meal timing information correctly', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText(/Prep: 15min/)).toBeInTheDocument()
    expect(screen.getByText(/Cook: 30min/)).toBeInTheDocument()
    expect(screen.getByText(/Total: 45min/)).toBeInTheDocument()
  })

  it('shows ingredients list', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText(/Ground beef/)).toBeInTheDocument()
    expect(screen.getByText(/Spaghetti pasta/)).toBeInTheDocument()
  })

  it('displays dietary info and tags', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText('gluten-free')).toBeInTheDocument()
    expect(screen.getByText('dinner')).toBeInTheDocument()
    expect(screen.getByText('family-friendly')).toBeInTheDocument()
  })

  it('handles selection when showSelection is true', () => {
    const mockOnSelect = jest.fn()
    
    render(
      <MealCard 
        meal={mockMeal}
        onSelect={mockOnSelect}
        showSelection={true}
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(mockOnSelect).toHaveBeenCalledWith('meal-1', true)
  })

  it('reflects selected state in UI', () => {
    const selectedMeal = { ...mockMeal, selected: true }
    
    render(
      <MealCard 
        meal={selectedMeal}
        showSelection={true}
      />
    )
    
    // Should have selected styling
    const card = screen.getByText('Spaghetti Bolognese').closest('div')
    expect(card).toHaveClass('border-blue-500', 'bg-blue-50')
  })

  it('renders in compact mode', () => {
    render(
      <MealCard 
        meal={mockMeal}
        compact={true}
        showSelection={false}
      />
    )
    
    expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
    // In compact mode, some elements might be hidden or styled differently
  })

  it('handles missing optional props gracefully', () => {
    render(
      <MealCard meal={mockMeal} />
    )
    
    expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
  })

  it('displays difficulty level', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText('easy')).toBeInTheDocument()
  })

  it('shows servings information', () => {
    render(
      <MealCard 
        meal={mockMeal}
        showSelection={false}
      />
    )
    
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('servings')).toBeInTheDocument()
  })
})