import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthenticatedUser, successResponse, errorResponse } from '@/lib/utils'

// GET /api/groups - List user's groups
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  
  if (authError || !user) {
    return errorResponse('Authentication required', 401)
  }

  try {
    const supabase = createServerClient()
    
    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      return errorResponse('Failed to fetch groups', 500)
    }
    
    return successResponse(groups)
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}

// POST /api/groups - Create new group
export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  
  if (authError || !user) {
    return errorResponse('Authentication required', 401)
  }

  try {
    const body = await request.json()
    const { name, adults, teens, kids, toddlers, dietary_restrictions } = body
    
    // Validate required fields
    if (!name || typeof adults !== 'number' || adults < 0) {
      return errorResponse('Invalid group data', 400)
    }
    
    const supabase = createServerClient()
    
    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name,
        adults: adults || 0,
        teens: teens || 0,
        kids: kids || 0,
        toddlers: toddlers || 0,
        dietary_restrictions: dietary_restrictions || [],
        user_id: user.id,
      })
      .select()
      .single()
    
    if (error) {
      return errorResponse('Failed to create group', 500)
    }
    
    return successResponse(group, 201)
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}