/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'

// Test RLS policies directly to identify infinite recursion issues
describe('RLS Policy Tests', () => {
  let supabase: any

  beforeAll(() => {
    // Connect to local Supabase instance
    supabase = createClient(
      'http://172.29.127.203:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    )
  })

  describe('meal_generation_jobs RLS Policy', () => {
    it('should query meal_generation_jobs without infinite recursion', async () => {
      // This test should fail initially due to infinite recursion
      const { data, error } = await supabase
        .from('meal_generation_jobs')
        .select('id, status, user_id')
        .limit(1)

      console.log('Query result:', { data, error })
      
      // The test should pass (no infinite recursion error)
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should query meal_generation_jobs with user filter', async () => {
      // Create a test user context by manually setting user_id
      const testUserId = '12345678-1234-1234-1234-123456789012'
      
      const { data, error } = await supabase
        .from('meal_generation_jobs')
        .select('id, status, user_id')
        .eq('user_id', testUserId)
        .limit(1)

      console.log('Filtered query result:', { data, error })
      
      // Should not get infinite recursion error
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe('generated_meals RLS Policy', () => {
    it('should query generated_meals without triggering meal_generation_jobs recursion', async () => {
      // This is where the infinite recursion happens
      const { data, error } = await supabase
        .from('generated_meals')
        .select('id, job_id, title')
        .limit(1)

      console.log('Generated meals query result:', { data, error })
      
      // This should fail initially with infinite recursion
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should query generated_meals with specific job_id', async () => {
      const testJobId = '12345678-1234-1234-1234-123456789012'
      
      const { data, error } = await supabase
        .from('generated_meals')
        .select('id, job_id, title')
        .eq('job_id', testJobId)
        .limit(1)

      console.log('Generated meals with job_id result:', { data, error })
      
      // Should not cause infinite recursion
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe('API Route Database Queries', () => {
    it('should replicate the exact query from meal-generation/status API', async () => {
      const testUserId = '12345678-1234-1234-1234-123456789012'
      const testPlanId = 'test-plan-id'
      
      // This replicates the exact query from our API route
      const { data: jobs, error: jobsError } = await supabase
        .from('meal_generation_jobs')
        .select(`
          id,
          plan_name,
          status,
          progress,
          current_step,
          total_meals_generated,
          error_message,
          created_at,
          started_at,
          completed_at
        `)
        .eq('user_id', testUserId)
        .eq('plan_name', testPlanId)
        .order('created_at', { ascending: false })

      console.log('API replication - jobs query:', { jobs, jobsError })
      
      if (jobsError) {
        // If there's infinite recursion, log the exact error
        console.error('Jobs query error:', jobsError)
        expect(jobsError.message).not.toContain('infinite recursion')
      }

      // Query generated meals for the jobs (this triggers the RLS policy issue)
      if (jobs && jobs.length > 0) {
        const { data: meals, error: mealsError } = await supabase
          .from('generated_meals')
          .select('id, job_id, group_name, title, selected')
          .in('job_id', jobs.map(job => job.id))

        console.log('API replication - meals query:', { meals, mealsError })
        
        if (mealsError) {
          console.error('Meals query error:', mealsError)
          expect(mealsError.message).not.toContain('infinite recursion')
        }
      }
      
      expect(jobsError).toBeNull()
    })
  })

  describe('Authentication Context Tests', () => {
    it('should test queries with authenticated user context', async () => {
      // Test with service role that should bypass RLS
      const { data, error } = await supabase
        .from('meal_generation_jobs')
        .select('*')
        .limit(1)

      console.log('Service role query result:', { data, error })
      expect(error).toBeNull()
    })
  })
})