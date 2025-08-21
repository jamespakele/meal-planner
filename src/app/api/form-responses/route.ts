import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateFormLinkToken, successResponse, errorResponse } from '@/lib/utils'
import { resolveShortCode } from '@/lib/urlShortener'

// Rate limiting for form submissions
const submissionRateLimit = new Map<string, { count: number; resetTime: number }>()
const SUBMISSION_RATE_LIMIT = 5 // Max submissions per window
const SUBMISSION_RATE_WINDOW = 5 * 60 * 1000 // 5 minutes

function checkSubmissionRateLimit(key: string): boolean {
  const now = Date.now()
  const record = submissionRateLimit.get(key)
  
  if (!record || now > record.resetTime) {
    submissionRateLimit.set(key, { count: 1, resetTime: now + SUBMISSION_RATE_WINDOW })
    return true
  }
  
  if (record.count >= SUBMISSION_RATE_LIMIT) {
    return false
  }
  
  record.count += 1
  return true
}

// POST /api/form-responses - Submit form response (public endpoint)
export async function POST(request: NextRequest) {
  try {
    // Basic CSRF protection - check origin and referer
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')
    
    if (origin && host && !origin.includes(host)) {
      return errorResponse('Invalid origin', 403)
    }

    // Rate limiting by IP + user agent
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const rateLimitKey = `${clientIP}:${userAgent.substring(0, 50)}`
    
    if (!checkSubmissionRateLimit(rateLimitKey)) {
      return errorResponse('Too many submissions. Please try again later.', 429)
    }

    const body = await request.json()
    const { token, selections, comments, idempotency_key } = body
    
    if (!token || !selections) {
      return errorResponse('Token and selections are required', 400)
    }

    // Validate selections format
    if (!Array.isArray(selections)) {
      return errorResponse('Selections must be an array', 400)
    }

    // Resolve short code to public token if needed
    let publicToken = token
    const shortCodeMapping = resolveShortCode(token)
    if (shortCodeMapping) {
      publicToken = shortCodeMapping.publicToken
    }
    
    // Validate token using the public token
    const { valid, formLink, error: tokenError } = await validateFormLinkToken(publicToken)
    
    if (!valid || !formLink) {
      return errorResponse(tokenError || 'Invalid or expired token', 401)
    }
    
    const supabase = await createClient()

    // Check for duplicate submission with idempotency key
    if (idempotency_key) {
      const { data: existingResponse } = await supabase
        .from('form_responses')
        .select('id, submitted_at')
        .eq('form_link_id', formLink.id)
        .eq('selections', JSON.stringify(selections))
        .gte('submitted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Within last hour
        .limit(1)
      
      if (existingResponse && existingResponse.length > 0) {
        return successResponse({
          response: existingResponse[0],
          message: `Response already submitted as ${formLink.role}`,
          duplicate: true
        }, 200)
      }
    }

    // Sanitize comments to prevent XSS
    const sanitizedComments = comments ? 
      comments.toString().substring(0, 1000).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') 
      : null
    
    // Submit the response
    const { data: response, error } = await supabase
      .from('form_responses')
      .insert({
        form_link_id: formLink.id,
        form_link_role: formLink.role,
        selections,
        comments: sanitizedComments
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error submitting form response:', error)
      return errorResponse('Failed to submit response', 500)
    }

    // Log submission for analytics (don't log sensitive data)
    console.log(`Form response submitted for plan ${formLink.plan_id} by ${formLink.role}`, {
      response_id: response.id,
      selections_count: selections.length,
      has_comments: !!sanitizedComments,
      client_ip: clientIP.substring(0, 12) + '...' // Partial IP for privacy
    })
    
    // If this is a co_manager response, we might need to trigger conflict resolution
    // For now, just return success - conflict resolution will happen during plan finalization
    
    return successResponse({
      response: {
        id: response.id,
        submitted_at: response.submitted_at,
        role: formLink.role,
        selections_count: selections.length
      },
      message: `Response submitted as ${formLink.role}`,
      instructions: formLink.role === 'co_manager' 
        ? 'Your selections have been recorded and will override any conflicts.'
        : 'Your selections have been recorded. The co-manager will make final decisions.',
      next_steps: {
        thank_you_url: `/f/${token}/thank-you`,
        can_resubmit: true,
        manager_notified: formLink.role === 'co_manager'
      }
    }, 201)
    
  } catch (error) {
    console.error('Error in form response submission:', error)
    return errorResponse('Internal server error', 500)
  }
}

// GET /api/form-responses?plan_id=xxx - Get responses for a plan (authenticated)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')
  
  if (!planId) {
    return errorResponse('Plan ID is required', 400)
  }

  try {
    const supabase = await createClient()
    
    // Get all responses for the plan
    const { data: responses, error } = await supabase
      .from('form_responses')
      .select(`
        *,
        form_links (
          id,
          role,
          plan_id
        )
      `)
      .eq('form_links.plan_id', planId)
      .order('submitted_at', { ascending: false })
    
    if (error) {
      return errorResponse('Failed to fetch responses', 500)
    }
    
    // Group responses by role for easier processing
    const groupedResponses = {
      co_manager: responses.filter(r => r.form_link_role === 'co_manager'),
      other: responses.filter(r => r.form_link_role === 'other')
    }
    
    return successResponse({
      responses: groupedResponses,
      total: responses.length
    })
    
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}