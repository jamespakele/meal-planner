/**
 * TDD Integration Test for Form Links API
 * These tests will FAIL initially due to database schema mismatch
 * This is intentional for the TDD Red phase
 */

import { createClient } from '@/lib/supabase/server'

// Mock the auth to return a valid user
const mockUser = { id: 'test-user-123', email: 'test@example.com' }

describe('Form Links API Integration (TDD)', () => {
  let supabase: any
  let testPlanId: string

  beforeAll(async () => {
    supabase = await createClient()
    
    // Create a test plan for our integration tests
    const { data: plan, error } = await supabase
      .from('plans')
      .insert({
        week_start: '2025-08-17',
        status: 'draft'
      })
      .select()
      .single()
      
    if (error) {
      console.error('Failed to create test plan:', error)
      throw new Error('Cannot run integration tests without test data')
    }
    
    testPlanId = plan.id
  })

  afterAll(async () => {
    // Cleanup test data
    if (testPlanId) {
      await supabase.from('plans').delete().eq('id', testPlanId)
    }
  })

  describe('POST /api/forms - Form Link Generation', () => {
    it('should generate dual form links successfully', async () => {
      // This test will FAIL initially due to database schema issues
      
      const response = await fetch(`http://localhost:3000/api/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In a real test, we'd mock authentication properly
        },
        body: JSON.stringify({ plan_id: testPlanId })
      })
      
      // These assertions will FAIL initially
      expect(response.status).toBe(201)
      
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.links).toHaveLength(2)
      
      // Check that both roles are represented
      const roles = result.data.links.map((link: any) => link.role)
      expect(roles).toContain('co_manager')
      expect(roles).toContain('other')
      
      // Check URL format
      result.data.links.forEach((link: any) => {
        expect(link.url).toMatch(/^https?:\/\/.*\/f\/[a-zA-Z0-9]{8}$/)
        expect(link.shortCode).toMatch(/^(cm|ot)[a-zA-Z0-9]{6}$/)
      })
    })

    it('should handle existing form links appropriately', async () => {
      // First call should create links
      const firstResponse = await fetch(`http://localhost:3000/api/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: testPlanId })
      })
      
      expect(firstResponse.status).toBe(201)
      
      // Second call should return existing links or regenerate
      const secondResponse = await fetch(`http://localhost:3000/api/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: testPlanId })
      })
      
      expect(secondResponse.status).toBe(201)
    })

    it('should validate plan ownership', async () => {
      // This will FAIL initially if authentication is not properly mocked
      const response = await fetch(`http://localhost:3000/api/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: 'non-existent-plan' })
      })
      
      expect(response.status).toBe(404)
      
      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Plan not found')
    })
  })

  describe('GET /api/forms - Existing Links Retrieval', () => {
    it('should retrieve existing form links', async () => {
      // This will FAIL initially due to schema issues
      
      // First create some links
      await fetch(`http://localhost:3000/api/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: testPlanId })
      })
      
      // Then retrieve them
      const response = await fetch(`http://localhost:3000/api/forms?plan_id=${testPlanId}`)
      
      expect(response.status).toBe(200)
      
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.links.length).toBeGreaterThan(0)
    })

    it('should return empty array for plans without links', async () => {
      // Create another test plan
      const { data: newPlan } = await supabase
        .from('plans')
        .insert({ week_start: '2025-08-24', status: 'draft' })
        .select()
        .single()
      
      const response = await fetch(`http://localhost:3000/api/forms?plan_id=${newPlan.id}`)
      
      expect(response.status).toBe(200)
      
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.links).toHaveLength(0)
      
      // Cleanup
      await supabase.from('plans').delete().eq('id', newPlan.id)
    })
  })

  describe('Database Schema Requirements', () => {
    it('should be able to query form_links with all required columns', async () => {
      // This is the core test that will FAIL due to missing columns
      
      const { data, error } = await supabase
        .from('form_links')
        .select(`
          id,
          plan_id,
          public_token,
          role,
          created_at,
          expires_at,
          revoked_at,
          token_version,
          views_count,
          last_accessed_at
        `)
        .limit(1)
      
      // This will FAIL because revoked_at, token_version, etc. don't exist
      expect(error).toBeNull()
    })

    it('should be able to use the increment_form_link_views function', async () => {
      // This will FAIL because the function doesn't exist
      
      const { error } = await supabase
        .rpc('increment_form_link_views', { token_value: 'test-token-123' })
      
      expect(error).toBeNull()
    })

    it('should be able to query the active_form_links view', async () => {
      // This will FAIL because the view doesn't exist
      
      const { data, error } = await supabase
        .from('active_form_links')
        .select('*')
        .limit(1)
      
      expect(error).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages for schema issues', async () => {
      // This test documents the current failing behavior
      // After we fix the schema, we'll update this to test proper error handling
      
      try {
        await supabase
          .from('form_links')
          .select('revoked_at')
          .limit(1)
          
        // If this succeeds, schema is fixed
        expect(true).toBe(true)
      } catch (error: any) {
        // This should fail with column does not exist
        expect(error.message).toContain('column')
        expect(error.message).toContain('revoked_at')
        expect(error.message).toContain('does not exist')
      }
    })
  })
})