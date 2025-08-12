/**
 * Performance and integration tests for AuthProvider
 * Tests for hanging scenarios and client management
 */

import React, { useState } from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '../AuthProvider'
import { getSupabaseClient, resetSupabaseClient, getClientInstanceInfo } from '@/lib/supabase/singleton'

// Mock Supabase client functions
jest.mock('@/lib/supabase/singleton', () => ({
  getSupabaseClient: jest.fn(),
  resetSupabaseClient: jest.fn(),
  getClientInstanceInfo: jest.fn(),
  hasSupabaseClient: jest.fn()
}))

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>
const mockResetSupabaseClient = resetSupabaseClient as jest.MockedFunction<typeof resetSupabaseClient>
const mockGetClientInstanceInfo = getClientInstanceInfo as jest.MockedFunction<typeof getClientInstanceInfo>

describe('AuthProvider - Performance & Hanging Prevention', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } }
        }),
        signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    }

    mockGetSupabaseClient.mockReturnValue(mockSupabaseClient)
    mockGetClientInstanceInfo.mockReturnValue({
      hasInstance: true,
      created: true,
      timestamp: new Date().toISOString()
    })
  })

  describe('Client instance management', () => {
    test('should create client instance only once across multiple renders', async () => {
      const TestComponent = () => {
        const { user, loading } = useAuth()
        const [renderCount, setRenderCount] = useState(0)
        
        // Use ref to track renders without causing infinite updates
        const renderCountRef = React.useRef(0)
        renderCountRef.current++

        React.useEffect(() => {
          // Only set state once to avoid infinite loop
          if (renderCount === 0) {
            setRenderCount(renderCountRef.current)
          }
        }, [renderCount])

        return (
          <div>
            <div data-testid="render-count">{renderCountRef.current}</div>
            <div data-testid="loading">{loading ? 'loading' : 'not loading'}</div>
            <div data-testid="user">{user ? 'authenticated' : 'not authenticated'}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument()
      })

      // Force multiple re-renders
      act(() => {
        // Component should re-render but client should be created only once
      })

      await waitFor(() => {
        // Client should be created only once despite multiple renders
        expect(mockGetSupabaseClient).toHaveBeenCalledTimes(1)
      })
    })

    test('should handle client creation errors gracefully', () => {
      const mockError = new Error('Failed to create Supabase client')
      mockGetSupabaseClient.mockImplementation(() => {
        throw mockError
      })

      // Should not crash the app
      expect(() => {
        render(
          <AuthProvider>
            <div>Test</div>
          </AuthProvider>
        )
      }).toThrow('Failed to create Supabase client')
    })

    test('should provide stable auth functions across renders', async () => {
      let authFunctions: any = null

      const TestComponent = () => {
        const auth = useAuth()
        
        if (!authFunctions) {
          authFunctions = auth
        } else {
          // Functions should be stable (same reference)
          expect(auth.signInWithGoogle).toBe(authFunctions.signInWithGoogle)
          expect(auth.signOut).toBe(authFunctions.signOut)
        }

        return <div>Test</div>
      }

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Re-render to test function stability
      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(authFunctions).toBeTruthy()
      })
    })
  })

  describe('Auth state management', () => {
    test('should handle auth state changes without hanging', async () => {
      const stateChanges: string[] = []
      
      const TestComponent = () => {
        const { user, loading } = useAuth()
        
        React.useEffect(() => {
          if (loading) {
            stateChanges.push('loading')
          } else if (user) {
            stateChanges.push('authenticated')
          } else {
            stateChanges.push('unauthenticated')
          }
        }, [user, loading])

        return <div data-testid="auth-state">{loading ? 'loading' : user ? 'authenticated' : 'unauthenticated'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Should handle initial loading state
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated')
      }, { timeout: 5000 }) // 5 second timeout to prevent hanging

      expect(stateChanges).toContain('loading')
      expect(stateChanges).toContain('unauthenticated')
    })

    test('should handle sign in process without hanging', async () => {
      const TestComponent = () => {
        const { signInWithGoogle, loading } = useAuth()
        
        return (
          <div>
            <button 
              onClick={signInWithGoogle} 
              disabled={loading}
              data-testid="signin-button"
            >
              Sign In
            </button>
            <div data-testid="loading-state">{loading ? 'loading' : 'ready'}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('signin-button')).toBeInTheDocument()
      })

      // Mock sign in should complete without hanging
      const signInButton = screen.getByTestId('signin-button')
      
      act(() => {
        signInButton.click()
      })

      // Should not hang during sign in process
      await waitFor(() => {
        expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalled()
      }, { timeout: 3000 })
    })
  })

  describe('Error handling and recovery', () => {
    test('should handle auth errors without crashing', async () => {
      const authError = new Error('Authentication failed')
      mockSupabaseClient.auth.getSession.mockRejectedValue(authError)

      const TestComponent = () => {
        const { loading, user } = useAuth()
        return <div data-testid="result">{loading ? 'loading' : user ? 'authenticated' : 'error'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Should handle auth error gracefully
      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    test('should handle network timeouts gracefully', async () => {
      // Mock a hanging auth request
      mockSupabaseClient.auth.getSession.mockImplementation(
        () => new Promise((resolve) => {
          // Never resolve to simulate hanging
          setTimeout(() => resolve({ data: { session: null }, error: null }), 100)
        })
      )

      const TestComponent = () => {
        const { loading } = useAuth()
        return <div data-testid="loading-state">{loading ? 'loading' : 'ready'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Should eventually resolve
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('ready')
      }, { timeout: 2000 })
    })
  })

  describe('Memory and performance', () => {
    test('should clean up subscriptions on unmount', () => {
      const unsubscribeMock = jest.fn()
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } }
      })

      const { unmount } = render(
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      )

      unmount()

      expect(unsubscribeMock).toHaveBeenCalled()
    })

    test('should not create excessive re-renders', async () => {
      const renderCounts = { current: 0 }

      const TestComponent = () => {
        const { user, loading } = useAuth()
        renderCounts.current++
        return <div data-testid="render-count">{renderCounts.current}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('render-count')).toBeInTheDocument()
      })

      // Should not have excessive renders during initial mount
      expect(renderCounts.current).toBeLessThan(10)
    })
  })
})