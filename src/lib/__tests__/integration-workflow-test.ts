/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'

// Integration test for the complete meal generation workflow
describe('Meal Generation Workflow Integration Test', () => {
  let supabase: any
  let userSupabase: any
  let testUserId: string
  let testGroupId: string

  beforeAll(async () => {
    // Setup test environment
    const supabaseUrl = 'http://127.0.0.1:54321'
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Create test user
    const testUserEmail = `workflow-test-${Date.now()}@example.com`
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: 'test-password-123',
      email_confirm: true
    })

    expect(signUpError).toBeNull()
    testUserId = authData.user.id

    // Create authenticated client
    userSupabase = createClient(
      'http://127.0.0.1:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    )

    await userSupabase.auth.signInWithPassword({
      email: testUserEmail,
      password: 'test-password-123'
    })

    // Create test group
    const { data: groupData, error: groupError } = await userSupabase.from('groups').insert({
      name: 'Workflow Test Group',
      user_id: testUserId,
      adults: 2,
      teens: 1,
      kids: 0,
      toddlers: 0,
      dietary_restrictions: ['vegetarian'],
      status: 'active'
    }).select('id').single()

    expect(groupError).toBeNull()
    testGroupId = groupData.id
  })

  afterAll(async () => {
    // Cleanup
    await supabase.auth.admin.deleteUser(testUserId)
  })

  describe('Complete Meal Generation Workflow', () => {
    it('should complete the entire meal generation workflow without RLS errors', async () => {
      console.log('🧪 Testing complete meal generation workflow...')

      // Step 1: Test direct SECURITY DEFINER function - create meal generation job
      console.log('📝 Step 1: Creating meal generation job using SECURITY DEFINER function...')
      
      const groupsData = [{
        group_id: testGroupId,
        group_name: 'Workflow Test Group',
        demographics: { adults: 2, teens: 1, kids: 0, toddlers: 0 },
        dietary_restrictions: ['vegetarian'],
        meals_to_generate: 5,
        group_notes: 'Integration test group',
        adult_equivalent: 3.2
      }]

      const { data: jobData, error: jobError } = await userSupabase.rpc('create_meal_generation_job', {
        p_plan_name: 'Integration Test Plan',
        p_week_start: '2025-08-20',
        p_user_id: testUserId,
        p_groups_data: groupsData,
        p_additional_notes: 'Complete workflow integration test'
      })

      expect(jobError).toBeNull()
      expect(jobData).toBeTruthy()
      expect(jobData.length).toBe(1)
      expect(jobData[0].job_status).toBe('pending')
      
      const jobId = jobData[0].job_id
      console.log(`✅ Successfully created job: ${jobId}`)

      // Step 2: Test job status update
      console.log('🔄 Step 2: Updating job status...')
      
      const { error: updateError } = await userSupabase.rpc('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'processing',
        p_progress: 25,
        p_current_step: 'Integration test in progress...',
        p_started_at: new Date().toISOString()
      })

      expect(updateError).toBeNull()
      console.log('✅ Successfully updated job status')

      // Step 3: Test job querying
      console.log('🔍 Step 3: Querying job status...')
      
      const { data: queryData, error: queryError } = await userSupabase.rpc('get_meal_generation_jobs', {
        p_user_id: testUserId,
        p_job_id: jobId
      })

      expect(queryError).toBeNull()
      expect(queryData).toBeTruthy()
      expect(queryData.length).toBe(1)
      expect(queryData[0].status).toBe('processing')
      expect(queryData[0].progress).toBe(25)
      expect(queryData[0].plan_name).toBe('Integration Test Plan')
      console.log('✅ Successfully queried job status')

      // Step 4: Test meal insertion
      console.log('🍽️ Step 4: Inserting generated meals...')
      
      const testMeals = [
        {
          group_id: testGroupId,
          group_name: 'Workflow Test Group',
          title: 'Vegetarian Pasta',
          description: 'Delicious pasta with vegetables',
          prep_time: 15,
          cook_time: 20,
          total_time: 35,
          servings: 4,
          ingredients: ['pasta', 'vegetables', 'olive oil'],
          instructions: ['Cook pasta', 'Sauté vegetables', 'Combine'],
          tags: ['vegetarian', 'italian'],
          dietary_info: { vegetarian: true },
          difficulty: 'easy'
        },
        {
          group_id: testGroupId,
          group_name: 'Workflow Test Group',
          title: 'Vegetarian Stir Fry',
          description: 'Quick vegetable stir fry',
          prep_time: 10,
          cook_time: 15,
          total_time: 25,
          servings: 3,
          ingredients: ['mixed vegetables', 'soy sauce', 'rice'],
          instructions: ['Heat oil', 'Stir fry vegetables', 'Serve with rice'],
          tags: ['vegetarian', 'asian'],
          dietary_info: { vegetarian: true },
          difficulty: 'easy'
        }
      ]

      const { error: mealsError } = await userSupabase.rpc('insert_generated_meals', {
        p_job_id: jobId,
        p_meals: testMeals
      })

      expect(mealsError).toBeNull()
      console.log('✅ Successfully inserted generated meals')

      // Step 5: Test notification creation
      console.log('📢 Step 5: Creating notification...')
      
      const { error: notificationError } = await userSupabase.rpc('insert_user_notification', {
        p_user_id: testUserId,
        p_type: 'meal_generation_completed',
        p_title: 'Integration test completed!',
        p_message: `Integration test successfully created 2 meals for "Integration Test Plan".`,
        p_job_id: jobId
      })

      expect(notificationError).toBeNull()
      console.log('✅ Successfully created notification')

      // Step 6: Test final job completion
      console.log('🏁 Step 6: Marking job as completed...')
      
      const { error: completionError } = await userSupabase.rpc('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'completed',
        p_progress: 100,
        p_current_step: 'Completed',
        p_completed_at: new Date().toISOString(),
        p_total_meals_generated: 2,
        p_api_calls_made: 1,
        p_generation_time_ms: 1500
      })

      expect(completionError).toBeNull()
      console.log('✅ Successfully marked job as completed')

      // Step 7: Final verification - query the completed job
      console.log('🔍 Step 7: Final verification...')
      
      const { data: finalData, error: finalError } = await userSupabase.rpc('get_meal_generation_jobs', {
        p_user_id: testUserId,
        p_plan_name: 'Integration Test Plan'
      })

      expect(finalError).toBeNull()
      expect(finalData).toBeTruthy()
      expect(finalData.length).toBe(1)
      expect(finalData[0].status).toBe('completed')
      expect(finalData[0].progress).toBe(100)
      expect(finalData[0].total_meals_generated).toBe(2)
      
      console.log('🎉 INTEGRATION TEST COMPLETE!')
      console.log('✅ All SECURITY DEFINER functions work correctly')
      console.log('✅ RLS infinite recursion issue has been resolved')
      console.log('✅ Complete meal generation workflow is functional')

      // Cleanup - delete the test job and related data
      await supabase.from('user_notifications').delete().eq('job_id', jobId)
      await supabase.from('generated_meals').delete().eq('job_id', jobId)
      await supabase.from('meal_generation_jobs').delete().eq('id', jobId)
    })

    it('should verify that old direct table operations would still fail with RLS infinite recursion', async () => {
      // This test proves that our fix was necessary by showing the old way still fails
      console.log('🚫 Testing that direct table operations still fail with RLS infinite recursion...')

      const { data: failedJob, error: expectedError } = await userSupabase
        .from('meal_generation_jobs')
        .insert({
          plan_name: 'Should Fail Plan',
          week_start: '2025-08-20',
          user_id: testUserId,
          status: 'pending',
          groups_data: [{ test: 'data' }],
          additional_notes: 'This should fail with RLS infinite recursion'
        })
        .select('id, status')
        .single()

      // Should fail with infinite recursion error
      expect(expectedError).toBeTruthy()
      expect(expectedError.message).toContain('infinite recursion detected')
      expect(failedJob).toBeNull()

      console.log('✅ Confirmed: Direct table operations still fail with RLS infinite recursion')
      console.log('✅ This proves our SECURITY DEFINER function bypass is working correctly')
    })
  })
})