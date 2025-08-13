import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePlan } from '@/lib/planValidation'
import { validatePlanForGeneration } from '@/lib/mealGenerator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in meal generation:', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: planId } = await params

    // Get the existing plan
    const { data: existingPlan, error: planError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !existingPlan) {
      console.error('Plan not found or access denied:', planError)
      return NextResponse.json(
        { error: 'Plan not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body for any additional plan data or group meal assignments
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('Invalid JSON in request body:', jsonError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Get user's groups to build the plan data for generation
    const { data: userGroups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (groupsError) {
      console.error('Error fetching user groups:', groupsError)
      return NextResponse.json(
        { error: 'Failed to fetch user groups' },
        { status: 500 }
      )
    }

    if (!userGroups || userGroups.length === 0) {
      return NextResponse.json(
        { error: 'No active groups found. Please create groups first.' },
        { status: 400 }
      )
    }

    // Build plan data structure for meal generation
    // Use group_meals from request body if provided, otherwise default to all groups with 7 meals each
    const groupMeals = body.group_meals || userGroups.map(group => ({
      group_id: group.id,
      meal_count: 7,
      notes: `Meals for ${group.name}`
    }))

    const planData = {
      name: existingPlan.name,
      week_start: existingPlan.week_start,
      notes: existingPlan.notes || '',
      group_meals: groupMeals
    }

    // Validate plan data for generation
    const validation = validatePlan(planData)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid plan data for generation',
          details: validation.errors 
        },
        { status: 400 }
      )
    }

    const generationValidation = validatePlanForGeneration(planData, userGroups)
    if (!generationValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Plan validation failed for meal generation',
          details: generationValidation.errors 
        },
        { status: 400 }
      )
    }

    // Build groups data for the meal generation job
    const groupsData = userGroups.map(group => ({
      id: group.id,
      name: group.name,
      adults: group.adults,
      teens: group.teens,
      kids: group.kids,
      toddlers: group.toddlers,
      dietary_restrictions: group.dietary_restrictions
    }))

    // Create meal generation job
    const { data: job, error: jobError } = await supabase
      .from('meal_generation_jobs')
      .insert({
        plan_name: existingPlan.name,
        week_start: existingPlan.week_start,
        user_id: user.id,
        status: 'pending',
        groups_data: groupsData,
        additional_notes: planData.notes || null
      })
      .select('id, status')
      .single()

    if (jobError) {
      console.error('Database error creating meal generation job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create meal generation job' },
        { status: 500 }
      )
    }

    // Update the plan to reference this job (optional - for tracking)
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)

    if (updateError) {
      console.warn('Warning: Could not update plan status:', updateError)
      // Don't fail the request for this - the job was created successfully
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: 'Meal generation job created successfully',
      planId: planId
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in meal generation trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}