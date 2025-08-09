import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateGroup, sanitizeGroupName, GroupData } from '@/lib/groupValidation'

// GET /api/groups - List user's groups
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user's groups
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching groups:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch groups' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error fetching groups:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/groups - Create new group
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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
    const { name, adults, teens, kids, toddlers, dietary_restrictions } = body
    if (
      name === undefined ||
      adults === undefined ||
      teens === undefined ||
      kids === undefined ||
      toddlers === undefined
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, adults, teens, kids, toddlers' },
        { status: 400 }
      )
    }

    // Create group data object
    const groupData: GroupData = {
      name: sanitizeGroupName(name),
      adults,
      teens,
      kids,
      toddlers,
      dietary_restrictions: dietary_restrictions || []
    }

    // Validate group data
    const validation = validateGroup(groupData)
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      )
    }

    // Insert into database
    const { data, error } = await supabase
      .from('groups')
      .insert({
        ...groupData,
        user_id: user.id,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating group:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create group' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )

  } catch (error) {
    console.error('Unexpected error creating group:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}