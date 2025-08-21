/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'

// Isolated test to reproduce RLS infinite recursion error
describe('RLS Infinite Recursion Reproduction Test', () => {
  let supabase: any

  beforeAll(() => {
    // Use service role client to bypass auth for setup
    // Force local Supabase URL for testing (updated to localhost)
    const supabaseUrl = 'http://127.0.0.1:54321'
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    console.log('Using local Supabase for test:', { 
      supabaseUrl, 
      serviceRoleKey: serviceRoleKey ? 'present' : 'missing'
    })

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  })

  describe('Meal Generation Jobs RLS Policy Test', () => {
    it('should reproduce infinite recursion error when inserting meal_generation_jobs with authenticated user', async () => {
      // Step 1: Create a test user (service role can do this)
      const testUserEmail = `test-${Date.now()}@example.com`
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: testUserEmail,
        password: 'test-password-123',
        email_confirm: true
      })

      expect(signUpError).toBeNull()
      expect(authData.user).toBeTruthy()
      
      const testUserId = authData.user.id
      console.log('Created test user:', testUserId)

      // Step 2: Create an authenticated client for the test user
      const userSupabase = createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      // Sign in as the test user
      const { error: signInError } = await userSupabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'test-password-123'
      })

      expect(signInError).toBeNull()

      // Verify we're authenticated
      const { data: { user }, error: getUserError } = await userSupabase.auth.getUser()
      expect(getUserError).toBeNull()
      expect(user?.id).toBe(testUserId)

      console.log('Authenticated as test user')

      // Step 3: Create a test group first (required for meal generation job)
      const { data: group, error: groupError } = await userSupabase
        .from('groups')
        .insert({
          name: 'Test Group for RLS Test',
          user_id: testUserId,
          adults: 2,
          teens: 0,
          kids: 1,
          toddlers: 0,
          dietary_restrictions: [],
          status: 'active'
        })
        .select('id')
        .single()

      console.log('Group creation result:', { group, groupError })
      
      if (groupError) {
        console.error('Failed to create test group:', groupError)
        // Clean up user before failing
        await supabase.auth.admin.deleteUser(testUserId)
        throw new Error(`Failed to create test group: ${groupError.message}`)
      }

      // Step 4: Attempt to insert meal_generation_job as authenticated user
      // This should trigger the RLS infinite recursion error
      console.log('Attempting to insert meal_generation_job...')
      
      const jobData = {
        plan_name: 'Test Plan RLS',
        week_start: '2025-08-20',
        user_id: testUserId,
        status: 'pending',
        groups_data: [{
          group_id: group.id,
          group_name: 'Test Group for RLS Test',
          demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
          dietary_restrictions: [],
          meals_to_generate: 5,
          adult_equivalent: 2.7
        }],
        additional_notes: 'Test notes for RLS reproduction'
      }

      // This is the critical test - should fail with infinite recursion
      const { data: job, error: jobError } = await userSupabase
        .from('meal_generation_jobs')
        .insert(jobData)
        .select('id, status')
        .single()

      console.log('Meal generation job result:', { job, jobError })

      // Expected: This should fail with infinite recursion error
      expect(jobError).toBeTruthy()
      expect(jobError.message).toContain('infinite recursion detected')
      expect(jobError.message).toContain('meal_generation_jobs')

      console.log('✓ Successfully reproduced RLS infinite recursion error')

      // Cleanup: Delete test user
      await supabase.auth.admin.deleteUser(testUserId)
    })

    it('should verify that service role can insert without RLS issues', async () => {
      // This test proves that the issue is specifically with RLS policies
      // Service role should be able to insert without issues
      
      const jobData = {
        plan_name: 'Service Role Test Plan',
        week_start: '2025-08-20',
        user_id: '00000000-0000-0000-0000-000000000001', // Valid UUID for test
        status: 'pending',
        groups_data: [{
          group_id: '00000000-0000-0000-0000-000000000001',
          group_name: 'Service Role Test Group',
          demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
          dietary_restrictions: [],
          meals_to_generate: 5,
          adult_equivalent: 2.7
        }],
        additional_notes: 'Service role test'
      }

      // Service role should succeed
      const { data: job, error: jobError } = await supabase
        .from('meal_generation_jobs')
        .insert(jobData)
        .select('id, status')
        .single()

      console.log('Service role insertion result:', { job, jobError })

      // Should succeed since service role bypasses RLS
      expect(jobError).toBeNull()
      expect(job).toBeTruthy()
      expect(job.status).toBe('pending')

      console.log('✓ Service role can insert without RLS issues')

      // Cleanup: Delete the test job
      await supabase
        .from('meal_generation_jobs')
        .delete()
        .eq('id', job.id)
    })

    it('should verify that SECURITY DEFINER functions work correctly', async () => {
      // This test verifies that our new bypass functions work
      
      // Step 1: Create a test user
      const testUserEmail = `bypass-test-${Date.now()}@example.com`
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: testUserEmail,
        password: 'test-password-123',
        email_confirm: true
      })

      expect(signUpError).toBeNull()
      expect(authData.user).toBeTruthy()
      
      const testUserId = authData.user.id
      console.log('Created test user for bypass test:', testUserId)

      // Step 2: Create authenticated client
      const userSupabase = createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      )

      const { error: signInError } = await userSupabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'test-password-123'
      })

      expect(signInError).toBeNull()

      // Step 3: Test the SECURITY DEFINER function for creating jobs
      const { data: jobData, error: jobError } = await userSupabase.rpc('create_meal_generation_job', {
        p_plan_name: 'Bypass Test Plan',
        p_week_start: '2025-08-20',
        p_user_id: testUserId,
        p_groups_data: [{
          group_id: '00000000-0000-0000-0000-000000000001',
          group_name: 'Bypass Test Group',
          demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
          dietary_restrictions: [],
          meals_to_generate: 5,
          adult_equivalent: 2.7
        }],
        p_additional_notes: 'Testing bypass function'
      })

      console.log('SECURITY DEFINER function result:', { jobData, jobError })

      // Should succeed since SECURITY DEFINER bypasses RLS
      expect(jobError).toBeNull()
      expect(jobData).toBeTruthy()
      expect(jobData.length).toBe(1)
      expect(jobData[0].job_status).toBe('pending')

      const jobId = jobData[0].job_id
      console.log('✓ SECURITY DEFINER function created job successfully:', jobId)

      // Step 4: Test updating the job
      const { error: updateError } = await userSupabase.rpc('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'processing',
        p_progress: 50,
        p_current_step: 'Testing update function...'
      })

      console.log('Update function result:', { updateError })
      expect(updateError).toBeNull()
      console.log('✓ SECURITY DEFINER update function works')

      // Step 5: Test querying jobs
      const { data: queryData, error: queryError } = await userSupabase.rpc('get_meal_generation_jobs', {
        p_user_id: testUserId,
        p_job_id: jobId
      })

      console.log('Query function result:', { queryData, queryError })
      expect(queryError).toBeNull()
      expect(queryData).toBeTruthy()
      expect(queryData.length).toBe(1)
      expect(queryData[0].status).toBe('processing')
      expect(queryData[0].progress).toBe(50)
      console.log('✓ SECURITY DEFINER query function works')

      // Cleanup
      await supabase.auth.admin.deleteUser(testUserId)
      await supabase.from('meal_generation_jobs').delete().eq('id', jobId)
    })
  })
})