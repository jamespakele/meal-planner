/**
 * Runtime monitoring system for Supabase client instances and performance
 * Tracks client usage, performance metrics, memory usage, and potential issues
 */

export interface ClientPerformanceMetrics {
  // Client instance tracking
  instanceCreatedAt: string
  instanceAccessCount: number
  lastAccessedAt: string
  
  // Performance metrics
  averageResponseTime: number
  totalOperations: number
  failedOperations: number
  successRate: number
  
  // Memory and resource tracking
  memoryUsageAtCreation: number
  currentMemoryUsage: number
  memoryGrowth: number
  
  // Error tracking
  recentErrors: Array<{
    timestamp: string
    operation: string
    error: string
    stack?: string
  }>
  
  // Warning flags
  warnings: string[]
}

export interface OperationMetrics {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: string
}

class SupabaseClientMonitor {
  private static instance: SupabaseClientMonitor | null = null
  private metrics: ClientPerformanceMetrics
  private operations: Map<string, OperationMetrics> = new Map()
  private monitoringEnabled: boolean = true
  private metricsHistory: ClientPerformanceMetrics[] = []
  private maxHistorySize = 100

  private constructor() {
    this.metrics = {
      instanceCreatedAt: new Date().toISOString(),
      instanceAccessCount: 0,
      lastAccessedAt: '',
      averageResponseTime: 0,
      totalOperations: 0,
      failedOperations: 0,
      successRate: 100,
      memoryUsageAtCreation: this.getCurrentMemoryUsage(),
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      memoryGrowth: 0,
      recentErrors: [],
      warnings: []
    }

    // Set up periodic monitoring
    this.setupPeriodicMonitoring()
  }

  public static getInstance(): SupabaseClientMonitor {
    if (!SupabaseClientMonitor.instance) {
      SupabaseClientMonitor.instance = new SupabaseClientMonitor()
    }
    return SupabaseClientMonitor.instance
  }

  public static reset(): void {
    SupabaseClientMonitor.instance = null
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  private setupPeriodicMonitoring(): void {
    if (typeof window === 'undefined') return // Skip in server environment

    // Update metrics every 30 seconds
    setInterval(() => {
      this.updatePeriodicMetrics()
    }, 30000)

    // Check for warnings every 10 seconds
    setInterval(() => {
      this.checkForWarnings()
    }, 10000)
  }

  private updatePeriodicMetrics(): void {
    if (!this.monitoringEnabled) return

    this.metrics.currentMemoryUsage = this.getCurrentMemoryUsage()
    this.metrics.memoryGrowth = this.metrics.currentMemoryUsage - this.metrics.memoryUsageAtCreation

    // Clean old errors (keep only last 24 hours)
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
    this.metrics.recentErrors = this.metrics.recentErrors.filter(
      error => new Date(error.timestamp).getTime() > twentyFourHoursAgo
    )

    // Archive metrics history
    if (this.metricsHistory.length >= this.maxHistorySize) {
      this.metricsHistory.shift()
    }
    this.metricsHistory.push({ ...this.metrics })
  }

  private checkForWarnings(): void {
    if (!this.monitoringEnabled) return

    this.metrics.warnings = []

    // Check for high memory usage
    const memoryGrowthMB = this.metrics.memoryGrowth / (1024 * 1024)
    if (memoryGrowthMB > 50) {
      this.metrics.warnings.push(`High memory growth: ${memoryGrowthMB.toFixed(2)}MB`)
    }

    // Check for low success rate
    if (this.metrics.successRate < 90 && this.metrics.totalOperations > 10) {
      this.metrics.warnings.push(`Low success rate: ${this.metrics.successRate.toFixed(1)}%`)
    }

    // Check for frequent errors
    const recentErrors = this.metrics.recentErrors.filter(
      error => new Date(error.timestamp).getTime() > Date.now() - (60 * 60 * 1000) // Last hour
    )
    if (recentErrors.length > 10) {
      this.metrics.warnings.push(`High error rate: ${recentErrors.length} errors in the last hour`)
    }

    // Check for stale operations
    const staleOperations = Array.from(this.operations.values()).filter(
      op => !op.endTime && (Date.now() - op.startTime) > 30000 // 30 seconds
    )
    if (staleOperations.length > 0) {
      this.metrics.warnings.push(`${staleOperations.length} operations appear to be hanging`)
    }

    // Log warnings in development
    if (process.env.NODE_ENV === 'development' && this.metrics.warnings.length > 0) {
      console.warn('🚨 Supabase Client Monitor Warnings:', this.metrics.warnings)
    }
  }

  public recordClientAccess(): void {
    if (!this.monitoringEnabled) return

    this.metrics.instanceAccessCount++
    this.metrics.lastAccessedAt = new Date().toISOString()
  }

  public startOperation(operationId: string, operationType: string): string {
    if (!this.monitoringEnabled) return operationId

    const operation: OperationMetrics = {
      operation: operationType,
      startTime: performance.now(),
      success: false
    }

    this.operations.set(operationId, operation)
    return operationId
  }

  public endOperation(operationId: string, success: boolean, error?: string): void {
    if (!this.monitoringEnabled) return

    const operation = this.operations.get(operationId)
    if (!operation) return

    const endTime = performance.now()
    const duration = endTime - operation.startTime

    operation.endTime = endTime
    operation.duration = duration
    operation.success = success
    operation.error = error

    // Update aggregate metrics
    this.metrics.totalOperations++
    if (!success) {
      this.metrics.failedOperations++

      // Record error
      this.metrics.recentErrors.push({
        timestamp: new Date().toISOString(),
        operation: operation.operation,
        error: error || 'Unknown error',
        stack: new Error().stack
      })

      // Keep only last 50 errors to prevent memory bloat
      if (this.metrics.recentErrors.length > 50) {
        this.metrics.recentErrors.splice(0, this.metrics.recentErrors.length - 50)
      }
    }

    // Update success rate
    this.metrics.successRate = ((this.metrics.totalOperations - this.metrics.failedOperations) / this.metrics.totalOperations) * 100

    // Update average response time
    const totalDuration = (this.metrics.averageResponseTime * (this.metrics.totalOperations - 1)) + duration
    this.metrics.averageResponseTime = totalDuration / this.metrics.totalOperations

    // Clean up completed operation
    this.operations.delete(operationId)

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && duration > 5000) {
      console.warn(`🐌 Slow Supabase operation: ${operation.operation} took ${duration.toFixed(2)}ms`)
    }
  }

