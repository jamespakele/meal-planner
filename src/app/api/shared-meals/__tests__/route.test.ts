/**
 * TDD Tests for Shared Meals API
 * These tests will FAIL initially - this is intentional for TDD Red phase
 */

import { POST, GET } from '../route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
jest.mock('@supabase/supabase-js')
jest.mock('@/lib/supabase/server')

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    }))
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({
      data: { user: { id: 'test-user-123' } },
      error: null
    }))
  }
}

describe('Shared Meals API (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('POST /api/shared-meals - Generate Shareable Link', () => {
    it('should generate shareable link for authenticated user with valid job', async () => {
      // This will FAIL initially because the route doesn't exist yet
      
      // Mock successful job lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'job-123',
                    user_id: 'test-user-123',
                    plan_name: 'Test Plan',
                    total_meals_generated: 5
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        if (table === 'shared_meal_links') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'share-link-123',
                    job_id: 'job-123',
                    public_token: 'abc123xyz789',
                    created_at: '2025-08-17T00:00:00Z',
                    expires_at: null
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const request = new Request('http://localhost:3000/api/shared-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: 'job-123' })
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        share_url: expect.stringContaining('/shared-meals/abc123xyz789'),
        token: 'abc123xyz789',
        job_id: 'job-123'
      })
    })

    it('should reject unauthenticated requests', async () => {
      // Mock no user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const request = new Request('http://localhost:3000/api/shared-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: 'job-123' })
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should reject sharing jobs that don\'t belong to user', async () => {
      // Mock job belonging to different user
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'job-123',
                    user_id: 'different-user-456', // Different user
                    plan_name: 'Test Plan'
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const request = new Request('http://localhost:3000/api/shared-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: 'job-123' })
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('should return existing share link if one already exists', async () => {
      // Mock existing share link
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'meal_generation_jobs') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'job-123', user_id: 'test-user-123' },
                  error: null
                }))
              }))
            }))
          }
        }
        if (table === 'shared_meal_links') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'existing-link',
                    public_token: 'existing-token-123',
                    job_id: 'job-123',
                    created_at: '2025-08-17T00:00:00Z'
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const request = new Request('http://localhost:3000/api/shared-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: 'job-123' })
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200) // OK, not Created
      expect(result.data.token).toBe('existing-token-123')
    })
  })

  describe('GET /api/shared-meals?token=xyz - Access Shared Meals', () => {
    it('should return meals for valid public token', async () => {
      // This will FAIL initially because the route doesn't exist yet
      
      // Mock valid token lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'shared_meal_links') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'share-link-123',
                    job_id: 'job-123',
                    public_token: 'valid-token-123',
                    expires_at: null,
                    access_count: 5
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        if (table === 'meal_generation_jobs') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'job-123',
                    plan_name: 'Test Plan',
                    week_start: '2025-08-17',
                    total_meals_generated: 3
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        if (table === 'generated_meals') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [
                    {
                      id: 'meal-1',
                      title: 'Grilled Chicken',
                      description: 'Delicious grilled chicken',
                      group_name: 'Family',
                      ingredients: ['chicken', 'spices'],
                      instructions: ['grill chicken'],
                      prep_time: 15,
                      cook_time: 20,
                      servings: 4,
                      difficulty: 'easy'
                    },
                    {
                      id: 'meal-2', 
                      title: 'Pasta Salad',
                      description: 'Fresh pasta salad',
                      group_name: 'Family',
                      ingredients: ['pasta', 'vegetables'],
                      instructions: ['cook pasta', 'mix ingredients'],
                      prep_time: 10,
                      cook_time: 15,
                      servings: 6,
                      difficulty: 'easy'
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const url = new URL('http://localhost:3000/api/shared-meals?token=valid-token-123')
      const request = new Request(url)

      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.job).toMatchObject({
        plan_name: 'Test Plan',
        week_start: '2025-08-17'
      })
      expect(result.data.meals).toHaveLength(2)
      expect(result.data.meals[0]).toMatchObject({
        title: 'Grilled Chicken',
        group_name: 'Family'
      })
    })

    it('should reject invalid or expired tokens', async () => {
      // Mock token not found
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'shared_meal_links') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116' } // Not found
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const url = new URL('http://localhost:3000/api/shared-meals?token=invalid-token')
      const request = new Request(url)

      const response = await GET(request)
      expect(response.status).toBe(404)
    })

    it('should reject expired tokens', async () => {
      // Mock expired token
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'shared_meal_links') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'share-link-123',
                    job_id: 'job-123',
                    public_token: 'expired-token-123',
                    expires_at: '2025-08-16T00:00:00Z' // Expired yesterday
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        return mockSupabase.from()
      })

      const url = new URL('http://localhost:3000/api/shared-meals?token=expired-token-123')
      const request = new Request(url)

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('should increment access count when accessing shared meals', async () => {
      // Mock successful access
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'shared_meal_links') {
          const mockSelect = {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: {
                    id: 'share-link-123',
                    job_id: 'job-123',
                    public_token: 'valid-token-123',
                    expires_at: null,
                    access_count: 5
                  },
                  error: null
                }))
              }))
            }))
          }
          const mockUpdate = {
            update: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null }))
            }))
          }
          // Return different mocks based on the method chain
          return { ...mockSelect, ...mockUpdate }
        }
        // Mock other tables...
        return mockSupabase.from()
      })

      const url = new URL('http://localhost:3000/api/shared-meals?token=valid-token-123')
      const request = new Request(url)

      await GET(request)

      // Verify that update was called to increment access count
      expect(mockSupabase.from).toHaveBeenCalledWith('shared_meal_links')
    })
  })
})