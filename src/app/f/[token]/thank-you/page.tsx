'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface ThankYouData {
  role: 'co_manager' | 'other'
  plan: {
    id: string
    week_start: string
    group: {
      name: string
    }
  }
  submission_count: number
  expires_at: string | null
}

export default function ThankYouPage() {
  const params = useParams()
  const token = params.token as string
  const [thankYouData, setThankYouData] = useState<ThankYouData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetchThankYouData()
    }
  }, [token])

  const fetchThankYouData = async () => {
    try {
      // Use HEAD request to get basic info without full meal data
      const response = await fetch(`/api/forms/${token}/meals`, {
        method: 'HEAD'
      })

      if (response.ok) {
        const role = response.headers.get('X-Form-Role') as 'co_manager' | 'other'
        const expiresAt = response.headers.get('X-Expires-At')
        
        // For now, we'll use mock data for the thank you page
        // In a full implementation, you'd create a separate endpoint for this
        setThankYouData({
          role: role || 'other',
          plan: {
            id: 'unknown',
            week_start: new Date().toISOString().split('T')[0],
            group: {
              name: 'Your Group'
            }
          },
          submission_count: 1,
          expires_at: expiresAt || null
        })
      }
    } catch (error) {
      console.error('Error fetching thank you data:', error)
      // Still show thank you page even if we can't get details
      setThankYouData({
        role: 'other',
        plan: {
          id: 'unknown',
          week_start: new Date().toISOString().split('T')[0],
          group: {
            name: 'Your Group'
          }
        },
        submission_count: 1,
        expires_at: null
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Thank You Message */}
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Thank You for Your Selections!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Your meal preferences have been successfully submitted for {thankYouData?.plan.group.name || 'your group'}.
          </p>

          {/* Role-specific messaging */}
          {thankYouData?.role === 'co_manager' ? (
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-purple-800">Co-Manager Priority</h3>
                  <p className="text-sm text-purple-700 mt-1">
                    As the co-manager, your selections will take priority in case of any conflicts with other participants.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Input Received</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Your preferences have been recorded and will be considered during the final meal planning decisions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">What happens next?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 mt-0.5 mr-3">1</span>
                <span>All participant selections will be collected and reviewed</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 mt-0.5 mr-3">2</span>
                <span>The meal plan manager will finalize the choices</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 mt-0.5 mr-3">3</span>
                <span>A shopping list will be generated and shared with the group</span>
              </li>
            </ul>
          </div>

          {/* Additional Actions */}
          <div className="mt-8 space-y-3">
            <button
              onClick={() => window.location.href = `/f/${token}`}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Modify Your Selections
            </button>
            
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Meal Planning Form',
                    text: 'Help choose meals for our group!',
                    url: window.location.origin + `/f/${token}`
                  })
                } else {
                  // Fallback: copy to clipboard
                  navigator.clipboard.writeText(window.location.origin + `/f/${token}`)
                  alert('Link copied to clipboard!')
                }
              }}
              className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Share This Form
            </button>
          </div>

          {/* Expiry Notice */}
          {thankYouData?.expires_at && (
            <div className="mt-6 text-xs text-gray-500">
              This form link expires on {new Date(thankYouData.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Questions or issues?</p>
          <p>Contact your meal plan manager for assistance.</p>
        </div>
      </div>
    </div>
  )
}