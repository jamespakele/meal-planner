import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateGroup, sanitizeGroupName, GroupData } from '@/lib/groupValidation'

// GET /api/groups - List user's groups
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in groups API:', authError)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Fetch user's groups from Supabase
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (groupsError) {
      console.error('Error fetching groups:', groupsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch groups' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { success: true, data: groups || [] },
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
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in groups API:', authError)
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

    // Insert group into Supabase
    const { data: createdGroup, error: insertError } = await supabase
      .from('groups')
      .insert({
        ...groupData,
        user_id: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating group:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create group' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: createdGroup },
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

// DELETE /api/groups - Delete a group
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in groups DELETE:', authError)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get group ID from query parameters
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('id')

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'Group ID is required' },
        { status: 400 }
      )
    }

    // Delete the group (RLS will ensure user can only delete their own groups)
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (deleteError) {
      console.error('Error deleting group:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete group' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Group deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error deleting group:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/groups - Update a group
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in groups PUT:', authError)
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
    const { id, name, adults, teens, kids, toddlers, dietary_restrictions } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Group ID is required' },
        { status: 400 }
      )
    }

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

    // Update group in Supabase (RLS will ensure user can only update their own groups)
    const { data: updatedGroup, error: updateError } = await supabase
      .from('groups')
      .update(groupData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating group:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update group' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: updatedGroup },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error updating group:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}