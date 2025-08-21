'use client'

import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import PublicMealSelectionView from '@/components/PublicMealSelectionView'

interface PublicMealData {
  token: string
  role: 'co_manager' | 'other'
  plan: {
    id: string
    week_start: string
    group: {
      id: string
      name: string
      adults: number
      teens: number
      kids: number
      toddlers: number
      dietary_restrictions: string[]
    }
  }
  job: {
    id: string
    status: string
    total_meals: number
  }
  meals: any[]
  current_selections: any[]
  form_info: {
    role: 'co_manager' | 'other'
    can_override: boolean
    expires_at: string | null
    views_count: number
    instructions: string
  }
  meta: {
    total_meals: number
    groups_represented: string[]
    cached: boolean
  }
}

export default function PublicMealSelectionPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [mealData, setMealData] = useState<PublicMealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid link')
      setLoading(false)
      return
    }

    // Fetch meal data from our public API
    fetchMealData()
  }, [token])

  const fetchMealData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/forms/${token}/meals`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('This link has expired or is no longer valid.')
        }
        if (response.status === 404) {
          throw new Error('No meals found for this plan.')
        }
        throw new Error('Failed to load meal data. Please try again.')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load meal data')
      }

      setMealData(result.data)
    } catch (err) {
      console.error('Error fetching meal data:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmissionComplete = (response: any) => {
    // Navigate to thank you page
    router.push(`/f/${token}/thank-you`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading meal options...</h2>
          <p className="text-gray-600">Please wait while we prepare your meal selection form.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Meals</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchMealData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!mealData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No data available</h2>
          <p className="text-gray-600">Unable to load meal selection form.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with role indicator */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Meal Selection for {mealData.plan.group.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Week of {new Date(mealData.plan.week_start).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                mealData.role === 'co_manager' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {mealData.role === 'co_manager' ? 'Co-Manager' : 'Participant'}
              </span>
              {mealData.form_info.expires_at && (
                <span className="text-xs text-gray-500">
                  Expires {new Date(mealData.form_info.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions banner */}
      <div className={`${
        mealData.role === 'co_manager' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'
      } border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-sm text-gray-700">
            <strong>{mealData.role === 'co_manager' ? 'Co-Manager:' : 'Participant:'}</strong> {mealData.form_info.instructions}
          </p>
        </div>
      </div>

      {/* Main content */}
      <PublicMealSelectionView
        mealData={mealData}
        onSubmissionComplete={handleSubmissionComplete}
        onError={setError}
      />
    </div>
  )
}