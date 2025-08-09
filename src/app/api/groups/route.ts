import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateGroup, sanitizeGroupName, GroupData } from '@/lib/groupValidation'

// GET /api/groups - List user's groups
export async function GET(request: NextRequest) {
  try {
    // For MVP with mock auth, return empty array as success
    // In production, this would connect to real Supabase with proper authentication
    
    // Mock data - in production this would come from Supabase
    const mockGroups: any[] = []
    
    return NextResponse.json(
      { success: true, data: mockGroups },
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

    // For MVP with mock auth, create mock response
    // In production, this would insert into Supabase
    const mockCreatedGroup = {
      id: `group-${Date.now()}`,
      ...groupData,
      user_id: 'mock-user-123',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return NextResponse.json(
      { success: true, data: mockCreatedGroup },
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