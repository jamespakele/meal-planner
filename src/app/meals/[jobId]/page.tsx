'use client'

import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import GeneratedMealsView from '@/components/GeneratedMealsView'
import { useAuth } from '@/components/AuthProvider'
import { useEffect } from 'react'

export default function GeneratedMealsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const jobId = params.jobId as string

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Redirect will happen in useEffect
  }

  return (
    <GeneratedMealsView 
      jobId={jobId}
      onClose={() => router.push('/dashboard#plans')}
    />
  )
}