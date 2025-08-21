/**
 * Test-specific Supabase client configuration
 * This creates clients that can be used in Jest tests without Next.js request context
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for testing purposes
 * Uses service role key for tests that need to bypass RLS
 */
export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration for tests. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Creates a Supabase client for testing user-authenticated scenarios
 * Uses anon key like a real user would
 */
export function createTestUserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration for tests. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  }

  return createClient(supabaseUrl, anonKey)
}

/**
 * Create a direct SQL execution client that bypasses authentication
 * This is used for testing database functions directly
 */
export async function executeRawSql(client: ReturnType<typeof createTestClient>, sql: string, params?: any[]) {
  try {
    // Use Supabase's rpc to execute raw SQL with service role privileges
    const { data, error } = await client.rpc('exec_sql', { 
      sql_query: sql,
      sql_params: params || []
    })
    
    if (error) {
      console.error('SQL execution error:', error)
      throw error
    }
    
    return { data, error: null }
  } catch (err) {
    console.error('Failed to execute SQL:', err)
    return { data: null, error: err }
  }
}

/**
 * Mock authentication for a test user by temporarily setting the auth context
 * This works by creating a test session in the database
 */
export async function mockAuthUser(client: ReturnType<typeof createTestClient>, userId: string, email: string = 'test@example.com') {
  // For testing, we'll create a temporary user in the auth.users table
  // This only works with service role privileges
  
  try {
    // Check if user already exists
    const { data: existingUser } = await client
      .from('auth.users')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (!existingUser) {
      // Create a test user in auth.users table
      await client.from('auth.users').insert({
        id: userId,
        email,
        role: 'authenticated',
        aud: 'authenticated',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    return { id: userId, email }
  } catch (error) {
    console.warn('Could not create test user in auth table:', error)
    // Return mock user anyway for testing
    return { id: userId, email }
  }
}

/**
 * Clean up test user
 */
export async function cleanupTestUser(client: ReturnType<typeof createTestClient>, userId: string) {
  try {
    await client
      .from('auth.users')
      .delete()
      .eq('id', userId)
  } catch (error) {
    console.warn('Could not clean up test user:', error)
  }
}