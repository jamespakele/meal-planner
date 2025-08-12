/**
 * Singleton Supabase client pattern to prevent multiple client instances
 * and resolve site hanging issues caused by per-render client creation
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { recordClientAccess, recordError, resetClientMonitor } from './monitoring'

// Global singleton instance
let supabaseInstance: SupabaseClient<Database> | null = null

/**
 * Get or create singleton Supabase client instance
 * This prevents creating multiple clients on every render
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  // Record client access for monitoring
  recordClientAccess()
  
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  // Create new instance only if none exists
  try {
    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
    
    // Add debug logging in development only
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Supabase singleton client created')
    }
    
    return supabaseInstance
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    recordError('client-creation', error as Error)
    throw new Error('Failed to initialize Supabase client')
  }
}

/**
 * Reset singleton instance (mainly for testing)
 */
export function resetSupabaseClient(): void {
  if (supabaseInstance) {
    // Clean up any subscriptions if needed
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Resetting Supabase singleton client')
    }
  }
  supabaseInstance = null
  
  // Reset monitoring when client is reset
  resetClientMonitor()
}

/**
 * Check if client instance exists (for debugging/monitoring)
 */
export function hasSupabaseClient(): boolean {
  return supabaseInstance !== null
}

/**
 * Get client instance count (for monitoring)
 */
export function getClientInstanceInfo() {
  return {
    hasInstance: hasSupabaseClient(),
    created: supabaseInstance ? true : false,
    timestamp: supabaseInstance ? new Date().toISOString() : null
  }
}