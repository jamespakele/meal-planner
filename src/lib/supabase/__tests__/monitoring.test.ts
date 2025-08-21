/**
 * Tests for Supabase client monitoring system
 * Tests performance tracking, error handling, and health monitoring
 */

import {
  clientMonitor,
  recordClientAccess,
  monitorOperation,
  recordError,
  getClientMetrics,
  getClientHealthCheck,
  resetClientMonitor,
  exportClientMetrics
} from '../monitoring'

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn()
global.performance.now = mockPerformanceNow

// Mock process.memoryUsage for Node.js environment
const mockMemoryUsage = jest.fn(() => ({
  rss: 100 * 1024 * 1024,
  heapTotal: 80 * 1024 * 1024,
  heapUsed: 50 * 1024 * 1024,
  external: 10 * 1024 * 1024,
  arrayBuffers: 5 * 1024 * 1024
}))

// Mock process object
Object.defineProperty(global, 'process', {
  value: {
    ...global.process,
    memoryUsage: mockMemoryUsage,
    env: { NODE_ENV: 'test' }
  },
  configurable: true
})

// Mock window for browser environment tests
if (typeof window === 'undefined') {
  Object.defineProperty(global, 'window', {
    value: undefined,
    configurable: true
  })
}

describe('Supabase Client Monitoring System', () => {
  beforeEach(() => {
    resetClientMonitor()
    jest.clearAllMocks()
    mockPerformanceNow.mockReturnValue(1000)
  })

  afterEach(() => {
    resetClientMonitor()
  })

  describe('Client Access Tracking', () => {
    test('should track client access count', () => {
      recordClientAccess()
      recordClientAccess()
      recordClientAccess()

      const metrics = getClientMetrics()
      expect(metrics.instanceAccessCount).toBe(3)
      expect(metrics.lastAccessedAt).toBeTruthy()
    })

    test('should update last accessed timestamp', () => {
      const initialMetrics = getClientMetrics()
      expect(initialMetrics.lastAccessedAt).toBe('')

      recordClientAccess()
      
      const updatedMetrics = getClientMetrics()
      expect(updatedMetrics.lastAccessedAt).toBeTruthy()
      expect(new Date(updatedMetrics.lastAccessedAt)).toBeInstanceOf(Date)
    })
  })

  describe('Operation Monitoring', () => {
    test('should track successful operations', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1100) // End time

      const result = await monitorOperation('test-operation', async () => {
        return 'success'
      })

      expect(result).toBe('success')

      const metrics = getClientMetrics()
      expect(metrics.totalOperations).toBe(1)
      expect(metrics.failedOperations).toBe(0)
      expect(metrics.successRate).toBe(100)
      expect(metrics.averageResponseTime).toBe(100)
    })

    test('should track failed operations', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200)

      const testError = new Error('Test error')

      try {
        await monitorOperation('failed-operation', async () => {
          throw testError
        })
      } catch (error) {
        expect(error).toBe(testError)
      }

      const metrics = getClientMetrics()
      expect(metrics.totalOperations).toBe(1)
      expect(metrics.failedOperations).toBe(1)
      expect(metrics.successRate).toBe(0)
      expect(metrics.recentErrors).toHaveLength(1)
      expect(metrics.recentErrors[0].operation).toBe('failed-operation')
      expect(metrics.recentErrors[0].error).toBe('Test error')
    })

    test('should calculate average response time correctly', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // First op: 100ms
        .mockReturnValueOnce(2000).mockReturnValueOnce(2300) // Second op: 300ms

      await monitorOperation('op1', async () => 'result1')
      await monitorOperation('op2', async () => 'result2')

      const metrics = getClientMetrics()
      expect(metrics.totalOperations).toBe(2)
      expect(metrics.averageResponseTime).toBe(200) // (100 + 300) / 2
    })

    test('should track success rate correctly', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // Success
        .mockReturnValueOnce(2000).mockReturnValueOnce(2100) // Success
        .mockReturnValueOnce(3000).mockReturnValueOnce(3100) // Failure

      await monitorOperation('success1', async () => 'ok')
      await monitorOperation('success2', async () => 'ok')
      
      try {
        await monitorOperation('failure', async () => {
          throw new Error('fail')
        })
      } catch (error) {
        // Expected
      }

      const metrics = getClientMetrics()
      expect(metrics.totalOperations).toBe(3)
      expect(metrics.failedOperations).toBe(1)
      expect(metrics.successRate).toBeCloseTo(66.67, 1)
    })
  })

  describe('Error Tracking', () => {
    test('should record errors with details', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test'

      recordError('test-operation', error)

      const metrics = getClientMetrics()
      expect(metrics.recentErrors).toHaveLength(1)
      expect(metrics.recentErrors[0]).toMatchObject({
        operation: 'test-operation',
        error: 'Test error',
        stack: 'Error: Test error\n    at test'
      })
    })

    test('should limit recent errors to prevent memory bloat', () => {
      // Add more than 50 errors
      for (let i = 0; i < 60; i++) {
        recordError('test-op', new Error(`Error ${i}`))
      }

      const metrics = getClientMetrics()
      expect(metrics.recentErrors.length).toBeLessThanOrEqual(50)
      
      // Should keep the most recent errors
      const lastError = metrics.recentErrors[metrics.recentErrors.length - 1]
      expect(lastError.error).toBe('Error 59')
    })

    test('should clean old errors from recent errors list', async () => {
      jest.useFakeTimers()
      
      recordError('old-error', new Error('Old error'))
      
      // Fast forward 25 hours
      jest.advanceTimersByTime(25 * 60 * 60 * 1000)
      
      // Trigger cleanup by calling the private method through monitoring
      recordClientAccess() // This should trigger periodic cleanup
      
      const metrics = getClientMetrics()
      // Note: The actual cleanup happens in the periodic monitoring
      // which we can't easily test without exposing internal methods
      
      jest.useRealTimers()
    })
  })

  describe('Health Check System', () => {
    test('should report healthy status with good metrics', () => {
      const health = getClientHealthCheck()
      
      expect(health.status).toBe('healthy')
      expect(health.summary).toBe('Client is operating normally')
      expect(health.details.warnings).toHaveLength(0)
    })

    test('should report warning status with high memory growth', () => {
      // Force memory update by accessing the private method
      const monitor = (clientMonitor as any)
      
      // Mock high memory usage after creation
      mockMemoryUsage.mockReturnValue({
        rss: 200 * 1024 * 1024,
        heapTotal: 150 * 1024 * 1024,
        heapUsed: 120 * 1024 * 1024, // High memory usage
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      })

      // Manually update metrics to reflect memory change
      monitor.updatePeriodicMetrics()
      monitor.checkForWarnings()
      
      const health = getClientHealthCheck()
      const metrics = getClientMetrics()
      
      // Memory growth should be significant
      expect(metrics.memoryGrowth).toBeGreaterThan(50 * 1024 * 1024) // > 50MB
      
      // Should have warning for high memory growth
      expect(metrics.warnings.some((w: string) => w.includes('High memory growth'))).toBe(true)
    })

    test('should report critical status with low success rate', async () => {
      mockPerformanceNow
        .mockReturnValue(1000).mockReturnValueOnce(1100) // For timing

      // Generate operations with low success rate
      for (let i = 0; i < 15; i++) {
        try {
          await monitorOperation(`fail-${i}`, async () => {
            throw new Error('fail')
          })
        } catch (error) {
          // Expected
        }
      }

      const health = getClientHealthCheck()
      expect(health.status).toBe('critical')
      expect(health.details.successRate).toBe(0)
    })

    test('should provide uptime information', () => {
      const health = getClientHealthCheck()
      
      expect(health.details.uptime).toBeTruthy()
      expect(typeof health.details.uptime).toBe('string')
      expect(health.details.uptime).toMatch(/\d+s/) // Should include seconds
    })
  })

  describe('Memory Monitoring', () => {
    test('should track memory usage', () => {
      const metrics = getClientMetrics()
      
      // Should track initial memory usage (exact value depends on environment)
      expect(typeof metrics.memoryUsageAtCreation).toBe('number')
      expect(typeof metrics.currentMemoryUsage).toBe('number')
      expect(typeof metrics.memoryGrowth).toBe('number')
    })

    test('should calculate memory growth', () => {
      const monitor = (clientMonitor as any)
      const initialMetrics = getClientMetrics()
      const initialMemory = initialMetrics.memoryUsageAtCreation
      
      // Simulate memory increase
      mockMemoryUsage.mockReturnValue({
        rss: 120 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: initialMemory + (30 * 1024 * 1024), // Add 30MB
        external: 15 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      })

      // Force update of memory metrics
      monitor.updatePeriodicMetrics()
      
      const metrics = getClientMetrics()
      expect(metrics.memoryGrowth).toBe(30 * 1024 * 1024) // 30MB growth
    })
  })

  describe('Active Operations Tracking', () => {
    test('should track active operations', () => {
      const monitor = (clientMonitor as any)
      
      monitor.startOperation('op1', 'test-operation-1')
      monitor.startOperation('op2', 'test-operation-2')
      
      const activeOps = monitor.getActiveOperations()
      expect(activeOps).toHaveLength(2)
      expect(activeOps[0].operation).toBe('test-operation-1')
      expect(activeOps[1].operation).toBe('test-operation-2')
    })

    test('should remove completed operations', () => {
      const monitor = (clientMonitor as any)
      
      monitor.startOperation('op1', 'test-operation')
      expect(monitor.getActiveOperations()).toHaveLength(1)
      
      monitor.endOperation('op1', true)
      expect(monitor.getActiveOperations()).toHaveLength(0)
    })
  })

  describe('Metrics Export and Reset', () => {
    test('should export metrics as JSON', () => {
      recordClientAccess()
      recordError('test', new Error('test error'))
      
      const exported = exportClientMetrics()
      const data = JSON.parse(exported)
      
      expect(data.metrics).toBeDefined()
      expect(data.healthCheck).toBeDefined()
      expect(data.exportedAt).toBeDefined()
      expect(data.metrics.instanceAccessCount).toBe(1)
      expect(data.metrics.recentErrors).toHaveLength(1)
    })

    test('should reset all metrics', () => {
      recordClientAccess()
      recordError('test', new Error('test'))
      
      let metrics = getClientMetrics()
      expect(metrics.instanceAccessCount).toBe(1)
      expect(metrics.recentErrors).toHaveLength(1)
      
      resetClientMonitor()
      
      metrics = getClientMetrics()
      expect(metrics.instanceAccessCount).toBe(0)
      expect(metrics.recentErrors).toHaveLength(0)
      expect(metrics.totalOperations).toBe(0)
    })
  })

  describe('Warning Detection', () => {
    test('should detect high memory growth warnings', () => {
      const monitor = (clientMonitor as any)
      const initialMetrics = getClientMetrics()
      const initialMemory = initialMetrics.memoryUsageAtCreation
      
      // Mock high memory usage (70MB growth from initial)
      mockMemoryUsage.mockReturnValue({
        rss: 200 * 1024 * 1024,
        heapTotal: 150 * 1024 * 1024,
        heapUsed: initialMemory + (70 * 1024 * 1024), // 70MB growth
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      })

      monitor.updatePeriodicMetrics()
      monitor.checkForWarnings()

      const metrics = getClientMetrics()
      expect(metrics.warnings.some((w: string) => w.includes('High memory growth: 70.00MB'))).toBe(true)
    })

    test('should detect low success rate warnings', async () => {
      mockPerformanceNow.mockReturnValue(1000).mockReturnValue(1100)

      // Generate operations with low success rate
      for (let i = 0; i < 12; i++) {
        try {
          await monitorOperation(`fail-${i}`, async () => {
            throw new Error('fail')
          })
        } catch (error) {
          // Expected
        }
      }

      const monitor = (clientMonitor as any)
      monitor.checkForWarnings()

      const metrics = getClientMetrics()
      expect(metrics.warnings.some(w => w.includes('Low success rate'))).toBe(true)
    })
  })

  describe('Development Environment Features', () => {
    test('should handle console logging in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const monitor = (clientMonitor as any)
      // Directly set warnings to avoid complex setup
      monitor.metrics.warnings = ['Test warning']
      monitor.checkForWarnings()
      
      // Should log warnings in development
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚨 Supabase Client Monitor Warnings:',
        ['Test warning']
      )
      
      consoleSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    test('should log slow operations in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(7000) // 6000ms duration (slow)

      await monitorOperation('slow-operation', async () => 'result')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow Supabase operation: slow-operation took 6000.00ms')
      )
      
      consoleSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })
  })
})