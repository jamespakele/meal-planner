import { createClient } from './supabase/server'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

// Get authenticated user from request using cookie-based auth
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, error: error?.message || 'Authentication required' }
    }
    
    return { user, error: null }
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

// Generate secure random token for form links
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url')
}

// Calculate Adult Equivalent based on PRD formula
export function calculateAdultEquivalent(
  adults: number,
  teens: number,
  kids: number,
  toddlers: number
): number {
  return (adults * 1.0) + (teens * 1.2) + (kids * 0.7) + (toddlers * 0.4)
}

// Validate form link token
export async function validateFormLinkToken(token: string) {
  try {
    const supabase = await createClient()
    
    const { data: formLink, error } = await supabase
      .from('form_links')
      .select('*')
      .eq('public_token', token)
      .single()
    
    if (error || !formLink) {
      return { valid: false, formLink: null, error: 'Invalid token' }
    }
    
    // Check if token has expired
    if (formLink.expires_at && new Date(formLink.expires_at) < new Date()) {
      return { valid: false, formLink: null, error: 'Token expired' }
    }
    
    return { valid: true, formLink, error: null }
  } catch (error) {
    return { valid: false, formLink: null, error: 'Token validation failed' }
  }
}

// Standard API response helpers
export function successResponse(data: any, status: number = 200) {
  return Response.json({ success: true, data }, { status })
}

export function errorResponse(message: string, status: number = 400) {
  return Response.json({ success: false, error: message }, { status })
}