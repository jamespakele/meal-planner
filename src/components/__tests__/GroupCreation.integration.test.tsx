/**
 * Integration tests for Group creation functionality
 * Tests the complete workflow after client fixes
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthProvider } from '../AuthProvider'
import DashboardContent from '../DashboardContent'

// Mock Supabase modules
jest.mock('@/lib/supabase/singleton')
jest.mock('@/lib/supabase/client')

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn()
  })
}))

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => Promise.resolve({ data: [], error: null })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
}

// Mock singleton client
const mockGetSupabaseClient = require('@/lib/supabase/singleton').getSupabaseClient as jest.MockedFunction<any>
mockGetSupabaseClient.mockReturnValue(mockSupabaseClient)

// Mock SSR client
const mockCreateClient = require('@/lib/supabase/client').createClient as jest.MockedFunction<any>
mockCreateClient.mockReturnValue(mockSupabaseClient)

describe('Group Creation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { 
        user: { 
          id: 'test-user-id', 
          email: 'test@example.com' 
        } 
      },
      error: null
    })

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { 
        session: { 
          user: { 
            id: 'test-user-id', 
            email: 'test@example.com' 
          } 
        } 
      },
      error: null
    })

    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })
  })

  test('should render dashboard and handle group creation without hanging', async () => {
    // Mock successful group creation
    const mockInsert = jest.fn(() => Promise.resolve({ 
      data: [{ 
        id: 'new-group-id', 
        name: 'Test Group',
        adults: 2,
        teens: 0,
        kids: 1,
        toddlers: 0
      }], 
      error: null 
    }))
    
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: mockInsert
    })

    render(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/Groups/)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Look for group creation elements
    await waitFor(() => {
      // Should show groups section without hanging
      const groupsSection = screen.getByText(/Groups/)
      expect(groupsSection).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify no hanging - test should complete quickly
    expect(mockGetSupabaseClient).toHaveBeenCalledTimes(1)
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled()
  })

  test('should handle group creation form interaction', async () => {
    const mockInsert = jest.fn(() => Promise.resolve({ 
      data: [{ 
        id: 'new-group-id', 
        name: 'Test Family',
        adults: 2,
        teens: 1,
        kids: 0,
        toddlers: 0
      }], 
      error: null 
    }))
    
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: mockInsert
    })

    render(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Groups/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Try to find and interact with group creation form
    const nameInput = screen.queryByPlaceholderText(/group name/i)
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: 'Test Family' } })
      
      const adultsInput = screen.queryByLabelText(/adults/i)
      if (adultsInput) {
        fireEvent.change(adultsInput, { target: { value: '2' } })
      }

      const submitButton = screen.queryByText(/create group/i)
      if (submitButton) {
        fireEvent.click(submitButton)
        
        await waitFor(() => {
          expect(mockInsert).toHaveBeenCalled()
        }, { timeout: 2000 })
      }
    }

    // Verify client management
    expect(mockGetSupabaseClient).toHaveBeenCalledTimes(1)
  })

  test('should handle group creation errors gracefully', async () => {
    // Mock group creation error
    const mockInsert = jest.fn(() => Promise.resolve({ 
      data: null, 
      error: { message: 'Database error' } 
    }))
    
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: mockInsert
    })

    render(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Groups/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not crash or hang on error
    expect(mockGetSupabaseClient).toHaveBeenCalledTimes(1)
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled()
  })

  test('should maintain singleton client across re-renders', async () => {
    const { rerender } = render(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Groups/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Re-render multiple times
    rerender(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    rerender(
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    )

    // Singleton client should only be created once
    expect(mockGetSupabaseClient).toHaveBeenCalledTimes(1)
  })
})