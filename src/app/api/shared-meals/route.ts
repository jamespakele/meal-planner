import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { successResponse, errorResponse } from '@/lib/utils'
import crypto from 'crypto'

// Generate secure random token for sharing
function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

// POST /api/shared-meals - Generate shareable link for a meal collection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Authentication required for generating share links
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return errorResponse('Authentication required', 401)
    }

    const body = await request.json()
    const { job_id, expires_in_days } = body
    
    if (!job_id) {
      return errorResponse('Job ID is required', 400)
    }

    // Verify the job exists and belongs to the user
    const { data: job, error: jobError } = await supabase
      .from('meal_generation_jobs')
      .select('id, user_id, plan_name, total_meals_generated, status')
      .eq('id', job_id)
      .single()
    
    if (jobError || !job) {
      return errorResponse('Meal generation job not found', 404)
    }

    if (job.user_id !== user.id) {
      return errorResponse('You can only share your own meal plans', 403)
    }

    if (job.status !== 'completed') {
      return errorResponse('Can only share completed meal generations', 400)
    }

    // Check if a share link already exists for this job
    const { data: existingLink, error: linkError } = await supabase
      .from('shared_meal_links')
      .select('*')
      .eq('job_id', job_id)
      .single()
    
    if (existingLink && !linkError) {
      // Return existing link
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared-meals/${existingLink.public_token}`
      
      return successResponse({
        share_url: shareUrl,
        token: existingLink.public_token,
        job_id: job_id,
        created_at: existingLink.created_at,
        expires_at: existingLink.expires_at,
        access_count: existingLink.access_count,
        last_accessed_at: existingLink.last_accessed_at,
        is_existing: true
      }, 200)
    }

    // Generate new share link
    const publicToken = generateShareToken()
    let expiresAt = null
    
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expires_in_days)
    }

    const { data: shareLink, error: insertError } = await supabase
      .from('shared_meal_links')
      .insert({
        job_id,
        public_token: publicToken,
        created_by: user.id,
        expires_at: expiresAt?.toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating share link:', insertError)
      return errorResponse('Failed to create share link', 500)
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared-meals/${publicToken}`

    // Log share creation
    console.log(`Share link created for job ${job_id} by user ${user.id}`)

    return successResponse({
      share_url: shareUrl,
      token: publicToken,
      job_id: job_id,
      created_at: shareLink.created_at,
      expires_at: shareLink.expires_at,
      access_count: 0,
      plan_name: job.plan_name,
      total_meals: job.total_meals_generated
    }, 201)

  } catch (error) {
    console.error('Error generating share link:', error)
    return errorResponse('Internal server error', 500)
  }
}

// GET /api/shared-meals?token=xyz - Access shared meals via public token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return errorResponse('Share token is required', 400)
    }

    // Use service role for public access (bypassing RLS for this specific case)
    const supabase = await createClient()

    // Verify the share link exists and is valid
    const { data: shareLink, error: linkError } = await supabase
      .from('shared_meal_links')
      .select('*')
      .eq('public_token', token)
      .single()
    
    if (linkError || !shareLink) {
      return errorResponse('Invalid or expired share link', 404)
    }

    // Check if the link has expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return errorResponse('Share link has expired', 403)
    }

    // Get the job details
    const { data: job, error: jobError } = await supabase
      .from('meal_generation_jobs')
      .select('id, plan_name, week_start, total_meals_generated, created_at')
      .eq('id', shareLink.job_id)
      .single()
    
    if (jobError || !job) {
      return errorResponse('Meal generation not found', 404)
    }

    // Get the generated meals
    const { data: meals, error: mealsError } = await supabase
      .from('generated_meals')
      .select(`
        id,
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
        created_at
      `)
      .eq('job_id', shareLink.job_id)
      .order('group_name', { ascending: true })
      .order('created_at', { ascending: true })
    
    if (mealsError) {
      console.error('Error fetching shared meals:', mealsError)
      return errorResponse('Failed to load meals', 500)
    }

    // Increment access count asynchronously (don't block response)
    supabase.rpc('increment_shared_meal_access', { token_value: token }).then(result => {
      if (result.error) {
        console.error('Failed to increment access count:', result.error)
      }
    })

    return successResponse({
      job: {
        id: job.id,
        plan_name: job.plan_name,
        week_start: job.week_start,
        total_meals_generated: job.total_meals_generated,
        created_at: job.created_at
      },
      meals: meals || [],
      share_info: {
        created_at: shareLink.created_at,
        access_count: shareLink.access_count + 1, // Include the current access
        expires_at: shareLink.expires_at
      },
      total_meals: meals?.length || 0
    })

  } catch (error) {
    console.error('Error accessing shared meals:', error)
    return errorResponse('Internal server error', 500)
  }
}