/**
 * TDD Tests for Public Shared Meals Page
 * These tests will FAIL initially - this is intentional for TDD Red phase
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import SharedMealsPage from '../[token]/page'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'test-token-123' }),
  notFound: jest.fn()
}))

describe('Public Shared Meals Page (TDD)', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('Valid Token Access', () => {
    it('should render shared meals for valid token without requiring authentication', async () => {
      // This will FAIL initially because the page component doesn't exist yet
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: {
              plan_name: 'Family Week Menu',
              week_start: '2025-08-17',
              total_meals_generated: 3
            },
            meals: [
              {
                id: 'meal-1',
                title: 'Grilled Chicken Salad',
                description: 'Fresh and healthy grilled chicken salad',
                group_name: 'Family',
                prep_time: 15,
                cook_time: 20,
                total_time: 35,
                servings: 4,
                difficulty: 'easy',
                ingredients: ['chicken breast', 'mixed greens', 'cherry tomatoes'],
                instructions: ['Grill chicken', 'Prepare salad', 'Combine ingredients'],
                tags: ['healthy', 'protein'],
                dietary_info: ['gluten-free']
              },
              {
                id: 'meal-2',
                title: 'Vegetable Pasta',
                description: 'Colorful vegetable pasta',
                group_name: 'Family',
                prep_time: 10,
                cook_time: 15,
                total_time: 25,
                servings: 6,
                difficulty: 'easy',
                ingredients: ['pasta', 'bell peppers', 'zucchini'],
                instructions: ['Cook pasta', 'Sauté vegetables', 'Mix together'],
                tags: ['vegetarian', 'quick'],
                dietary_info: ['vegetarian']
              }
            ]
          }
        })
      })

      render(<SharedMealsPage />)

      // Should show loading initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Family Week Menu')).toBeInTheDocument()
      })

      // Should display meal details
      expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument()
      expect(screen.getByText('Vegetable Pasta')).toBeInTheDocument()
      expect(screen.getByText('Fresh and healthy grilled chicken salad')).toBeInTheDocument()

      // Should show meal metadata
      expect(screen.getByText('4 servings')).toBeInTheDocument()
      expect(screen.getByText('35 min total')).toBeInTheDocument()
      expect(screen.getByText('Easy')).toBeInTheDocument()

      // Should display ingredients and instructions
      expect(screen.getByText('chicken breast')).toBeInTheDocument()
      expect(screen.getByText('Grill chicken')).toBeInTheDocument()

      // Should show dietary info and tags
      expect(screen.getByText('gluten-free')).toBeInTheDocument()
      expect(screen.getByText('healthy')).toBeInTheDocument()

      // Should make API call with correct token
      expect(mockFetch).toHaveBeenCalledWith('/api/shared-meals?token=test-token-123')
    })

    it('should display week information and meal count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: {
              plan_name: 'Test Plan',
              week_start: '2025-08-17',
              total_meals_generated: 5
            },
            meals: []
          }
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Plan')).toBeInTheDocument()
      })

      expect(screen.getByText(/week of/i)).toBeInTheDocument()
      expect(screen.getByText(/5 meals/i)).toBeInTheDocument()
    })

    it('should group meals by group name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Test Plan', week_start: '2025-08-17' },
            meals: [
              { id: '1', title: 'Meal 1', group_name: 'Family', prep_time: 10, cook_time: 10, servings: 4, difficulty: 'easy', ingredients: [], instructions: [] },
              { id: '2', title: 'Meal 2', group_name: 'Kids', prep_time: 5, cook_time: 5, servings: 2, difficulty: 'easy', ingredients: [], instructions: [] },
              { id: '3', title: 'Meal 3', group_name: 'Family', prep_time: 15, cook_time: 15, servings: 4, difficulty: 'medium', ingredients: [], instructions: [] }
            ]
          }
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText('Family')).toBeInTheDocument()
        expect(screen.getByText('Kids')).toBeInTheDocument()
      })

      // Should show meals grouped under their respective groups
      expect(screen.getByText('Meal 1')).toBeInTheDocument()
      expect(screen.getByText('Meal 2')).toBeInTheDocument()
      expect(screen.getByText('Meal 3')).toBeInTheDocument()
    })
  })

  describe('Invalid Token Handling', () => {
    it('should show error for invalid token', async () => {
      // This will FAIL initially because error handling doesn't exist yet
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid or expired share link'
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired share link/i)).toBeInTheDocument()
      })

      // Should not show loading after error
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    it('should show error for expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          success: false,
          error: 'Share link has expired'
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText(/share link has expired/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText(/failed to load shared meals/i)).toBeInTheDocument()
      })
    })
  })

  describe('Public UI Features', () => {
    it('should not show any user-specific UI elements', async () => {
      // Public page should not have user avatars, settings, or edit buttons
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Test Plan', week_start: '2025-08-17' },
            meals: [
              { id: '1', title: 'Test Meal', group_name: 'Family', prep_time: 10, cook_time: 10, servings: 4, difficulty: 'easy', ingredients: [], instructions: [] }
            ]
          }
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Meal')).toBeInTheDocument()
      })

      // Should not have edit/delete buttons
      expect(screen.queryByText(/edit/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/delete/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/select/i)).not.toBeInTheDocument()
      
      // Should not have user menu or settings
      expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument()
    })

    it('should display a clean read-only interface', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Shared Meals', week_start: '2025-08-17' },
            meals: []
          }
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText('Shared Meals')).toBeInTheDocument()
      })

      // Should have clear indication this is a shared view
      expect(screen.getByText(/shared meal plan/i)).toBeInTheDocument()
    })

    it('should be responsive and work without JavaScript', async () => {
      // The page should render server-side for sharing on social media
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Mobile Test', week_start: '2025-08-17' },
            meals: [
              { id: '1', title: 'Mobile Meal', group_name: 'Family', prep_time: 10, cook_time: 10, servings: 4, difficulty: 'easy', ingredients: [], instructions: [] }
            ]
          }
        })
      })

      render(<SharedMealsPage />)

      await waitFor(() => {
        expect(screen.getByText('Mobile Test')).toBeInTheDocument()
      })

      // Should render core content even without JavaScript interactions
      expect(screen.getByText('Mobile Meal')).toBeInTheDocument()
    })
  })
})