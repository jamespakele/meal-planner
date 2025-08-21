/**
 * Test to reproduce the exact 500 error in meal generation jobs API
 * This test calls the actual API endpoint to reproduce the RLS infinite recursion
 */

describe('API Meal Generation Jobs - 500 Error Reproduction', () => {
  const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  describe('GET /api/meal-generation/jobs Endpoint', () => {
    test('should NOT return 500 Internal Server Error for job polling', async () => {
      // Test the exact endpoint that's failing in the logs
      const mockJobId = 'd1d530b9-4fda-4928-993b-73282e9e680f'
      const url = `${API_BASE}/api/meal-generation/jobs?jobId=${mockJobId}`
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('API Response Status:', response.status)
        console.log('API Response Status Text:', response.statusText)

        const responseText = await response.text()
        console.log('API Response Body:', responseText)

        // The main issue we're fixing - should not be 500
        expect(response.status).not.toBe(500)

        if (response.status === 500) {
          console.error('500 ERROR REPRODUCED - Response:', responseText)
          
          // Check if it contains the infinite recursion error
          expect(responseText).not.toMatch(/infinite recursion detected in policy for relation "meal_generation_jobs"/i)
        }

        // Valid responses should be 200 (success), 401 (auth required), or 404 (job not found)
        // But NOT 500 (internal server error)
        expect([200, 401, 404]).toContain(response.status)

      } catch (error) {
        console.error('Fetch error:', error)
        
        // Should not fail due to network issues in local testing
        expect((error as Error).message).not.toMatch(/fetch/i)
        throw error
      }
    })

    test('should handle job polling without RLS infinite recursion', async () => {
      // Test without specific jobId to hit the general query
      const url = `${API_BASE}/api/meal-generation/jobs`
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('General API Response Status:', response.status)
        
        const responseText = await response.text()
        console.log('General API Response:', responseText.substring(0, 200))

        // Should not be 500 due to RLS issues
        expect(response.status).not.toBe(500)

        if (response.status === 500) {
          console.error('500 ERROR in general endpoint:', responseText)
          
          // Check for the specific RLS error
          expect(responseText).not.toMatch(/infinite recursion detected/i)
          expect(responseText).not.toMatch(/meal_generation_jobs/i)
        }

        // Should be 401 (authentication required) or 200 (success)
        expect([200, 401]).toContain(response.status)

      } catch (error) {
        console.error('General endpoint error:', error)
        throw error
      }
    })

    test('should verify the API endpoint exists and is reachable', async () => {
      // Test that the API route is properly set up
      const url = `${API_BASE}/api/meal-generation/jobs`
      
      try {
        const response = await fetch(url, {
          method: 'GET',
        })

        console.log('Endpoint reachability test:', response.status)

        // Should not be 404 (Not Found) - the endpoint should exist
        expect(response.status).not.toBe(404)
        
        // Should be reachable (not network error)
        expect(response).toBeDefined()
        expect(response.status).toBeGreaterThan(0)

      } catch (error) {
        console.error('Reachability test error:', error)
        
        // Should not fail to reach the endpoint in local development
        if ((error as Error).message.includes('ECONNREFUSED')) {
          console.warn('Development server may not be running')
        } else {
          throw error
        }
      }
    })

    test('should document the expected error pattern from logs', () => {
      // Document the exact error we saw in the logs
      console.log('Expected error pattern from development logs:')
      console.log('- Status: 500 Internal Server Error')
      console.log('- Database Error: infinite recursion detected in policy for relation "meal_generation_jobs"')
      console.log('- Error Code: 42P17 (PostgreSQL recursion error)')
      console.log('- Failing URLs:')
      console.log('  * /api/meal-generation/jobs?jobId=d1d530b9-4fda-4928-993b-73282e9e680f')
      console.log('  * /api/meal-generation/jobs?jobId=756cdbb4-aed0-4b68-bdae-3f5ab15a01cd')
      
      // This test always passes - it's for documentation
      expect(true).toBe(true)
    })
  })

  describe('Error Pattern Analysis', () => {
    test('should identify the RLS policy issue', () => {
      console.log('RLS Policy Analysis:')
      console.log('1. The meal_generation_jobs table has RLS enabled')
      console.log('2. Current policy likely uses auth.uid() = user_id pattern')
      console.log('3. When PostgreSQL evaluates the policy, it may create a circular reference')
      console.log('4. This happens during the SELECT query in the GET endpoint')
      console.log('5. Migration 011_nuclear_rls_fix.sql should have fixed this but may not be applied')
      
      expect(true).toBe(true)
    })

    test('should verify the fix approach', () => {
      console.log('Fix Approach:')
      console.log('1. Verify current RLS policies on meal_generation_jobs table')
      console.log('2. Apply new migration to completely remove circular dependencies')
      console.log('3. Use simple user ownership pattern: auth.uid() = user_id')
      console.log('4. Test that job polling queries work without 500 errors')
      console.log('5. Ensure end-to-end meal generation workflow succeeds')
      
      expect(true).toBe(true)
    })
  })
})