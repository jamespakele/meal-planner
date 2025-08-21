import { createClient } from '@/lib/supabase/client'

describe('Authentication Integration', () => {
  describe('Google OAuth Configuration', () => {
    test('should have Google OAuth environment variables configured', () => {
      expect(process.env.GOOGLE_OAUTH_CLIENT_ID).toBeDefined()
      expect(process.env.GOOGLE_OAUTH_CLIENT_SECRET).toBeDefined()
      
      // Validate client ID format (Google client IDs end with .apps.googleusercontent.com)
      expect(process.env.GOOGLE_OAUTH_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
    })

    test('should be able to initialize OAuth without fetch errors', async () => {
      const supabase = createClient()
      
      try {
        // Attempt to initiate OAuth - this should not result in "Failed to fetch"
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${process.env.NEXTAUTH_URL}/auth/callback`
          }
        })
      } catch (error) {
        // OAuth might fail for various reasons, but not due to network connectivity
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })
  })

  describe('Authentication State Management', () => {
    test('should handle session retrieval without connectivity errors', async () => {
      const supabase = createClient()
      
      try {
        const { data: session, error } = await supabase.auth.getSession()
        
        if (error) {
          expect(error.message).not.toMatch(/Failed to fetch/i)
          expect(error.message).not.toMatch(/fetch/i)
        }
        
        // Session might be null (user not logged in), but should not error due to connectivity
        expect(session).toBeDefined() // session object should exist, even if session.session is null
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })

    test('should handle user retrieval without connectivity errors', async () => {
      const supabase = createClient()
      
      try {
        const { data: user, error } = await supabase.auth.getUser()
        
        if (error) {
          expect(error.message).not.toMatch(/Failed to fetch/i)
          expect(error.message).not.toMatch(/fetch/i)
        }
        
        // User might be null (not logged in), but should not error due to connectivity
        expect(user).toBeDefined() // user object should exist, even if user.user is null
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })

    test('should handle auth state changes without throwing fetch errors', (done) => {
      const supabase = createClient()
      
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        // Auth state changes should not result in fetch errors being thrown
        expect(event).toBeDefined()
        
        // Clean up and complete test
        if (authListener?.subscription) {
          authListener.subscription.unsubscribe()
        }
        done()
      })
      
      // Trigger an auth state check
      supabase.auth.getSession().catch((error) => {
        // Should not be a fetch error
        expect(error.message).not.toMatch(/Failed to fetch/i)
        expect(error.message).not.toMatch(/fetch/i)
        
        if (authListener?.subscription) {
          authListener.subscription.unsubscribe()
        }
        done()
      })
    })
  })

  describe('Authentication Error Handling', () => {
    test('should handle invalid authentication gracefully without fetch errors', async () => {
      const supabase = createClient()
      
      try {
        // Try to sign in with invalid credentials
        const { data, error } = await supabase.auth.signInWithPassword({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
        
        if (error) {
          // Should be an authentication error, not a network error
          expect(error.message).not.toMatch(/Failed to fetch/i)
          expect(error.message).not.toMatch(/fetch/i)
          // Should be a proper auth error
          expect(error.message).toMatch(/invalid|credentials|password|email/i)
        }
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })

    test('should handle sign out without connectivity errors', async () => {
      const supabase = createClient()
      
      try {
        const { error } = await supabase.auth.signOut()
        
        if (error) {
          expect(error.message).not.toMatch(/Failed to fetch/i)
          expect(error.message).not.toMatch(/fetch/i)
        }
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })
  })

  describe('Token and Session Management', () => {
    test('should handle token refresh without fetch errors', async () => {
      const supabase = createClient()
      
      try {
        // Attempt to refresh session
        const { data, error } = await supabase.auth.refreshSession()
        
        if (error) {
          expect(error.message).not.toMatch(/Failed to fetch/i)
          expect(error.message).not.toMatch(/fetch/i)
        }
      } catch (error) {
        expect((error as Error).message).not.toMatch(/Failed to fetch/i)
        expect((error as Error).message).not.toMatch(/fetch/i)
      }
    })
  })
})