import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const selectedOnly = searchParams.get('selectedOnly') === 'true'

    // Build query
    let query = supabase
      .from('generated_meals')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (groupId) {
      query = query.eq('group_id', groupId)
    }

    if (selectedOnly) {
      query = query.eq('selected', true)
    }

    const { data: meals, error: mealsError } = await query

    if (mealsError) {
      console.error('Error fetching meals:', mealsError)
      return NextResponse.json(
        { error: 'Failed to fetch meals' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      jobId,
      meals: meals || [],
      count: meals?.length || 0
    })

  } catch (error) {
    console.error('Error in GET /api/meal-generation/jobs/[jobId]/meals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}