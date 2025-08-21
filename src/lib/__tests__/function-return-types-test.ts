/**
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'

// Test for SECURITY DEFINER function return type matching
describe('SECURITY DEFINER Function Return Types Test', () => {
  let supabase: any
  let userSupabase: any
  let testUserId: string

  beforeAll(async () => {
    // Setup test environment
    const supabaseUrl = 'http://127.0.0.1:54321'
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Create test user
    const testUserEmail = `function-types-test-${Date.now()}@example.com`
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
  })

  afterAll(async () => {
    // Cleanup
    await supabase.auth.admin.deleteUser(testUserId)
  })

  describe('get_meal_generation_jobs Function Return Types', () => {
    it('should successfully return data after fixing function return types', async () => {
      // First create a job to query
      const { data: jobData, error: jobError } = await userSupabase.rpc('create_meal_generation_job', {
        p_plan_name: 'Type Test Plan',
        p_week_start: '2025-08-20',
        p_user_id: testUserId,
        p_groups_data: [{
          group_id: '00000000-0000-0000-0000-000000000001',
          group_name: 'Type Test Group',
          demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
          dietary_restrictions: [],
          meals_to_generate: 3,
          adult_equivalent: 2.7
        }],
        p_additional_notes: 'Testing function return types'
      })

      expect(jobError).toBeNull()
      const jobId = jobData[0].job_id

      // This should currently fail with type mismatch error
      console.log('🧪 Testing get_meal_generation_jobs function return types...')
      
      const { data: queryData, error: queryError } = await userSupabase.rpc('get_meal_generation_jobs', {
        p_user_id: testUserId,
        p_job_id: jobId
      })

      console.log('Function query result:', { queryData, queryError })

      // Expected: This should fail with "structure of query does not match function result type" error
      expect(queryError).toBeTruthy()
      expect(queryError.message).toContain('structure of query does not match function result type')
      expect(queryData).toBeNull()

      console.log('✅ Confirmed: get_meal_generation_jobs function has return type mismatch')
      console.log('📋 Error details:', queryError.details)

      // Cleanup
      await supabase.from('meal_generation_jobs').delete().eq('id', jobId)
    })

    it('should identify specific column type mismatches', async () => {
      // This test will help us identify exactly which columns have type mismatches
      // by examining the actual table schema vs function return type definition
      
      console.log('🔍 Analyzing table schema vs function return types...')
      
      // Query the actual table schema for meal_generation_jobs
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, character_maximum_length')
        .eq('table_name', 'meal_generation_jobs')
        .eq('table_schema', 'public')
        .order('ordinal_position')

      expect(schemaError).toBeNull()
      expect(schemaData).toBeTruthy()

      console.log('📊 Actual table schema:')
      schemaData.forEach((col: any, index: number) => {
        console.log(`  Column ${index + 1}: ${col.column_name} - ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`)
      })

      // Focus on the columns that are likely causing the type mismatch
      const textColumns = schemaData.filter((col: any) => 
        col.data_type === 'character varying' || col.data_type === 'text'
      )

      console.log('🎯 Text/varchar columns that might cause type mismatches:')
      textColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`)
      })

      // The error mentioned "column 8" - let's identify what that is
      if (schemaData.length >= 8) {
        const problematicColumn = schemaData[7] // 0-indexed, so column 8 is index 7
        console.log(`🚨 Column 8 (likely problematic): ${problematicColumn.column_name} - ${problematicColumn.data_type}${problematicColumn.character_maximum_length ? `(${problematicColumn.character_maximum_length})` : ''}`)
      }

      // This test is informational and should always pass
      expect(schemaData.length).toBeGreaterThan(0)
    })
  })
})