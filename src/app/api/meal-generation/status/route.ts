import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Query meal generation jobs for this plan using SECURITY DEFINER function
    const { data: jobs, error: jobsError } = await supabase.rpc('get_meal_generation_jobs', {
      p_user_id: user.id,
      p_plan_name: planId
    })

    if (jobsError) {
      console.error('Error fetching meal generation jobs:', jobsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch meal generation status' },
        { status: 500 }
      )
    }

    // Query generated meals for this plan
    const { data: meals, error: mealsError } = await supabase
      .from('generated_meals')
      .select('id, job_id, group_name, title, selected')
      .in('job_id', jobs?.map((job: any) => job.id) || [])

    if (mealsError) {
      console.error('Error fetching generated meals:', mealsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch generated meals' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        jobs: jobs || [],
        meals: meals || []
      }
    })

  } catch (error) {
    console.error('Error in meal generation status check:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}