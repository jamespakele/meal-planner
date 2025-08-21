import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSecureToken } from '@/lib/utils'

// POST /api/plans - Create new plan with dual form links
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in plans API:', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { group_id, week_start } = body
    
    if (!group_id || !week_start) {
      return NextResponse.json(
        { error: 'Group ID and week start date are required' },
        { status: 400 }
      )
    }
    
    // Verify user owns the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', group_id)
      .eq('user_id', user.id)
      .single()
    
    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Group not found or access denied' },
        { status: 404 }
      )
    }
    
    // Create the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        group_id,
        week_start,
        status: 'draft'
      })
      .select()
      .single()
    
    if (planError) {
      console.error('Database error creating plan:', planError)
      return NextResponse.json(
        { error: 'Failed to create plan' },
        { status: 500 }
      )
    }
    
    // Create dual form links
    const coManagerToken = generateSecureToken()
    const otherToken = generateSecureToken()
    
    const { data: formLinks, error: linksError } = await supabase
      .from('form_links')
      .insert([
        {
          plan_id: plan.id,
          public_token: coManagerToken,
          role: 'co_manager'
        },
        {
          plan_id: plan.id,
          public_token: otherToken,
          role: 'other'
        }
      ])
      .select()
    
    if (linksError) {
      console.error('Database error creating form links:', linksError)
      return NextResponse.json(
        { error: 'Failed to create form links' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      plan,
      form_links: formLinks,
      urls: {
        co_manager: `${process.env.NEXTAUTH_URL}/form/${coManagerToken}`,
        other: `${process.env.NEXTAUTH_URL}/form/${otherToken}`
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in plans API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/plans - List user's plans
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in plans GET:', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data: plans, error } = await supabase
      .from('plans')
      .select(`
        *,
        groups (
          id,
          name,
          adults,
          teens,
          kids,
          toddlers,
          dietary_restrictions
        ),
        form_links (
          id,
          public_token,
          role
        )
      `)
      .eq('groups.user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database error fetching plans:', error)
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Unexpected error fetching plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/plans - Delete a plan
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in plans DELETE:', authError)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get plan ID from query parameters
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('id')

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Delete the plan (RLS will ensure user can only delete their own plans through group ownership)
    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .eq('id', planId)

    if (deleteError) {
      console.error('Error deleting plan:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete plan' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Plan deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error deleting plan:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/plans - Update a plan
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in plans PUT:', authError)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    const { id, name, week_start, notes } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    if (!name || !week_start) {
      return NextResponse.json(
        { success: false, error: 'Plan name and week_start are required' },
        { status: 400 }
      )
    }

    // Create update data object
    const updateData = {
      name: name.trim(),
      week_start,
      notes: notes || null
    }

    // Update plan in Supabase (RLS will ensure user can only update their own plans through group ownership)
    const { data: updatedPlan, error: updateError } = await supabase
      .from('plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating plan:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update plan' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: updatedPlan },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error updating plan:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}