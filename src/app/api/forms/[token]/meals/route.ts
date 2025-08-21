import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { successResponse, errorResponse } from '@/lib/utils'
import { resolveShortCode, incrementShortCodeViews } from '@/lib/urlShortener'

// Simple in-memory cache for meal data (in production, use Redis)
const mealDataCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

function getCachedData(key: string): any | null {
  const cached = mealDataCache.get(key)
  if (!cached) return null
  
  if (Date.now() > cached.timestamp + cached.ttl) {
    mealDataCache.delete(key)
    return null
  }
  
  return cached.data
}

function setCachedData(key: string, data: any, ttl: number = CACHE_TTL): void {
  mealDataCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  })
  
  // Simple cleanup - remove oldest entries if cache gets too large
  if (mealDataCache.size > 1000) {
    const entries = Array.from(mealDataCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    // Remove oldest 100 entries
    for (let i = 0; i < 100; i++) {
      mealDataCache.delete(entries[i][0])
    }
  }
}

// GET /api/forms/[token]/meals - Get meal data for public form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    if (!token) {
      return errorResponse('Token is required', 400)
    }

    // Check cache first
    const cacheKey = `meals:${token}`
    const cachedData = getCachedData(cacheKey)
    if (cachedData) {
      // Increment view count for analytics
      incrementShortCodeViews(token)
      return successResponse(cachedData)
    }

    // Resolve short code to public token if needed
    let publicToken = token
    const shortCodeMapping = resolveShortCode(token)
    if (shortCodeMapping) {
      publicToken = shortCodeMapping.publicToken
      incrementShortCodeViews(token)
    }

    // Use service role for public access (no RLS)
    const supabase = await createClient()
    
    // Validate the token and get form link info
    const { data: formLink, error: tokenError } = await supabase
      .from('active_form_links')
      .select(`
        *,
        plans!inner (
          id,
          week_start,
          groups!inner (
            id,
            name,
            adults,
            teens,
            kids,
            toddlers,
            dietary_restrictions
          )
        )
      `)
      .eq('public_token', publicToken)
      .single()
    
    if (tokenError || !formLink) {
      return errorResponse('Invalid or expired token', 401)
    }

    // Increment analytics counter
    await supabase.rpc('increment_form_link_views', { token_value: publicToken })
    
    // Get meal generation job for this plan
    const { data: jobs, error: jobError } = await supabase
      .from('meal_generation_jobs')
      .select('id, plan_name, week_start, status, total_meals_generated')
      .eq('plan_name', formLink.plans.id) // This might need adjustment based on your schema
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (jobError || !jobs || jobs.length === 0) {
      return errorResponse('No meals found for this plan', 404)
    }

    const job = jobs[0]

    // Get generated meals for this job
    const { data: meals, error: mealsError } = await supabase
      .from('generated_meals')
      .select(`
        id,
        job_id,
        group_id,
        group_name,
        title,
        description,
        prep_time,
        cook_time,
        total_time,
        servings,
        ingredients,
        instructions,
        tags,
        dietary_info,
        difficulty,
        selected,
        created_at
      `)
      .eq('job_id', job.id)
      .order('group_name', { ascending: true })
      .order('title', { ascending: true })
    
    if (mealsError) {
      console.error('Error fetching meals:', mealsError)
      return errorResponse('Failed to fetch meals', 500)
    }

    // Get any existing form responses for this token (to show current selections)
    const { data: existingResponses, error: responsesError } = await supabase
      .from('form_responses')
      .select('selections, submitted_at')
      .eq('form_link_id', formLink.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
    
    // Don't fail if we can't get responses - just proceed without them
    const currentSelections = existingResponses?.[0]?.selections || []

    // Build response data
    const responseData = {
      token: token,
      role: formLink.role,
      plan: {
        id: formLink.plans.id,
        week_start: formLink.plans.week_start,
        group: {
          id: formLink.plans.groups.id,
          name: formLink.plans.groups.name,
          adults: formLink.plans.groups.adults,
          teens: formLink.plans.groups.teens,
          kids: formLink.plans.groups.kids,
          toddlers: formLink.plans.groups.toddlers,
          dietary_restrictions: formLink.plans.groups.dietary_restrictions
        }
      },
      job: {
        id: job.id,
        status: job.status,
        total_meals: job.total_meals_generated
      },
      meals: meals || [],
      current_selections: currentSelections,
      form_info: {
        role: formLink.role,
        can_override: formLink.role === 'co_manager',
        expires_at: formLink.expires_at,
        views_count: formLink.views_count || 0,
        instructions: formLink.role === 'co_manager' 
          ? 'Your selections will be final and override any conflicts with other participants.'
          : 'Your selections will be considered along with the co-manager\'s choices. The co-manager has final say in case of conflicts.'
      },
      meta: {
        total_meals: meals?.length || 0,
        groups_represented: Array.from(new Set(meals?.map(m => m.group_name) || [])),
        cached: false
      }
    }

    // Cache the response
    setCachedData(cacheKey, responseData)

    return successResponse(responseData)

  } catch (error) {
    console.error('Error fetching public meal data:', error)
    return errorResponse('Internal server error', 500)
  }
}

// HEAD /api/forms/[token]/meals - Check if token is valid (for preflight checks)
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    if (!token) {
      return new NextResponse(null, { status: 400 })
    }

    // Quick token validation
    let publicToken = token
    const shortCodeMapping = resolveShortCode(token)
    if (shortCodeMapping) {
      publicToken = shortCodeMapping.publicToken
    }

    const supabase = await createClient()
    const { data: formLink, error } = await supabase
      .from('active_form_links')
      .select('id, role, expires_at')
      .eq('public_token', publicToken)
      .single()
    
    if (error || !formLink) {
      return new NextResponse(null, { status: 401 })
    }

    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-Form-Role': formLink.role,
        'X-Expires-At': formLink.expires_at || '',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error validating token:', error)
    return new NextResponse(null, { status: 500 })
  }
}