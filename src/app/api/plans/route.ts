import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthenticatedUser, successResponse, errorResponse, generateSecureToken } from '@/lib/utils'

// POST /api/plans - Create new plan with dual form links
export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  
  if (authError || !user) {
    return errorResponse('Authentication required', 401)
  }

  try {
    const body = await request.json()
    const { group_id, week_start } = body
    
    if (!group_id || !week_start) {
      return errorResponse('Group ID and week start date are required', 400)
    }
    
    const supabase = createServerClient()
    
    // Verify user owns the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', group_id)
      .eq('user_id', user.id)
      .single()
    
    if (groupError || !group) {
      return errorResponse('Group not found or access denied', 404)
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
      return errorResponse('Failed to create plan', 500)
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
      return errorResponse('Failed to create form links', 500)
    }
    
    return successResponse({
      plan,
      form_links: formLinks,
      urls: {
        co_manager: `${process.env.NEXTAUTH_URL}/form/${coManagerToken}`,
        other: `${process.env.NEXTAUTH_URL}/form/${otherToken}`
      }
    }, 201)
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}

// GET /api/plans - List user's plans
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  
  if (authError || !user) {
    return errorResponse('Authentication required', 401)
  }

  try {
    const supabase = createServerClient()
    
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
      return errorResponse('Failed to fetch plans', 500)
    }
    
    return successResponse(plans)
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}