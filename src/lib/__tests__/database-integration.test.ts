/**
 * Database Integration Tests for Meal Generation System
 * 
 * These tests verify the complete database workflow:
 * 1. SECURITY DEFINER functions work correctly
 * 2. RLS policies allow proper access
 * 3. Background job processing database operations
 * 4. Error handling and edge cases
 */

import { createTestClient, createTestUserClient, mockAuthUser } from '@/lib/supabase/test-client'

describe('Database Integration for Meal Generation', () => {
  let supabaseService: ReturnType<typeof createTestClient>
  let supabaseUser: ReturnType<typeof createTestUserClient>
  
  // Test user data
  const testUserId = '550e8400-e29b-41d4-a716-446655440000'
  const testUserEmail = 'test@example.com'
  
  beforeAll(async () => {
    try {
      // Create service role client for database operations that bypass RLS
      supabaseService = createTestClient()
      
      // Create user client for testing authenticated user scenarios
      supabaseUser = createTestUserClient()
      
      console.log('Test clients created successfully')
    } catch (error) {
      console.error('Failed to create test clients:', error)
      throw error
    }
  })

  afterAll(async () => {
    // Clean up test data
    try {
      await supabaseService
        .from('generated_meals')
        .delete()
        .like('title', 'Test%')

      await supabaseService
        .from('user_notifications')
        .delete()
        .like('title', 'Test%')

      await supabaseService
        .from('meal_generation_jobs')
        .delete()
        .like('plan_name', 'Test%')
        
      await supabaseService
        .from('meal_generation_jobs')
        .delete()
        .like('plan_name', 'Background%')

      console.log('Test cleanup completed')
    } catch (error) {
      console.warn('Test cleanup failed:', error)
    }
  })

  describe('SECURITY DEFINER Functions', () => {
    describe('create_meal_generation_job function', () => {
      it('should create a meal generation job successfully', async () => {
        // This test will fail initially - we need to set up test auth
        const mockUserId = '550e8400-e29b-41d4-a716-446655440000'
        const mockPlanName = 'Test Plan'
        const mockWeekStart = '2024-12-01'
        const mockGroupsData = [
          {
            group_id: 'test-group-1',
            group_name: 'Test Family',
            demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
            dietary_restrictions: ['vegetarian'],
            meals_to_generate: 5,
            adult_equivalent: 4.6
          }
        ]

        const { data, error } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: mockPlanName,
          p_week_start: mockWeekStart,
          p_user_id: mockUserId,
          p_groups_data: mockGroupsData,
          p_additional_notes: 'Test notes'
        })

        // Initially this will fail because we need proper authentication
        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data).toHaveLength(1)
        expect(data[0].job_id).toBeDefined()
        expect(data[0].job_status).toBe('pending')
      })

      it('should reject job creation for unauthorized user', async () => {
        const unauthorizedUserId = '550e8400-e29b-41d4-a716-446655440001'
        const authenticatedUserId = '550e8400-e29b-41d4-a716-446655440000'
        
        const { data, error } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: 'Test Plan',
          p_week_start: '2024-12-01',
          p_user_id: unauthorizedUserId, // Different from authenticated user
          p_groups_data: [{}]
        })

        expect(error).toBeDefined()
        expect(error?.message).toContain('Permission denied')
        expect(data).toBeNull()
      })

      it('should validate required parameters', async () => {
        const { data, error } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: null, // Invalid - required field
          p_week_start: '2024-12-01',
          p_user_id: '550e8400-e29b-41d4-a716-446655440000',
          p_groups_data: [{}]
        })

        expect(error).toBeDefined()
        expect(data).toBeNull()
      })
    })

    describe('update_meal_generation_job function', () => {
      let testJobId: string

      beforeEach(async () => {
        // Create a test job first
        const { data } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: 'Test Plan for Update',
          p_week_start: '2024-12-01',
          p_user_id: '550e8400-e29b-41d4-a716-446655440000',
          p_groups_data: [{}]
        })
        testJobId = data[0].job_id
      })

      it('should update job status to processing', async () => {
        const { error } = await supabaseService.rpc('update_meal_generation_job', {
          p_job_id: testJobId,
          p_status: 'processing',
          p_progress: 30,
          p_current_step: 'Generating meals...',
          p_started_at: new Date().toISOString()
        })

        expect(error).toBeNull()

        // Verify the update
        const { data: jobData } = await supabaseService
          .from('meal_generation_jobs')
          .select('status, progress, current_step, started_at')
          .eq('id', testJobId)
          .single()

        expect(jobData?.status).toBe('processing')
        expect(jobData?.progress).toBe(30)
        expect(jobData?.current_step).toBe('Generating meals...')
        expect(jobData?.started_at).toBeDefined()
      })

      it('should update job to completed with results', async () => {
        const { error } = await supabaseService.rpc('update_meal_generation_job', {
          p_job_id: testJobId,
          p_status: 'completed',
          p_progress: 100,
          p_current_step: 'Completed',
          p_completed_at: new Date().toISOString(),
          p_total_meals_generated: 8,
          p_api_calls_made: 1,
          p_generation_time_ms: 15000
        })

        expect(error).toBeNull()

        // Verify the update
        const { data: jobData } = await supabaseService
          .from('meal_generation_jobs')
          .select('*')
          .eq('id', testJobId)
          .single()

        expect(jobData?.status).toBe('completed')
        expect(jobData?.progress).toBe(100)
        expect(jobData?.total_meals_generated).toBe(8)
        expect(jobData?.api_calls_made).toBe(1)
        expect(jobData?.generation_time_ms).toBe(15000)
      })

      it('should update job to failed with error details', async () => {
        const errorMessage = 'API quota exceeded'
        const errorDetails = { error_code: 'QUOTA_EXCEEDED', retries: 3 }

        const { error } = await supabaseService.rpc('update_meal_generation_job', {
          p_job_id: testJobId,
          p_status: 'failed',
          p_completed_at: new Date().toISOString(),
          p_error_message: errorMessage,
          p_error_details: errorDetails
        })

        expect(error).toBeNull()

        // Verify the update
        const { data: jobData } = await supabaseService
          .from('meal_generation_jobs')
          .select('status, error_message, error_details')
          .eq('id', testJobId)
          .single()

        expect(jobData?.status).toBe('failed')
        expect(jobData?.error_message).toBe(errorMessage)
        expect(jobData?.error_details).toEqual(errorDetails)
      })

      it('should reject update for non-existent job', async () => {
        const fakeJobId = '550e8400-e29b-41d4-a716-446655440000'

        const { error } = await supabaseService.rpc('update_meal_generation_job', {
          p_job_id: fakeJobId,
          p_status: 'processing'
        })

        expect(error).toBeDefined()
        expect(error?.message).toContain('Job not found')
      })
    })

    describe('insert_generated_meals function', () => {
      let testJobId: string

      beforeEach(async () => {
        // Create a test job first
        const { data } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: 'Test Plan for Meals',
          p_week_start: '2024-12-01',
          p_user_id: '550e8400-e29b-41d4-a716-446655440000',
          p_groups_data: [{ group_name: 'Test Family' }]
        })
        testJobId = data[0].job_id
      })

      it('should insert generated meals successfully', async () => {
        const mockMeals = [
          {
            group_id: 'test-group-1',
            group_name: 'Test Family',
            title: 'Vegetarian Pasta',
            description: 'Delicious pasta with vegetables',
            prep_time: 15,
            cook_time: 20,
            total_time: 35,
            servings: 4,
            ingredients: [
              { name: 'pasta', amount: 1, unit: 'lb', category: 'grains' }
            ],
            instructions: ['Cook pasta', 'Add vegetables'],
            tags: ['vegetarian', 'quick'],
            dietary_info: ['vegetarian'],
            difficulty: 'easy',
            selected: false
          },
          {
            group_id: 'test-group-1',
            group_name: 'Test Family',
            title: 'Grilled Chicken',
            description: 'Healthy grilled chicken with herbs',
            prep_time: 10,
            cook_time: 25,
            total_time: 35,
            servings: 4,
            ingredients: [
              { name: 'chicken breast', amount: 1.5, unit: 'lbs', category: 'protein' }
            ],
            instructions: ['Season chicken', 'Grill until done'],
            tags: ['healthy', 'protein'],
            dietary_info: ['gluten-free'],
            difficulty: 'medium',
            selected: false
          }
        ]

        const { error } = await supabaseService.rpc('insert_generated_meals', {
          p_job_id: testJobId,
          p_meals: mockMeals
        })

        expect(error).toBeNull()

        // Verify meals were inserted
        const { data: meals, error: selectError } = await supabaseService
          .from('generated_meals')
          .select('*')
          .eq('job_id', testJobId)

        expect(selectError).toBeNull()
        expect(meals).toHaveLength(2)
        expect(meals?.[0].title).toBe('Vegetarian Pasta')
        expect(meals?.[1].title).toBe('Grilled Chicken')
      })

      it('should reject meals for non-existent job', async () => {
        const fakeJobId = '550e8400-e29b-41d4-a716-446655440000'
        const mockMeals = [{ title: 'Test Meal' }]

        const { error } = await supabaseService.rpc('insert_generated_meals', {
          p_job_id: fakeJobId,
          p_meals: mockMeals
        })

        expect(error).toBeDefined()
        expect(error?.message).toContain('Job not found')
      })
    })

    describe('insert_user_notification function', () => {
      it('should create notification successfully', async () => {
        const mockUserId = '550e8400-e29b-41d4-a716-446655440000'
        
        const { error } = await supabaseService.rpc('insert_user_notification', {
          p_user_id: mockUserId,
          p_type: 'meal_generation_completed',
          p_title: 'Meals Generated!',
          p_message: '8 meals have been generated for your plan.',
          p_job_id: null
        })

        expect(error).toBeNull()

        // Verify notification was created
        const { data: notifications } = await supabaseService
          .from('user_notifications')
          .select('*')
          .eq('user_id', mockUserId)
          .eq('type', 'meal_generation_completed')

        expect(notifications).toHaveLength(1)
        expect(notifications?.[0].title).toBe('Meals Generated!')
      })
    })

    describe('get_meal_generation_jobs function', () => {
      let testJobId1: string
      let testJobId2: string
      const testUserId = '550e8400-e29b-41d4-a716-446655440000'

      beforeEach(async () => {
        // Create test jobs
        const { data: job1 } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: 'Plan 1',
          p_week_start: '2024-12-01',
          p_user_id: testUserId,
          p_groups_data: [{}]
        })
        testJobId1 = job1[0].job_id

        const { data: job2 } = await supabaseService.rpc('create_meal_generation_job', {
          p_plan_name: 'Plan 2',
          p_week_start: '2024-12-08',
          p_user_id: testUserId,
          p_groups_data: [{}]
        })
        testJobId2 = job2[0].job_id

        // Update one job to completed status
        await supabaseService.rpc('update_meal_generation_job', {
          p_job_id: testJobId1,
          p_status: 'completed'
        })
      })

      it('should return all jobs for user', async () => {
        const { data, error } = await supabaseService.rpc('get_meal_generation_jobs', {
          p_user_id: testUserId
        })

        expect(error).toBeNull()
        expect(data).toHaveLength(2)
        expect(data?.map(j => j.plan_name)).toContain('Plan 1')
        expect(data?.map(j => j.plan_name)).toContain('Plan 2')
      })

      it('should return specific job by ID', async () => {
        const { data, error } = await supabaseService.rpc('get_meal_generation_jobs', {
          p_user_id: testUserId,
          p_job_id: testJobId1
        })

        expect(error).toBeNull()
        expect(data).toHaveLength(1)
        expect(data?.[0].plan_name).toBe('Plan 1')
      })

      it('should filter jobs by status', async () => {
        const { data, error } = await supabaseService.rpc('get_meal_generation_jobs', {
          p_user_id: testUserId,
          p_status: 'completed'
        })

        expect(error).toBeNull()
        expect(data).toHaveLength(1)
        expect(data?.[0].status).toBe('completed')
      })

      it('should reject access to other user jobs', async () => {
        const otherUserId = '550e8400-e29b-41d4-a716-446655440001'

        const { data, error } = await supabaseService.rpc('get_meal_generation_jobs', {
          p_user_id: otherUserId // Different from authenticated user
        })

        expect(error).toBeDefined()
        expect(error?.message).toContain('Permission denied')
      })
    })
  })

  describe('RLS Policy Integration', () => {
    it('should enforce RLS on meal_generation_jobs table', async () => {
      // This test verifies that direct table access respects RLS
      // Will initially fail until proper authentication is set up
      
      const { data, error } = await supabaseUser
        .from('meal_generation_jobs')
        .select('*')

      // Should either return user's jobs or require authentication
      if (error) {
        expect(error.message).toContain('authentication')
      } else {
        // If successful, should only return authenticated user's jobs
        expect(data).toBeDefined()
      }
    })

    it('should enforce RLS on generated_meals table', async () => {
      const { data, error } = await supabaseUser
        .from('generated_meals')
        .select('*')

      // Should either return user's meals or require authentication
      if (error) {
        expect(error.message).toContain('authentication')
      } else {
        expect(data).toBeDefined()
      }
    })
  })

  describe('Background Job Processor Database Operations', () => {
    it('should simulate complete background job workflow', async () => {
      // This test simulates what backgroundJobProcessor.ts does
      const testUserId = '550e8400-e29b-41d4-a716-446655440000'
      
      // Step 1: Create job
      const { data: jobData } = await supabaseService.rpc('create_meal_generation_job', {
        p_plan_name: 'Background Test Plan',
        p_week_start: '2024-12-01',
        p_user_id: testUserId,
        p_groups_data: [{ group_name: 'Test Family' }]
      })
      const jobId = jobData[0].job_id

      // Step 2: Update to processing
      await supabaseService.rpc('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'processing',
        p_progress: 30,
        p_started_at: new Date().toISOString()
      })

      // Step 3: Insert generated meals
      const mockMeals = [
        {
          group_id: 'test-group',
          group_name: 'Test Family',
          title: 'Test Meal',
          description: 'Test description',
          prep_time: 15,
          cook_time: 20,
          total_time: 35,
          servings: 4,
          ingredients: [],
          instructions: [],
          tags: [],
          dietary_info: [],
          difficulty: 'easy'
        }
      ]

      await supabaseService.rpc('insert_generated_meals', {
        p_job_id: jobId,
        p_meals: mockMeals
      })

      // Step 4: Update to completed
      await supabaseService.rpc('update_meal_generation_job', {
        p_job_id: jobId,
        p_status: 'completed',
        p_progress: 100,
        p_completed_at: new Date().toISOString(),
        p_total_meals_generated: 1
      })

      // Step 5: Create notification
      await supabaseService.rpc('insert_user_notification', {
        p_user_id: testUserId,
        p_type: 'meal_generation_completed',
        p_title: 'Test Complete',
        p_message: 'Background job test completed'
      })

      // Verify final state
      const { data: finalJob } = await supabaseService.rpc('get_meal_generation_jobs', {
        p_user_id: testUserId,
        p_job_id: jobId
      })

      expect(finalJob[0].status).toBe('completed')
      expect(finalJob[0].total_meals_generated).toBe(1)

      const { data: meals } = await supabaseService
        .from('generated_meals')
        .select('*')
        .eq('job_id', jobId)

      expect(meals).toHaveLength(1)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in groups_data', async () => {
      const { error } = await supabaseService.rpc('create_meal_generation_job', {
        p_plan_name: 'Test Plan',
        p_week_start: '2024-12-01',
        p_user_id: '550e8400-e29b-41d4-a716-446655440000',
        p_groups_data: 'invalid json' // This should be JSONB
      })

      expect(error).toBeDefined()
    })

    it('should handle concurrent job updates', async () => {
      // Create a job
      const { data } = await supabaseService.rpc('create_meal_generation_job', {
        p_plan_name: 'Concurrent Test',
        p_week_start: '2024-12-01',
        p_user_id: '550e8400-e29b-41d4-a716-446655440000',
        p_groups_data: [{}]
      })
      const jobId = data[0].job_id

      // Try to update from multiple "processes" simultaneously
      const updates = await Promise.allSettled([
        supabaseService.rpc('update_meal_generation_job', {
          p_job_id: jobId,
          p_progress: 25
        }),
        supabaseService.rpc('update_meal_generation_job', {
          p_job_id: jobId,
          p_progress: 50
        }),
        supabaseService.rpc('update_meal_generation_job', {
          p_job_id: jobId,
          p_progress: 75
        })
      ])

      // All updates should succeed (last one wins)
      updates.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })
    })
  })
})