'use client'

/**
 * Development dashboard for monitoring Supabase client performance and health
 * Only renders in development environment
 */

import React, { useState, useEffect } from 'react'
import { 
  getClientMetrics, 
  getClientHealthCheck, 
  exportClientMetrics,
  logClientStatus,
  clientMonitor,
  ClientPerformanceMetrics
} from '@/lib/supabase/monitoring'

interface MonitorDashboardProps {
  refreshInterval?: number // Refresh interval in milliseconds (default: 5000)
  compact?: boolean // Show compact view
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export default function SupabaseMonitorDashboard({ 
  refreshInterval = 5000,
  compact = false,
  position = 'bottom-right'
}: MonitorDashboardProps) {
  const [metrics, setMetrics] = useState<ClientPerformanceMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(!compact)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getClientMetrics())
    }

    // Initial load
    updateMetrics()

    // Set up refresh interval
    const interval = setInterval(updateMetrics, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  const health = getClientHealthCheck()

  const handleExportMetrics = () => {
    const data = exportClientMetrics()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `supabase-metrics-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLogStatus = () => {
    logClientStatus()
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4', 
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  }

  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  }

  if (!metrics) return null

  return (
    <div className={`fixed ${positionClasses[position]} z-50 font-mono text-xs`}>
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          className={`px-3 py-1 rounded-full text-white shadow-lg ${statusColors[health.status]} hover:opacity-80 transition-opacity`}
          title={`Supabase Monitor - ${health.status}: ${health.summary}`}
        >
          📊 {health.status.toUpperCase()}
        </button>
      ) : (
        <div className="bg-gray-900 text-green-400 rounded-lg shadow-xl border border-gray-700 max-w-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${statusColors[health.status]}`}></div>
              <span className="font-semibold">Supabase Monitor</span>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white p-1"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '−' : '+'}
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white p-1"
                title="Hide"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Compact Status */}
          {!isExpanded ? (
            <div className="p-3">
              <div className="text-xs text-gray-300">{health.summary}</div>
              <div className="text-xs mt-1">
                {metrics.totalOperations} ops • {metrics.successRate.toFixed(1)}% success
              </div>
            </div>
          ) : (
            <>
              {/* Status Summary */}
              <div className="p-3 border-b border-gray-700">
                <div className="text-sm font-semibold text-white mb-1">Status: {health.status.toUpperCase()}</div>
                <div className="text-xs text-gray-300">{health.summary}</div>
              </div>

              {/* Metrics */}
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Operations:</span>
                    <span className="text-white ml-1">{metrics.totalOperations}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Success Rate:</span>
                    <span className="text-white ml-1">{metrics.successRate.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Response:</span>
                    <span className="text-white ml-1">{metrics.averageResponseTime.toFixed(1)}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Memory Growth:</span>
                    <span className="text-white ml-1">{(metrics.memoryGrowth / (1024 * 1024)).toFixed(1)}MB</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Access Count:</span>
                    <span className="text-white ml-1">{metrics.instanceAccessCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Active Ops:</span>
                    <span className="text-white ml-1">{clientMonitor.getActiveOperations().length}</span>
                  </div>
                </div>

                {/* Warnings */}
                {metrics.warnings.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-yellow-400 font-semibold mb-1">Warnings:</div>
                    <div className="space-y-1">
                      {metrics.warnings.slice(0, 3).map((warning, index) => (
                        <div key={index} className="text-xs text-yellow-300">
                          • {warning}
                        </div>
                      ))}
                      {metrics.warnings.length > 3 && (
                        <div className="text-xs text-gray-400">
                          +{metrics.warnings.length - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Errors */}
                {metrics.recentErrors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-red-400 font-semibold mb-1">
                      Recent Errors ({metrics.recentErrors.length}):
                    </div>
                    <div className="space-y-1">
                      {metrics.recentErrors.slice(-2).map((error, index) => (
                        <div key={index} className="text-xs text-red-300">
                          • {error.operation}: {error.error.substring(0, 40)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uptime */}
                <div className="text-xs text-gray-400 mt-2">
                  Uptime: {health.details.uptime}
                </div>
              </div>

              {/* Actions */}
              <div className="p-3 border-t border-gray-700 flex space-x-2">
                <button
                  onClick={handleLogStatus}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                  title="Log status to console"
                >
                  Log
                </button>
                <button
                  onClick={handleExportMetrics}
                  className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                  title="Export metrics as JSON"
                >
                  Export
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                  title="Refresh page"
                >
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Hook for easy integration
export function useSupabaseMonitor() {
  const [metrics, setMetrics] = useState<ClientPerformanceMetrics | null>(null)
  const [health, setHealth] = useState(getClientHealthCheck())

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const updateData = () => {
      setMetrics(getClientMetrics())
      setHealth(getClientHealthCheck())
    }

    updateData()
    const interval = setInterval(updateData, 5000)

    return () => clearInterval(interval)
  }, [])

  return {
    metrics,
    health,
    exportMetrics: exportClientMetrics,
    logStatus: logClientStatus
  }
}