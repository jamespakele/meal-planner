/**
 * Performance tests for Supabase client management
 * Tests singleton pattern, memory usage, and client reuse efficiency
 */

import { 
  getSupabaseClient, 
  resetSupabaseClient, 
  hasSupabaseClient, 
  getClientInstanceInfo 
} from '../singleton'

// Mock the createBrowserClient to avoid actual network calls
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis()
    }))
  }))
}))

describe('Supabase Client Performance Tests', () => {
  beforeEach(() => {
    // Reset singleton before each test
    resetSupabaseClient()
    jest.clearAllMocks()
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  afterEach(() => {
    resetSupabaseClient()
  })

  describe('Singleton Pattern Performance', () => {
    test('should create client instance only once across multiple calls', () => {
      const startTime = performance.now()
      
      // Call getSupabaseClient multiple times
      const client1 = getSupabaseClient()
      const client2 = getSupabaseClient()
      const client3 = getSupabaseClient()
      const client4 = getSupabaseClient()
      const client5 = getSupabaseClient()
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // All calls should return the same instance
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
      expect(client3).toBe(client4)
      expect(client4).toBe(client5)

      // Execution should be fast (subsequent calls should be instant)
      expect(executionTime).toBeLessThan(10) // Less than 10ms

      // Should have instance after creation
      expect(hasSupabaseClient()).toBe(true)
    })

    test('should handle rapid concurrent client requests efficiently', async () => {
      const startTime = performance.now()
      
      // Simulate concurrent requests for client
      const promises = Array.from({ length: 100 }, () => 
        Promise.resolve(getSupabaseClient())
      )
      
      const clients = await Promise.all(promises)
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // All clients should be the same instance
      const firstClient = clients[0]
      clients.forEach(client => {
        expect(client).toBe(firstClient)
      })

      // Should handle concurrent requests quickly
      expect(executionTime).toBeLessThan(50) // Less than 50ms for 100 concurrent calls
    })

    test('should minimize memory allocation with singleton pattern', () => {
      const initialMemory = process.memoryUsage()
      
      // Create multiple references to the same client
      const clients = []
      for (let i = 0; i < 1000; i++) {
        clients.push(getSupabaseClient())
      }
      
      const finalMemory = process.memoryUsage()
      
      // All should be the same instance (no additional memory per call)
      const uniqueClients = new Set(clients)
      expect(uniqueClients.size).toBe(1)
      
      // Memory increase should be minimal (not proportional to number of calls)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      expect(memoryIncrease).toBeLessThan(1024 * 1024) // Less than 1MB increase
    })
  })

  describe('Client Instance Metrics', () => {
    test('should provide accurate instance information', () => {
      // Initially no instance
      expect(hasSupabaseClient()).toBe(false)
      
      const infoBeforeCreation = getClientInstanceInfo()
      expect(infoBeforeCreation.hasInstance).toBe(false)
      expect(infoBeforeCreation.created).toBe(false)
      expect(infoBeforeCreation.timestamp).toBe(null)

      // Create client
      const client = getSupabaseClient()
      expect(client).toBeDefined()

      // Should have instance after creation
      expect(hasSupabaseClient()).toBe(true)
      
      const infoAfterCreation = getClientInstanceInfo()
      expect(infoAfterCreation.hasInstance).toBe(true)
      expect(infoAfterCreation.created).toBe(true)
      expect(infoAfterCreation.timestamp).toBeTruthy()
    })

    test('should handle reset operation cleanly', () => {
      // Create client
      const client = getSupabaseClient()
      expect(hasSupabaseClient()).toBe(true)

      // Reset
      const resetStartTime = performance.now()
      resetSupabaseClient()
      const resetEndTime = performance.now()
      const resetTime = resetEndTime - resetStartTime

      // Reset should be fast
      expect(resetTime).toBeLessThan(5) // Less than 5ms

      // Should not have instance after reset
      expect(hasSupabaseClient()).toBe(false)

      // New client should be different instance
      const newClient = getSupabaseClient()
      expect(newClient).not.toBe(client)
      expect(hasSupabaseClient()).toBe(true)
    })
  })

  describe('Error Handling Performance', () => {
    test('should handle missing environment variables efficiently', () => {
      // Reset client first
      resetSupabaseClient()
      
      // Remove environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const startTime = performance.now()
      
      expect(() => {
        getSupabaseClient()
      }).toThrow('Missing required environment variables')
      
      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Error handling should be fast
      expect(executionTime).toBeLessThan(5) // Less than 5ms
      
      // Should not have created an instance
      expect(hasSupabaseClient()).toBe(false)
    })

    test('should not leak memory on repeated error conditions', () => {
      resetSupabaseClient()
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const initialMemory = process.memoryUsage()
      
      // Try to create client multiple times with missing env vars
      for (let i = 0; i < 100; i++) {
        try {
          getSupabaseClient()
        } catch (error) {
          // Expected error
        }
      }
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Should not leak significant memory on errors
      expect(memoryIncrease).toBeLessThan(100 * 1024) // Less than 100KB increase
      expect(hasSupabaseClient()).toBe(false)
    })
  })

  describe('Real-world Performance Scenarios', () => {
    test('should handle typical component mount/unmount cycles efficiently', () => {
      const performanceMetrics = {
        mounts: 0,
        unmounts: 0,
        totalTime: 0
      }

      // Simulate multiple component mount/unmount cycles
      for (let cycle = 0; cycle < 50; cycle++) {
        const startTime = performance.now()
        
        // Component mounts and requests client
        const client = getSupabaseClient()
        expect(client).toBeDefined()
        performanceMetrics.mounts++
        
        // Component unmounts (client stays in memory due to singleton)
        // No explicit cleanup needed for singleton
        performanceMetrics.unmounts++
        
        const endTime = performance.now()
        performanceMetrics.totalTime += (endTime - startTime)
      }

      // Average time per cycle should be very low
      const averageTimePerCycle = performanceMetrics.totalTime / 50
      expect(averageTimePerCycle).toBeLessThan(1) // Less than 1ms per cycle

      expect(performanceMetrics.mounts).toBe(50)
      expect(performanceMetrics.unmounts).toBe(50)
      expect(hasSupabaseClient()).toBe(true) // Client should still exist
    })

    test('should handle high-frequency database operations setup efficiently', async () => {
      const client = getSupabaseClient()
      const startTime = performance.now()
      
      // Simulate setting up multiple database operation chains
      const operations = []
      for (let i = 0; i < 200; i++) {
        operations.push(
          client.from('test_table')
            .select('*')
            .eq('id', i)
        )
      }
      
      const endTime = performance.now()
      const setupTime = endTime - startTime

      // Setting up operations should be fast
      expect(setupTime).toBeLessThan(100) // Less than 100ms for 200 operations setup
      expect(operations).toHaveLength(200)
      
      // All operations should use the same client instance
      operations.forEach(op => {
        expect(op).toBeDefined()
      })
    })

    test('should maintain performance under memory pressure simulation', () => {
      // Create client first
      const client = getSupabaseClient()
      
      // Simulate memory pressure by creating large objects
      const memoryPressure = []
      for (let i = 0; i < 10; i++) {
        memoryPressure.push(new Array(10000).fill('memory-pressure-data'))
      }
      
      const startTime = performance.now()
      
      // Client access should still be fast under memory pressure
      for (let i = 0; i < 100; i++) {
        const clientAccess = getSupabaseClient()
        expect(clientAccess).toBe(client) // Same instance
      }
      
      const endTime = performance.now()
      const accessTime = endTime - startTime
      
      // Should maintain performance under memory pressure
      expect(accessTime).toBeLessThan(20) // Less than 20ms for 100 accesses
      
      // Cleanup memory pressure
      memoryPressure.length = 0
    })
  })

  describe('Development vs Production Performance', () => {
    test('should handle debug logging efficiently in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      // Mock console.log to capture calls
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      resetSupabaseClient()
      
      const startTime = performance.now()
      const client = getSupabaseClient()
      const endTime = performance.now()
      const creationTime = endTime - startTime
      
      // Should log in development but still be fast
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Supabase singleton client created')
      expect(creationTime).toBeLessThan(10) // Less than 10ms even with logging
      
      // Subsequent calls should not log
      consoleSpy.mockClear()
      const client2 = getSupabaseClient()
      expect(consoleSpy).not.toHaveBeenCalled()
      expect(client2).toBe(client)
      
      // Cleanup
      consoleSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    test('should be faster in production without debug logging', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      resetSupabaseClient()
      
      const startTime = performance.now()
      const client = getSupabaseClient()
      const endTime = performance.now()
      const creationTime = endTime - startTime
      
      // Should be very fast in production
      expect(creationTime).toBeLessThan(5) // Less than 5ms in production
      expect(client).toBeDefined()
      
      // Cleanup
      process.env.NODE_ENV = originalEnv
    })
  })
})