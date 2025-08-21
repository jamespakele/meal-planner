/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../../app/api/meal-generation/jobs/route'
import { GET as StatusGET } from '../../app/api/meal-generation/status/route'
import { createClient } from '@supabase/supabase-js'

// Test that API routes now use SECURITY DEFINER functions and bypass RLS issues
describe('API Routes Bypass Test', () => {
  let supabase: any
  let testUserId: string
  let userSupabase: any

  beforeAll(async () => {
    // Use hardcoded local Supabase for testing
    const supabaseUrl = 'http://127.0.0.1:54321'
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create test user
    const testUserEmail = `api-test-${Date.now()}@example.com`
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: 'test-password-123',
      email_confirm: true
    })

    expect(signUpError).toBeNull()
    testUserId = authData.user.id

    // Create authenticated client for user
    userSupabase = createClient(
      'http://127.0.0.1:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    )

    await userSupabase.auth.signInWithPassword({
      email: testUserEmail,
      password: 'test-password-123'
    })

    // Create test group
    await userSupabase.from('groups').insert({
      name: 'API Test Group',
      user_id: testUserId,
      adults: 2,
      teens: 0,
      kids: 1,
      toddlers: 0,
      dietary_restrictions: [],
      status: 'active'
    })
  })

  afterAll(async () => {
    // Cleanup
    await supabase.auth.admin.deleteUser(testUserId)
  })

  describe('Meal Generation Jobs API', () => {
    it('should successfully create meal generation job using SECURITY DEFINER functions', async () => {
      // This test verifies that the API routes no longer fail with RLS infinite recursion
      
      const planData = {
        name: 'API Test Plan',
        week_start: '2025-08-20',
        group_meals: [
          {
            group_name: 'API Test Group',
            meal_count_requested: 3
          }
        ],
        notes: 'Testing API bypass'
      }

      const request = new NextRequest('http://localhost:3000/api/meal-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({ planData }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Mock the createClient to return our authenticated user
      jest.mock('@/lib/supabase/server', () => ({
        createClient: jest.fn(() => Promise.resolve(userSupabase))
      }))

      const response = await POST(request)
      const data = await response.json()

      console.log('API Response:', { status: response.status, data })

      // Should succeed without RLS infinite recursion error
      expect(response.status).toBe(200)
      expect(data.jobId).toBeTruthy()
      expect(data.status).toBe('pending')
      expect(data.message).toContain('successfully')

      console.log('✓ API route successfully created meal generation job using SECURITY DEFINER functions')
      
      // Store job ID for cleanup
      const jobId = data.jobId
      
      // Cleanup the created job
      await supabase.from('meal_generation_jobs').delete().eq('id', jobId)
    })
  })

  describe('Meal Generation Status API', () => {
    it('should successfully query job status using SECURITY DEFINER functions', async () => {
      // First create a job directly using the function
      const { data: jobData } = await userSupabase.rpc('create_meal_generation_job', {
        p_plan_name: 'Status Test Plan',
        p_week_start: '2025-08-20',
        p_user_id: testUserId,
        p_groups_data: [{
          group_id: '00000000-0000-0000-0000-000000000001',
          group_name: 'Status Test Group',
          demographics: { adults: 2, teens: 0, kids: 1, toddlers: 0 },
          dietary_restrictions: [],
          meals_to_generate: 3,
          adult_equivalent: 2.7
        }],
        p_additional_notes: 'Testing status API'
      })

      const jobId = jobData[0].job_id

      // Mock the createClient to return our authenticated user
      jest.mock('@/lib/supabase/server', () => ({
        createClient: jest.fn(() => Promise.resolve(userSupabase))
      }))

      const request = new NextRequest(`http://localhost:3000/api/meal-generation/status?planId=${encodeURIComponent('Status Test Plan')}`)

      const response = await StatusGET(request)
      const data = await response.json()

      console.log('Status API Response:', { status: response.status, data })

      // Should succeed without RLS issues
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.jobs).toBeTruthy()
      expect(Array.isArray(data.data.jobs)).toBe(true)

      console.log('✓ Status API successfully queried jobs using SECURITY DEFINER functions')

      // Cleanup
      await supabase.from('meal_generation_jobs').delete().eq('id', jobId)
    })
  })
})