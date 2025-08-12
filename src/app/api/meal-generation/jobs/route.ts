import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PlanData, validatePlan } from '@/lib/planValidation'
import { validatePlanForGeneration, buildGroupContexts } from '@/lib/mealGenerator'

interface MealGenerationJobRequest {
  planData: PlanData
}

interface MealGenerationJobResponse {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: MealGenerationJobRequest = await request.json()
    const { planData } = body

    // Validate plan data
    const validation = validatePlan(planData)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid plan data', 
          details: validation.errors 
        },
        { status: 400 }
      )
    }

    // Get user's groups from database
    const { data: availableGroups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (groupsError) {
      console.error('Error fetching groups:', groupsError)
      return NextResponse.json(
        { error: 'Failed to fetch groups' },
        { status: 500 }
      )
    }

    if (!availableGroups || availableGroups.length === 0) {
      return NextResponse.json(
        { error: 'No groups found. Please create a group first.' },
        { status: 400 }
      )
    }

    // Validate for meal generation
    const generationValidation = validatePlanForGeneration(planData, availableGroups)
    if (!generationValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Plan not suitable for meal generation', 
          details: generationValidation.errors 
        },
        { status: 400 }
      )
    }


    // Build group contexts
    const groupContexts = buildGroupContexts(planData, availableGroups)
    
    // Prepare groups data for storage
    const groupsData = groupContexts.map(context => ({
      group_id: context.group_id,
      group_name: context.group_name,
      demographics: context.demographics,
      dietary_restrictions: context.dietary_restrictions,
      meals_to_generate: context.meal_count_requested + 2, // DEFAULT_EXTRA_MEALS
      group_notes: context.group_notes,
      adult_equivalent: context.adult_equivalent
    }))

    // Create job in database
    const { data: job, error: jobError } = await supabase
      .from('meal_generation_jobs')
      .insert({
        plan_name: planData.name,
        week_start: planData.week_start,
        user_id: user.id,
        status: 'pending',
        groups_data: groupsData,
        additional_notes: planData.notes || null
      })
      .select('id, status')
      .single()

    if (jobError) {
      console.error('Error creating meal generation job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create meal generation job' },
        { status: 500 }
      )
    }
    
    // Start background processing
    processJobInBackground(job.id, user.id, groupsData, planData)

    const response: MealGenerationJobResponse = {
      jobId: job.id,
      status: job.status,
      message: 'Meal generation job started successfully'
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in meal generation job creation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // DEVELOPMENT MODE: Skip Supabase auth and use mock user
    const isDevelopment = process.env.NODE_ENV === 'development'
    let user = null
    
    if (isDevelopment) {
      // Mock user for development
      user = {
        id: 'dev-user-123',
        email: 'dev@example.com'
      }
    } else {
      // Production: Use Supabase auth
      const supabase = await createClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      user = authUser
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')

    let jobs
    if (isDevelopment) {
      // Use development storage
      jobs = await handleDevelopmentQuery(jobId || undefined, status || undefined)
    } else {
      // Use Supabase database
      const supabase = await createClient()
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
        .eq('user_id', user.id)

      if (jobId) {
        query = query.eq('id', jobId)
      }

      if (status) {
        query = query.eq('status', status)
      }

      query = query.order('created_at', { ascending: false })

      const { data: dbJobs, error } = await query

      if (error) {
        console.error('Error fetching meal generation jobs:', error)
        return NextResponse.json(
          { error: 'Failed to fetch jobs' },
          { status: 500 }
        )
      }
      
      jobs = dbJobs
    }

    return NextResponse.json({ jobs })

  } catch (error) {
    console.error('Error in meal generation job fetch:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Background job processing function
async function processJobInBackground(
  jobId: string, 
  userId: string, 
  groupsData: any[], 
  planData: PlanData
) {
  const supabase = await createClient()
  
  try {
    // Update job status to processing
    await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 10,
        current_step: 'Preparing AI request...'
      })
      .eq('id', jobId)

    // Import the meal generator functions
    const { generateMealsWithCombinedChatGPT } = await import('@/lib/mealGenerator')

    // Prepare the combined request
    const combinedRequest = {
      plan_name: planData.name,
      week_start: planData.week_start,
      additional_notes: planData.notes,
      groups: groupsData
    }

    await supabase
      .from('meal_generation_jobs')
      .update({
        progress: 30,
        current_step: 'Generating meals with AI...'
      })
      .eq('id', jobId)

    const startTime = Date.now()

    // Generate meals using AI
    const allGroupMeals = await generateMealsWithCombinedChatGPT(combinedRequest)

    const generationTime = Date.now() - startTime

    await supabase
      .from('meal_generation_jobs')
      .update({
        progress: 80,
        current_step: 'Saving generated meals...'
      })
      .eq('id', jobId)

    // Save generated meals to database
    const mealsToInsert = []
    let totalMealsGenerated = 0

    for (const [groupName, meals] of Object.entries(allGroupMeals)) {
      const groupData = groupsData.find(g => g.group_name === groupName)
      
      for (const meal of meals) {
        mealsToInsert.push({
          job_id: jobId,
          group_id: groupData?.group_id || groupName,
          group_name: groupName,
          title: meal.title,
          description: meal.description,
          prep_time: meal.prep_time,
          cook_time: meal.cook_time,
          total_time: meal.total_time,
          servings: meal.servings,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          tags: meal.tags,
          dietary_info: meal.dietary_info,
          difficulty: meal.difficulty
        })
        totalMealsGenerated++
      }
    }

    // Insert all meals
    if (mealsToInsert.length > 0) {
      const { error: mealsError } = await supabase
        .from('generated_meals')
        .insert(mealsToInsert)

      if (mealsError) {
        throw new Error(`Failed to save meals: ${mealsError.message}`)
      }
    }

    // Update job as completed
    await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'completed',
        progress: 100,
        current_step: 'Completed',
        completed_at: new Date().toISOString(),
        total_meals_generated: totalMealsGenerated,
        api_calls_made: 1,
        generation_time_ms: generationTime
      })
      .eq('id', jobId)

    // Create success notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'meal_generation_completed',
        title: 'Meal generation completed!',
        message: `${totalMealsGenerated} meals have been generated for "${planData.name}".`,
        job_id: jobId
      })

  } catch (error) {
    console.error('Background job processing failed:', error)
    
    // Update job as failed
    await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_details: { error: String(error) }
      })
      .eq('id', jobId)

    // Create failure notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'meal_generation_failed',
        title: 'Meal generation failed',
        message: `Failed to generate meals for "${planData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        job_id: jobId
      })
  }
}

// Development mode: In-memory job storage
const developmentJobs = new Map<string, any>()

// Development mode: In-memory meals storage
const developmentMeals = new Map<string, any[]>()

// Development job processing function
async function processDevelopmentJobInBackground(
  jobId: string, 
  userId: string, 
  groupsData: any[], 
  planData: PlanData
) {
  try {
    // Update job status to processing
    developmentJobs.set(jobId, {
      id: jobId,
      plan_name: planData.name,
      week_start: planData.week_start,
      status: 'processing',
      progress: 10,
      current_step: 'Preparing AI request...',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    })

    console.log(`[DEV] Processing job ${jobId}...`)

    // Import the meal generator functions
    const { generateMealsWithCombinedChatGPT } = await import('@/lib/mealGenerator')

    // Prepare the combined request
    const combinedRequest = {
      plan_name: planData.name,
      week_start: planData.week_start,
      additional_notes: planData.notes,
      groups: groupsData
    }

    // Update progress
    developmentJobs.set(jobId, {
      ...developmentJobs.get(jobId),
      progress: 30,
      current_step: 'Generating meals with AI...'
    })

    const startTime = Date.now()

    // Generate meals using AI
    const allGroupMeals = await generateMealsWithCombinedChatGPT(combinedRequest)

    const generationTime = Date.now() - startTime

    // Update progress
    developmentJobs.set(jobId, {
      ...developmentJobs.get(jobId),
      progress: 80,
      current_step: 'Saving generated meals...'
    })

    // Save generated meals to development storage
    const mealsToSave = []
    let totalMealsGenerated = 0

    for (const [groupName, meals] of Object.entries(allGroupMeals)) {
      const groupData = groupsData.find(g => g.group_name === groupName)
      
      for (const meal of meals) {
        mealsToSave.push({
          id: `dev-meal-${Date.now()}-${totalMealsGenerated}`,
          job_id: jobId,
          group_id: groupData?.group_id || groupName,
          group_name: groupName,
          title: meal.title,
          description: meal.description,
          prep_time: meal.prep_time,
          cook_time: meal.cook_time,
          total_time: meal.total_time,
          servings: meal.servings,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          tags: meal.tags,
          dietary_info: meal.dietary_info,
          difficulty: meal.difficulty,
          selected: false,
          created_at: new Date().toISOString()
        })
        totalMealsGenerated++
      }
    }

    // Store meals in development storage
    developmentMeals.set(jobId, mealsToSave)

    // Update job as completed
    developmentJobs.set(jobId, {
      ...developmentJobs.get(jobId),
      status: 'completed',
      progress: 100,
      current_step: 'Completed',
      completed_at: new Date().toISOString(),
      total_meals_generated: totalMealsGenerated,
      api_calls_made: 1,
      generation_time_ms: generationTime
    })

    console.log(`[DEV] Job ${jobId} completed with ${totalMealsGenerated} meals`)

  } catch (error) {
    console.error('[DEV] Background job processing failed:', error)
    
    // Update job as failed
    developmentJobs.set(jobId, {
      ...developmentJobs.get(jobId),
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Add development mode query handling
async function handleDevelopmentQuery(jobId?: string, status?: string) {
  const jobs = Array.from(developmentJobs.values())
  
  let filteredJobs = jobs
  
  if (jobId) {
    filteredJobs = jobs.filter(job => job.id === jobId)
  }
  
  if (status) {
    filteredJobs = filteredJobs.filter(job => job.status === status)
  }
  
  return filteredJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}