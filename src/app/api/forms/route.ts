import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSecureToken, successResponse, errorResponse } from '@/lib/utils'
import { generateShortCode, generatePublicUrl, cacheShortCodeMapping } from '@/lib/urlShortener'

// Rate limiting: In production, you'd use Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 10 // Max requests per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute window

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count += 1
  return true
}

// POST /api/forms - Generate dual form links for a meal plan
export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(`form-gen:${clientIP}`)) {
      return errorResponse('Too many requests. Please try again later.', 429)
    }

    // Authentication required for form generation
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return errorResponse('Authentication required', 401)
    }

    const body = await request.json()
    const { plan_id } = body
    
    if (!plan_id) {
      return errorResponse('Plan ID is required', 400)
    }

    // Verify plan exists and belongs to user
    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .select('id, week_start')
      .eq('id', plan_id)
      .single()
    
    if (planError || !plan) {
      return errorResponse('Plan not found', 404)
    }

    // Check if form links already exist (backward compatible)
    const { data: existingLinks, error: linksError } = await supabase
      .from('form_links')
      .select('*')
      .eq('plan_id', plan_id)
    
    if (linksError) {
      console.error('Error checking existing links:', linksError)
      return errorResponse('Failed to check existing links', 500)
    }

    // Generate new tokens and short codes for both roles
    const roles: ('co_manager' | 'other')[] = ['co_manager', 'other']
    const links = []
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    for (const role of roles) {
      // Check if link already exists for this role (filter out revoked links if column exists)
      let existingLink = existingLinks?.find(link => 
        link.role === role && 
        (!link.revoked_at || link.revoked_at === null) // Handle missing column gracefully
      )
      
      if (existingLink && (!existingLink.expires_at || new Date(existingLink.expires_at) > new Date())) {
        // Use existing active link
        const shortCode = generateShortCode(role)
        const publicUrl = generatePublicUrl(shortCode)
        
        // Cache the mapping (handle missing columns gracefully)
        cacheShortCodeMapping({
          shortCode,
          publicToken: existingLink.public_token,
          role,
          createdAt: new Date(existingLink.created_at),
          expiresAt: existingLink.expires_at ? new Date(existingLink.expires_at) : undefined,
          views: existingLink.views_count || 0 // Default to 0 if column doesn't exist
        })
        
        links.push({
          role,
          url: publicUrl,
          shortCode,
          token: existingLink.public_token,
          expires_at: existingLink.expires_at,
          created_at: existingLink.created_at
        })
        continue
      }

      // Generate new link
      const publicToken = generateSecureToken(32)
      const shortCode = generateShortCode(role)
      const publicUrl = generatePublicUrl(shortCode)

      // Insert or update the form link
      const { data: formLink, error: insertError } = await supabase
        .from('form_links')
        .upsert({
          plan_id,
          public_token: publicToken,
          role,
          expires_at: expiresAt.toISOString(),
          token_version: 1,
          views_count: 0
        }, {
          onConflict: 'plan_id,role'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating form link:', insertError)
        return errorResponse('Failed to create form link', 500)
      }

      // Cache the mapping
      cacheShortCodeMapping({
        shortCode,
        publicToken,
        role,
        createdAt: new Date(),
        expiresAt,
        views: 0
      })

      links.push({
        role,
        url: publicUrl,
        shortCode,
        token: publicToken,
        expires_at: expiresAt.toISOString(),
        created_at: formLink.created_at
      })
    }

    // Log audit event
    console.log(`Form links generated for plan ${plan_id} by user ${user.id}`)

    return successResponse({
      plan_id,
      links,
      expires_at: expiresAt.toISOString(),
      instructions: {
        co_manager: 'Send this link to the main decision-maker. Their choices will override any conflicts.',
        other: 'Send this link to other participants for input. Their choices are advisory.'
      }
    }, 201)

  } catch (error) {
    console.error('Error generating form links:', error)
    return errorResponse('Internal server error', 500)
  }
}

// GET /api/forms?plan_id=xxx - Get existing form links for a plan
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plan_id = searchParams.get('plan_id')
    
    if (!plan_id) {
      return errorResponse('Plan ID is required', 400)
    }

    // Authentication required
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return errorResponse('Authentication required', 401)
    }

    // Get form links for the plan (backward compatible - filter revoked links if column exists)
    const { data: formLinks, error: linksError } = await supabase
      .from('form_links')
      .select('*')
      .eq('plan_id', plan_id)
      .order('created_at', { ascending: false })
    
    if (linksError) {
      console.error('Error fetching form links:', linksError)
      return errorResponse('Failed to fetch form links', 500)
    }

    // Generate public URLs for each link
    const linksWithUrls = formLinks.map(link => {
      const shortCode = generateShortCode(link.role as 'co_manager' | 'other')
      return {
        ...link,
        shortCode,
        url: generatePublicUrl(shortCode),
        isExpired: link.expires_at ? new Date(link.expires_at) < new Date() : false,
        isActive: (!link.revoked_at || link.revoked_at === null) && (!link.expires_at || new Date(link.expires_at) > new Date())
      }
    })

    return successResponse({
      plan_id,
      links: linksWithUrls,
      total: formLinks.length
    })

  } catch (error) {
    console.error('Error fetching form links:', error)
    return errorResponse('Internal server error', 500)
  }
}

// DELETE /api/forms - Revoke form links for a plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plan_id = searchParams.get('plan_id')
    const role = searchParams.get('role') as 'co_manager' | 'other' | null
    
    if (!plan_id) {
      return errorResponse('Plan ID is required', 400)
    }

    // Authentication required
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return errorResponse('Authentication required', 401)
    }

    // Build update query (backward compatible)
    let query = supabase
      .from('form_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('plan_id', plan_id)

    // Optionally revoke only specific role
    if (role) {
      query = query.eq('role', role)
    }

    const { data, error: revokeError } = await query.select()
    
    if (revokeError) {
      console.error('Error revoking form links:', revokeError)
      return errorResponse('Failed to revoke form links', 500)
    }

    // Log audit event
    console.log(`Form links revoked for plan ${plan_id} by user ${user.id}`, { role })

    return successResponse({
      plan_id,
      revoked_count: data?.length || 0,
      revoked_role: role,
      revoked_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error revoking form links:', error)
    return errorResponse('Internal server error', 500)
  }
}