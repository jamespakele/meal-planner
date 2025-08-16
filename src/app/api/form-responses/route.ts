import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateFormLinkToken, successResponse, errorResponse } from '@/lib/utils'

// POST /api/form-responses - Submit form response (public endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, selections, comments } = body
    
    if (!token || !selections) {
      return errorResponse('Token and selections are required', 400)
    }
    
    // Validate token
    const { valid, formLink, error: tokenError } = await validateFormLinkToken(token)
    
    if (!valid || !formLink) {
      return errorResponse(tokenError || 'Invalid token', 401)
    }
    
    const supabase = await createClient()
    
    // Submit the response
    const { data: response, error } = await supabase
      .from('form_responses')
      .insert({
        form_link_id: formLink.id,
        form_link_role: formLink.role,
        selections,
        comments: comments || null
      })
      .select()
      .single()
    
    if (error) {
      return errorResponse('Failed to submit response', 500)
    }
    
    // If this is a co_manager response, we might need to trigger conflict resolution
    // For now, just return success - conflict resolution will happen during plan finalization
    
    return successResponse({
      response,
      message: `Response submitted as ${formLink.role}`
    }, 201)
    
  } catch (error) {
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