  public recordError(operation: string, error: string, stack?: string): void {
    if (!this.monitoringEnabled) return

    this.metrics.recentErrors.push({
      timestamp: new Date().toISOString(),
      operation,
      error,
      stack
    })

    // Keep only recent errors
    if (this.metrics.recentErrors.length > 50) {
      this.metrics.recentErrors.splice(0, this.metrics.recentErrors.length - 50)
    }
  }

  public getMetrics(): ClientPerformanceMetrics {
    return { ...this.metrics }
  }

  public getMetricsHistory(): ClientPerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  public getActiveOperations(): OperationMetrics[] {
    return Array.from(this.operations.values())
  }

  public getHealthCheck(): {
    status: 'healthy' | 'warning' | 'critical'
    summary: string
    details: {
      warnings: string[]
      activeOperations: number
      successRate: number
      memoryGrowth: string
      uptime: string
    }
  } {
    const now = new Date()
    const createdAt = new Date(this.metrics.instanceCreatedAt)
    const uptimeMs = now.getTime() - createdAt.getTime()
    const uptime = this.formatUptime(uptimeMs)

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let summary = 'Client is operating normally'

    if (this.metrics.warnings.length > 0) {
      status = 'warning'
      summary = `Client has ${this.metrics.warnings.length} warning(s)`
    }

    if (this.metrics.successRate < 50 || this.metrics.warnings.length > 5) {
      status = 'critical'
      summary = 'Client is experiencing significant issues'
    }

    return {
      status,
      summary,
      details: {
        warnings: this.metrics.warnings,
        activeOperations: this.operations.size,
        successRate: this.metrics.successRate,
        memoryGrowth: `${(this.metrics.memoryGrowth / (1024 * 1024)).toFixed(2)}MB`,
        uptime
      }
    }
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  public enableMonitoring(): void {
    this.monitoringEnabled = true
  }

  public disableMonitoring(): void {
    this.monitoringEnabled = false
  }

  public isMonitoringEnabled(): boolean {
    return this.monitoringEnabled
  }

  public exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      history: this.metricsHistory,
      activeOperations: Array.from(this.operations.values()),
      healthCheck: this.getHealthCheck(),
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  public reset(): void {
    this.metrics = {
      instanceCreatedAt: new Date().toISOString(),
      instanceAccessCount: 0,
      lastAccessedAt: '',
      averageResponseTime: 0,
      totalOperations: 0,
      failedOperations: 0,
      successRate: 100,
      memoryUsageAtCreation: this.getCurrentMemoryUsage(),
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      memoryGrowth: 0,
      recentErrors: [],
      warnings: []
    }
    this.operations.clear()
    this.metricsHistory = []
  }
}

// Export singleton instance and utility functions
export const clientMonitor = SupabaseClientMonitor.getInstance()

// Utility functions for easy integration
export function recordClientAccess(): void {
  clientMonitor.recordClientAccess()
}

export function monitorOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const operationId = `${operation}-${Date.now()}-${Math.random()}`
  clientMonitor.startOperation(operationId, operation)

  return fn()
    .then(result => {
      clientMonitor.endOperation(operationId, true)
      return result
    })
    .catch(error => {
      clientMonitor.endOperation(operationId, false, error.message)
      throw error
    })
}

export function recordError(operation: string, error: Error): void {
  clientMonitor.recordError(operation, error.message, error.stack)
}

export function getClientMetrics(): ClientPerformanceMetrics {
  return clientMonitor.getMetrics()
}

export function getClientHealthCheck() {
  return clientMonitor.getHealthCheck()
}

export function exportClientMetrics(): string {
  return clientMonitor.exportMetrics()
}

export function resetClientMonitor(): void {
  clientMonitor.reset()
}

// Development utilities
export function logClientStatus(): void {
  if (process.env.NODE_ENV === 'development') {
    const health = clientMonitor.getHealthCheck()
    const metrics = clientMonitor.getMetrics()
    
    console.log('📊 Supabase Client Status:', {
      status: health.status,
      summary: health.summary,
      operations: metrics.totalOperations,
      successRate: `${metrics.successRate.toFixed(1)}%`,
      avgResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
      memoryGrowth: `${(metrics.memoryGrowth / (1024 * 1024)).toFixed(2)}MB`,
      warnings: metrics.warnings.length
    })
  }
}