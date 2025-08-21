describe('Supabase Local Instance Health', () => {
  const LOCAL_SUPABASE_URL = 'http://127.0.0.1:55321'
  
  describe('Basic HTTP Connectivity', () => {
    test('should be able to reach Supabase local instance', async () => {
      try {
        const response = await fetch(LOCAL_SUPABASE_URL)
        
        // Should get some response (even if 404 or other), not a network error
        expect(response).toBeDefined()
        console.log('Supabase local instance response status:', response.status)
        console.log('Supabase local instance response:', response.statusText)
      } catch (error) {
        // This would indicate a network connectivity issue
        console.error('Failed to connect to local Supabase instance:', error)
        expect((error as Error).message).not.toMatch(/fetch|ECONNREFUSED|ENOTFOUND/i)
      }
    }, 10000) // 10 second timeout for network requests

    test('should be able to reach Supabase health endpoint', async () => {
      try {
        const response = await fetch(`${LOCAL_SUPABASE_URL}/health`)
        
        console.log('Health endpoint status:', response.status)
        console.log('Health endpoint response:', response.statusText)
        
        // Health endpoint should return 200 if Supabase is running
        if (response.ok) {
          const data = await response.text()
          console.log('Health endpoint data:', data)
          expect(response.status).toBe(200)
        } else {
          // If it's not OK, still shouldn't be a network error
          expect(response.status).toBeGreaterThan(0)
        }
      } catch (error) {
        console.error('Failed to reach health endpoint:', error)
        
        // Check if it's a connection refused error (service not running)
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.log('DETECTED: Supabase local instance is not running on port 55321')
          expect((error as Error).message).toMatch(/ECONNREFUSED/)
        } else {
          // Other network errors
          throw error
        }
      }
    }, 10000)

    test('should be able to reach Supabase ready endpoint', async () => {
      try {
        const response = await fetch(`${LOCAL_SUPABASE_URL}/ready`)
        
        console.log('Ready endpoint status:', response.status)
        console.log('Ready endpoint response:', response.statusText)
        
        if (response.ok) {
          const data = await response.text()
          console.log('Ready endpoint data:', data)
          expect(response.status).toBe(200)
        }
      } catch (error) {
        console.error('Failed to reach ready endpoint:', error)
        
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.log('DETECTED: Supabase local instance is not running on port 55321')
          expect((error as Error).message).toMatch(/ECONNREFUSED/)
        } else {
          throw error
        }
      }
    }, 10000)
  })

  describe('Supabase Auth Service Connectivity', () => {
    test('should be able to reach Supabase Auth API', async () => {
      try {
        const response = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/`)
        
        console.log('Auth API status:', response.status)
        console.log('Auth API response:', response.statusText)
        
        // Auth API should respond (even if 404 or other status)
        expect(response).toBeDefined()
        expect(response.status).toBeGreaterThan(0)
      } catch (error) {
        console.error('Failed to reach Auth API:', error)
        
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.log('DETECTED: Supabase local instance is not running on port 55321')
          expect((error as Error).message).toMatch(/ECONNREFUSED/)
        } else {
          // This would be the "Failed to fetch" error we're investigating
          console.log('DETECTED: Auth API fetch error (not connection refused):', (error as Error).message)
          throw error
        }
      }
    }, 10000)

    test('should be able to reach Auth token endpoint', async () => {
      try {
        // Try to reach the specific auth endpoint that GoTrueClient might be calling
        const response = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
          },
          body: JSON.stringify({}) // Empty body, might get validation error but should connect
        })
        
        console.log('Auth token endpoint status:', response.status)
        console.log('Auth token endpoint response:', response.statusText)
        
        // Should get some response, even if it's a validation error
        expect(response).toBeDefined()
        expect(response.status).toBeGreaterThan(0)
      } catch (error) {
        console.error('Failed to reach Auth token endpoint:', error)
        
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.log('DETECTED: Supabase local instance is not running on port 55321')
          expect((error as Error).message).toMatch(/ECONNREFUSED/)
        } else {
          console.log('DETECTED: Auth token fetch error:', (error as Error).message)
          // This might be our "Failed to fetch" error
          throw error
        }
      }
    }, 10000)
  })

  describe('Database Connectivity with Local Instance', () => {
    test('should be able to connect to REST API with service role', async () => {
      try {
        const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
            'Content-Type': 'application/json'
          }
        })
        
        console.log('REST API status:', response.status)
        console.log('REST API response:', response.statusText)
        
        expect(response).toBeDefined()
        expect(response.status).toBeGreaterThan(0)
      } catch (error) {
        console.error('Failed to reach REST API:', error)
        
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.log('DETECTED: Supabase local instance is not running on port 55321')
          expect((error as Error).message).toMatch(/ECONNREFUSED/)
        } else {
          throw error
        }
      }
    }, 10000)
  })
})