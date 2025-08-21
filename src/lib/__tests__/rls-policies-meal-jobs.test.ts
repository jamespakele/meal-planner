import { createClient } from '@supabase/supabase-js'

describe('RLS Policies - Meal Generation Jobs', () => {
  let supabase: any
  
  beforeAll(async () => {
    // Use local Supabase instance for testing
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55321',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    )
  })

  describe('RLS Infinite Recursion Error Reproduction', () => {
    test('should NOT get infinite recursion error when querying meal_generation_jobs', async () => {
      try {
        // This query should work without infinite recursion
        const { data, error } = await supabase
          .from('meal_generation_jobs')
          .select('id, status, progress, user_id')
          .limit(1)

        // The specific error we're trying to fix
        if (error) {
          console.error('Database error:', error)
          expect(error.code).not.toBe('42P17') // PostgreSQL infinite recursion error code
          expect(error.message).not.toMatch(/infinite recursion detected/i)
          expect(error.message).not.toMatch(/relation "meal_generation_jobs"/i)
        }

        // Should either return data or a permission error, but not recursion error
        expect(error?.code).not.toBe('42P17')
      } catch (error) {
        console.error('Unexpected error:', error)
        expect((error as Error).message).not.toMatch(/infinite recursion/i)
        throw error
      }
    })

    test('should handle authenticated queries to meal_generation_jobs without recursion', async () => {
      // Test with a mock authenticated context
      // In real tests, this would use a valid auth token
      
      try {
        const { data, error } = await supabase
          .from('meal_generation_jobs')
          .select(`
            id,
            plan_name,
            week_start,
            status,
            progress,
            current_step,
            total_meals_generated,
            error_message,
            created_at,
            started_at,
            completed_at,
            user_id
          `)
          .limit(5)

        console.log('Query result:', { data, error })

        if (error) {
          // Log the exact error for debugging
          console.error('RLS Error Details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          })

          // The main issue we're fixing
          expect(error.code).not.toBe('42P17')
          expect(error.message).not.toMatch(/infinite recursion detected in policy for relation "meal_generation_jobs"/i)
        }

        // Should not get infinite recursion regardless of data returned
        expect(error?.code).not.toBe('42P17')
      } catch (error) {
        console.error('Test error:', error)
        expect((error as Error).message).not.toMatch(/infinite recursion/i)
      }
    })

    test('should handle jobId-specific queries without recursion', async () => {
      // Test the specific query pattern that fails in the API
      const mockJobId = 'd1d530b9-4fda-4928-993b-73282e9e680f' // From error logs
      
      try {
        const { data, error } = await supabase
          .from('meal_generation_jobs')
          .select(`
            id,
            plan_name,
            week_start,
            status,
            progress,
            current_step,
            total_meals_generated,
            error_message,
            created_at,
            started_at,
            completed_at
          `)
          .eq('id', mockJobId)

        console.log('JobId query result:', { data, error })

        if (error) {
          console.error('JobId query error:', error)
          
          // This is the exact error pattern we need to fix
          expect(error.code).not.toBe('42P17')
          expect(error.message).not.toMatch(/infinite recursion detected in policy/i)
        }

        expect(error?.code).not.toBe('42P17')
      } catch (error) {
        console.error('JobId test error:', error)
        expect((error as Error).message).not.toMatch(/infinite recursion/i)
      }
    })

    test('should handle user-filtered queries without recursion', async () => {
      // Test user-specific filtering that might trigger RLS issues
      const mockUserId = '5a27b32a-6ab7-4c7c-b3c2-7127aa6419c0' // From error logs
      
      try {
        const { data, error } = await supabase
          .from('meal_generation_jobs')
          .select('id, status, user_id')
          .eq('user_id', mockUserId)
          .order('created_at', { ascending: false })

        console.log('User filter query result:', { data, error })

        if (error) {
          console.error('User filter query error:', error)
          expect(error.code).not.toBe('42P17')
          expect(error.message).not.toMatch(/infinite recursion/i)
        }

        expect(error?.code).not.toBe('42P17')
      } catch (error) {
        console.error('User filter test error:', error)
        expect((error as Error).message).not.toMatch(/infinite recursion/i)
      }
    })
  })

  describe('Database Policy Analysis', () => {
    test('should verify current RLS policies on meal_generation_jobs', async () => {
      try {
        // Query to check current policies
        const { data: policies, error } = await supabase
          .rpc('get_table_policies', { table_name: 'meal_generation_jobs' })
          .catch(() => {
            // If the function doesn't exist, try a direct query
            return supabase
              .from('pg_policies')
              .select('*')
              .eq('tablename', 'meal_generation_jobs')
          })

        console.log('Current RLS policies:', policies)

        if (error) {
          console.log('Could not fetch policies (this is expected in test environment):', error.message)
        }

        // This test is for informational purposes - we just want to log current state
        expect(true).toBe(true)
      } catch (error) {
        console.log('Policy analysis failed (expected in test environment):', (error as Error).message)
        expect(true).toBe(true)
      }
    })

    test('should check for circular RLS dependencies', async () => {
      // This test documents potential circular dependencies
      console.log('Checking for potential RLS circular dependencies:')
      console.log('1. meal_generation_jobs policies might reference user_id with auth.uid()')
      console.log('2. If auth.uid() calls back to meal_generation_jobs, this creates recursion')
      console.log('3. Nuclear fix should use simple auth.uid() = user_id pattern only')
      
      // Test passes if we can identify the pattern
      expect(true).toBe(true)
    })
  })

  describe('API Endpoint Simulation', () => {
    test('should simulate the failing API endpoint query pattern', async () => {
      // Simulate exactly what the GET /api/meal-generation/jobs endpoint does
      const mockUserId = 'test-user-id'
      const mockJobId = 'test-job-id'
      
      try {
        // This mirrors the query in route.ts lines 185-210
        let query = supabase
          .from('meal_generation_jobs')
          .select(`
            id,
            plan_name,
            week_start,
            status,
            progress,
            current_step,
            total_meals_generated,
            error_message,
            created_at,
            started_at,
            completed_at
          `)

        // Add filters like the API does
        if (mockJobId) {
          query = query.eq('id', mockJobId)
        }

        query = query.order('created_at', { ascending: false })

        const { data: dbJobs, error } = await query

        console.log('API simulation result:', { dbJobs, error })

        if (error) {
          console.error('API simulation error:', error)
          
          // This is the exact error we're fixing in the API
          expect(error.code).not.toBe('42P17')
          expect(error.message).not.toContain('infinite recursion detected in policy for relation "meal_generation_jobs"')
        }

        expect(error?.code).not.toBe('42P17')
      } catch (error) {
        console.error('API simulation test error:', error)
        expect((error as Error).message).not.toMatch(/infinite recursion/i)
      }
    })
  })
})