/**
 * TDD Tests for GeneratedMealsView Sharing Features
 * These tests will FAIL initially - this is intentional for TDD Red phase
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GeneratedMealsView from '../GeneratedMealsView'

// Mock auth provider
const mockUser = { id: 'test-user-123', email: 'test@example.com' }
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    error: null
  })
}))

// Mock supabase singleton
const mockJobData = {
  id: 'job-123',
  plan_name: 'Test Plan',
  week_start: '2025-08-17',
  status: 'completed',
  progress: 100,
  current_step: 'completed',
  total_meals_generated: 3,
  created_at: '2025-08-17T00:00:00Z',
  completed_at: '2025-08-17T00:00:00Z'
}

const mockMealsData = [
  {
    id: 'meal-1',
    job_id: 'job-123',
    group_id: 'group-1',
    group_name: 'Test Family',
    title: 'Test Meal',
    description: 'A test meal',
    prep_time: 15,
    cook_time: 20,
    total_time: 35,
    servings: 4,
    ingredients: ['ingredient1', 'ingredient2'],
    instructions: ['step1', 'step2'],
    tags: ['healthy'],
    dietary_info: ['gluten-free'],
    difficulty: 'easy',
    selected: false,
    created_at: '2025-08-17T00:00:00Z'
  }
]

const mockSupabaseClient = {
  from: jest.fn((table) => {
    if (table === 'meal_generation_jobs') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockJobData, error: null }))
          }))
        }))
      }
    } else if (table === 'generated_meals') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockMealsData, error: null }))
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }
    }
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }
  })
}

jest.mock('@/lib/supabase/singleton', () => ({
  getSupabaseClient: () => mockSupabaseClient
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
})

describe('GeneratedMealsView Sharing Features (TDD)', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    ;(navigator.clipboard.writeText as jest.Mock).mockClear()
  })

  describe('Share Button Functionality', () => {
    it('should display share button when user owns the meal plan', async () => {
      render(<GeneratedMealsView jobId="job-123" />)

      // Debug: check what's being rendered
      // screen.debug()

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Should show share button
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    })

    it('should generate shareable link when share button is clicked', async () => {
      // Mock share link generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            share_url: 'https://app.com/shared-meals/abc123xyz789',
            token: 'abc123xyz789',
            job_id: 'job-123',
            created_at: '2025-08-17T00:00:00Z'
          }
        })
      })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      // Click share button to open modal
      const shareButton = screen.getByRole('button', { name: /share/i })
      fireEvent.click(shareButton)

      // Should show share modal
      await waitFor(() => {
        expect(screen.getByText('Share Meal Plan')).toBeInTheDocument()
      })

      // Click "Generate Share Link" button in modal
      const generateButton = screen.getByRole('button', { name: /generate share link/i })
      fireEvent.click(generateButton)

      // Should make API call to generate share link
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/shared-meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: 'job-123' })
        })
      })

      // Should display the generated share URL
      await waitFor(() => {
        expect(screen.getByDisplayValue('https://app.com/shared-meals/abc123xyz789')).toBeInTheDocument()
      })
    })

    it('should copy share link to clipboard', async () => {
      // Mock meal loading and share generation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { job: { id: 'job-123', plan_name: 'Test Plan', status: 'completed' }, meals: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              share_url: 'https://app.com/shared-meals/abc123xyz789',
              token: 'abc123xyz789'
            }
          })
        })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      // Generate share link
      fireEvent.click(screen.getByRole('button', { name: /share/i }))

      await waitFor(() => {
        expect(screen.getByDisplayValue(/shared-meals/)).toBeInTheDocument()
      })

      // Click copy button
      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)

      // Should copy to clipboard
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app.com/shared-meals/abc123xyz789')

      // Should show feedback
      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument()
      })
    })

    it('should handle share link generation errors', async () => {
      // Mock meal loading
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { job: { id: 'job-123', plan_name: 'Test Plan', status: 'completed' }, meals: [] }
        })
      })

      // Mock share generation failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Failed to generate share link'
        })
      })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /share/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to generate share link/i)).toBeInTheDocument()
      })
    })

    it('should show existing share link if one already exists', async () => {
      // Mock meal loading
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { job: { id: 'job-123', plan_name: 'Test Plan', status: 'completed' }, meals: [] }
        })
      })

      // Mock existing share link
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            share_url: 'https://app.com/shared-meals/existing-token-123',
            token: 'existing-token-123',
            is_existing: true
          }
        })
      })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /share/i }))

      await waitFor(() => {
        expect(screen.getByDisplayValue('https://app.com/shared-meals/existing-token-123')).toBeInTheDocument()
      })

      // Should indicate this is an existing link
      expect(screen.getByText(/existing share link/i)).toBeInTheDocument()
    })
  })

  describe('Public Mode Rendering', () => {
    it('should hide share functionality in public mode', async () => {
      // This will FAIL initially because public mode prop doesn't exist yet
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { job: { plan_name: 'Public Plan', status: 'completed' }, meals: [] }
        })
      })

      render(<GeneratedMealsView jobId="job-123" isPublic={true} />)

      await waitFor(() => {
        expect(screen.getByText(/Public Plan/)).toBeInTheDocument()
      })

      // Should not show share button in public mode
      expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/share this meal plan/i)).not.toBeInTheDocument()
    })

    it('should hide user-specific features in public mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Public Plan', status: 'completed' },
            meals: [
              {
                id: 'meal-1',
                title: 'Public Meal',
                group_name: 'Family',
                prep_time: 10,
                cook_time: 15,
                servings: 4,
                difficulty: 'easy',
                ingredients: ['ingredient1'],
                instructions: ['step1'],
                selected: false
              }
            ]
          }
        })
      })

      render(<GeneratedMealsView jobId="job-123" isPublic={true} />)

      await waitFor(() => {
        expect(screen.getByText('Public Meal')).toBeInTheDocument()
      })

      // Should not show selection checkboxes or buttons
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByText(/select/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/save selections/i)).not.toBeInTheDocument()
    })

    it('should display meals in read-only format for public users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            job: { plan_name: 'Public Plan', status: 'completed' },
            meals: [
              {
                id: 'meal-1',
                title: 'Read-Only Meal',
                description: 'A meal for public viewing',
                group_name: 'Family',
                prep_time: 15,
                cook_time: 20,
                total_time: 35,
                servings: 4,
                difficulty: 'medium',
                ingredients: ['chicken', 'vegetables'],
                instructions: ['Cook chicken', 'Add vegetables'],
                tags: ['healthy'],
                dietary_info: ['gluten-free']
              }
            ]
          }
        })
      })

      render(<GeneratedMealsView jobId="job-123" isPublic={true} />)

      await waitFor(() => {
        expect(screen.getByText('Read-Only Meal')).toBeInTheDocument()
      })

      // Should display all meal information
      expect(screen.getByText('A meal for public viewing')).toBeInTheDocument()
      expect(screen.getByText('15 min prep')).toBeInTheDocument()
      expect(screen.getByText('20 min cook')).toBeInTheDocument()
      expect(screen.getByText('4 servings')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('chicken')).toBeInTheDocument()
      expect(screen.getByText('Cook chicken')).toBeInTheDocument()
      expect(screen.getByText('healthy')).toBeInTheDocument()
      expect(screen.getByText('gluten-free')).toBeInTheDocument()
    })
  })

  describe('Share Dialog Features', () => {
    it('should allow setting expiration date for share link', async () => {
      // This will FAIL initially because expiration options don't exist yet
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { job: { id: 'job-123', plan_name: 'Test Plan', status: 'completed' }, meals: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { share_url: 'https://app.com/shared-meals/token123', token: 'token123' }
          })
        })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /share/i }))

      // Should have expiration options
      expect(screen.getByText(/expiration/i)).toBeInTheDocument()
      expect(screen.getByText(/never/i)).toBeInTheDocument()
      expect(screen.getByText(/1 week/i)).toBeInTheDocument()
      expect(screen.getByText(/1 month/i)).toBeInTheDocument()
    })

    it('should show share analytics when available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { job: { id: 'job-123', plan_name: 'Test Plan', status: 'completed' }, meals: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              share_url: 'https://app.com/shared-meals/token123',
              token: 'token123',
              access_count: 15,
              created_at: '2025-08-15T00:00:00Z',
              last_accessed_at: '2025-08-16T12:00:00Z'
            }
          })
        })

      render(<GeneratedMealsView jobId="job-123" />)

      await waitFor(() => {
        expect(screen.getByText(/Test Plan/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /share/i }))

      await waitFor(() => {
        expect(screen.getByText(/15 views/i)).toBeInTheDocument()
        expect(screen.getByText(/created 2 days ago/i)).toBeInTheDocument()
        expect(screen.getByText(/last viewed/i)).toBeInTheDocument()
      })
    })
  })
})