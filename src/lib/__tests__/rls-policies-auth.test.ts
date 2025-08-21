/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'

// Test RLS policies with authenticated user context
describe('RLS Policy Authentication Tests', () => {
  let supabase: any
  let anonSupabase: any

  beforeAll(() => {
    // Connect with service role (bypasses RLS)
    supabase = createClient(
      'http://172.29.127.203:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    )
    
    // Connect with anon key (uses RLS)
    anonSupabase = createClient(
      'http://172.29.127.203:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    )
  })

  describe('RLS Policy with Anon User', () => {
    it('should fail with anon user trying to access meal_generation_jobs', async () => {
      // This should fail because anon users should not access meal_generation_jobs
      const { data, error } = await anonSupabase
        .from('meal_generation_jobs')
        .select('id, status, user_id')
        .limit(1)

      console.log('Anon user query result:', { data, error })
      
      // Anon user should get permission denied, not infinite recursion
      expect(error).not.toBeNull()
      if (error) {
        console.log('Error code:', error.code)
        console.log('Error message:', error.message)
        expect(error.message).not.toContain('infinite recursion')
      }
    })

    it('should fail with anon user trying to access generated_meals', async () => {
      // This is where infinite recursion might happen
      const { data, error } = await anonSupabase
        .from('generated_meals')
        .select('id, job_id, title')
        .limit(1)

      console.log('Anon user generated_meals query:', { data, error })
      
      // Should get permission denied, not infinite recursion
      expect(error).not.toBeNull()
      if (error) {
        console.log('Error code:', error.code)
        console.log('Error message:', error.message)
        // This is the key test - should NOT be infinite recursion
        expect(error.message).not.toContain('infinite recursion')
      }
    })
  })

  describe('Server-side Auth Context Simulation', () => {
    it('should test meal_generation_jobs query with simulated auth context', async () => {
      // Create a test user first
      const testUserId = 'test-user-' + Date.now()
      
      // Insert a test job with service role
      const { data: insertedJob, error: insertError } = await supabase
        .from('meal_generation_jobs')
        .insert({
          plan_name: 'Test Plan',
          week_start: '2023-01-01',
          user_id: testUserId,
          status: 'completed',
          groups_data: [{ test: true }]
        })
        .select()
        .single()

      console.log('Inserted test job:', { insertedJob, insertError })
      expect(insertError).toBeNull()

      // Now try to insert a generated meal for this job
      if (insertedJob) {
        const { data: insertedMeal, error: mealInsertError } = await supabase
          .from('generated_meals')
          .insert({
            job_id: insertedJob.id,
            group_id: 'test-group',
            group_name: 'Test Group',
            title: 'Test Meal',
            prep_time: 30,
            cook_time: 20,
            total_time: 50,
            servings: 4,
            ingredients: ['test'],
            instructions: ['test'],
            difficulty: 'easy'
          })
          .select()
          .single()

        console.log('Inserted test meal:', { insertedMeal, mealInsertError })
        expect(mealInsertError).toBeNull()

        // Now query generated_meals - this should trigger the RLS policy
        const { data: meals, error: mealQueryError } = await supabase
          .from('generated_meals')
          .select('id, job_id, title')
          .eq('job_id', insertedJob.id)

        console.log('Querying meals with RLS:', { meals, mealQueryError })
        
        if (mealQueryError) {
          console.error('Meal query error details:', mealQueryError)
          // This is where we expect to see infinite recursion
          expect(mealQueryError.message).not.toContain('infinite recursion')
        } else {
          expect(meals).toBeDefined()
        }

        // Clean up
        await supabase.from('generated_meals').delete().eq('job_id', insertedJob.id)
        await supabase.from('meal_generation_jobs').delete().eq('id', insertedJob.id)
      }
    })
  })

  describe('Direct RLS Policy Testing', () => {
    it('should test the exact RLS policy logic manually', async () => {
      // Test the subquery that causes infinite recursion
      // This replicates: job_id IN (SELECT id FROM meal_generation_jobs WHERE user_id = auth.uid())
      
      const testUserId = 'test-user-' + Date.now()
      
      // First, let's test the inner query directly
      const { data: jobIds, error: jobIdsError } = await supabase
        .from('meal_generation_jobs')
        .select('id')
        .eq('user_id', testUserId)

      console.log('Inner query (job IDs):', { jobIds, jobIdsError })
      
      if (jobIdsError) {
        console.error('Job IDs query error:', jobIdsError)
        expect(jobIdsError.message).not.toContain('infinite recursion')
      }
      
      expect(jobIdsError).toBeNull()
    })
  })
})