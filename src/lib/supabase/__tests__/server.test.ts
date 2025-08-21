/**
 * Unit tests for Supabase server client
 * Tests dependency resolution and client creation
 */

// Mock next/headers before importing
jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn()
}))

describe('Supabase Server Client', () => {
  let mockCookies: any
  let mockCreateServerClient: any
  let originalEnvVars: { url?: string; key?: string }

  beforeEach(() => {
    jest.clearAllMocks()

    // Backup original environment variables
    originalEnvVars = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }

    mockCookies = {
      get: jest.fn(),
      set: jest.fn()
    }

    const { cookies } = require('next/headers')
    cookies.mockReturnValue(mockCookies)

    mockCreateServerClient = require('@supabase/ssr').createServerClient
  })

  afterEach(() => {
    // Restore original environment variables
    if (originalEnvVars.url) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvVars.url
    }
    if (originalEnvVars.key) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnvVars.key
    }
    // Clear module cache to prevent issues with doMock
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('Dependency Resolution', () => {
    test('should handle missing @supabase/ssr package', async () => {
      // Simulate missing @supabase/ssr package
      jest.doMock('@supabase/ssr', () => {
        throw new Error("Module not found: Can't resolve '@supabase/ssr'")
      })

      try {
        // Clear the module cache to force re-import
        delete require.cache[require.resolve('../server')]
        const { createClient } = require('../server')
        createClient()
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).toContain("Module not found: Can't resolve '@supabase/ssr'")
      }
    })

    test('should handle missing next/headers package', async () => {
      // Simulate missing next/headers package
      jest.doMock('next/headers', () => {
        throw new Error("Module not found: Can't resolve 'next/headers'")
      })

      try {
        // Clear the module cache to force re-import
        delete require.cache[require.resolve('../server')]
        const { createClient } = require('../server')
        createClient()
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error.message).toContain("Module not found: Can't resolve 'next/headers'")
      }
    })

    test('should handle missing environment variables', () => {
      // Clear environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      mockCreateServerClient.mockImplementation((url, key) => {
        if (!url || !key) {
          throw new Error('Supabase URL and anonymous key are required')
        }
        return { mock: 'client' }
      })

      const { createClient } = require('../server')

      expect(() => createClient()).toThrow('Supabase URL and anonymous key are required')
    })
  })

  describe('Successful Client Creation', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    })

    test('should create client successfully with all dependencies', () => {
      const mockClient = { mock: 'client' }
      mockCreateServerClient.mockReturnValue(mockClient)

      const { createClient } = require('../server')
      const client = createClient()

      expect(client).toBe(mockClient)
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.any(Object)
      )
    })

    test('should handle cookie operations correctly', () => {
      const mockClient = { mock: 'client' }
      mockCreateServerClient.mockImplementation((url, key, options) => {
        // Test cookie operations
        const cookieOptions = { name: 'test', value: 'value' }
        
        // Test get operation
        mockCookies.get.mockReturnValue({ value: 'test-value' })
        const getValue = options.cookies.get('test-cookie')
        expect(getValue).toBe('test-value')

        // Test set operation (should not throw)
        expect(() => options.cookies.set('test', 'value', cookieOptions)).not.toThrow()

        // Test remove operation (should not throw)
        expect(() => options.cookies.remove('test', cookieOptions)).not.toThrow()

        return mockClient
      })

      const { createClient } = require('../server')
      const client = createClient()

      expect(client).toBe(mockClient)
    })
  })

  describe('Error Handling', () => {
    test('should handle cookie setting errors gracefully', () => {
      const mockClient = { mock: 'client' }
      mockCreateServerClient.mockImplementation((url, key, options) => {
        // Simulate cookie setting error
        mockCookies.set.mockImplementation(() => {
          throw new Error('Cannot set cookie in Server Component')
        })

        // Should not throw when setting cookies fails
        expect(() => options.cookies.set('test', 'value', {})).not.toThrow()

        return mockClient
      })

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const { createClient } = require('../server')
      const client = createClient()

      expect(client).toBe(mockClient)
    })

    test('should handle cookie removal errors gracefully', () => {
      const mockClient = { mock: 'client' }
      mockCreateServerClient.mockImplementation((url, key, options) => {
        // Simulate cookie removal error
        mockCookies.set.mockImplementation(() => {
          throw new Error('Cannot remove cookie in Server Component')
        })

        // Should not throw when removing cookies fails
        expect(() => options.cookies.remove('test', {})).not.toThrow()

        return mockClient
      })

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

      const { createClient } = require('../server')
      const client = createClient()

      expect(client).toBe(mockClient)
    })
  })
})