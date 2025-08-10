'use client'

import { useMockAuth } from './MockAuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface MockProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function MockProtectedRoute({ children, fallback }: MockProtectedRouteProps) {
  const { user, loading } = useMockAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/')
    }
  }, [user, loading, router, mounted])

  // Show loading during SSR and initial client hydration
  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return fallback || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-800 mb-6">Please sign in to access this page.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}