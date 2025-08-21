'use client'

import { useState, useEffect } from 'react'

interface FormLink {
  role: 'co_manager' | 'other'
  url: string
  shortCode: string
  token: string
  expires_at: string
  created_at: string
  isExpired: boolean
  isActive: boolean
}

interface FormLinkData {
  plan_id: string
  links: FormLink[]
  expires_at: string
  instructions: {
    co_manager: string
    other: string
  }
}

interface FormLinkManagerProps {
  planId: string
  planName: string
}

export default function FormLinkManager({ planId, planName }: FormLinkManagerProps) {
  const [formLinks, setFormLinks] = useState<FormLinkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinks, setShowLinks] = useState(false)
  const [copySuccess, setCopySuccess] = useState<{ [key: string]: boolean }>({})

  const generateFormLinks = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planId }),
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        }
        throw new Error('Failed to generate form links')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate form links')
      }

      setFormLinks(result.data)
      setShowLinks(true)
    } catch (err) {
      console.error('Error generating form links:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadExistingLinks = async () => {
    try {
      const response = await fetch(`/api/forms?plan_id=${planId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.links.length > 0) {
          setFormLinks(result.data)
        }
      }
    } catch (err) {
      console.error('Error loading existing links:', err)
    }
  }

  useEffect(() => {
    loadExistingLinks()
  }, [planId])

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess({ ...copySuccess, [key]: true })
      setTimeout(() => {
        setCopySuccess({ ...copySuccess, [key]: false })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const revokeLinks = async () => {
    if (!confirm('Are you sure you want to revoke all form links? This will invalidate existing URLs.')) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/forms?plan_id=${planId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to revoke form links')
      }

      setFormLinks(null)
      setShowLinks(false)
    } catch (err) {
      console.error('Error revoking form links:', err)
      setError(err instanceof Error ? err.message : 'Failed to revoke links')
    } finally {
      setLoading(false)
    }
  }

  const hasActiveLinks = formLinks && formLinks.links.some(link => link.isActive)

  return (
    <div className="relative">
      {/* Generate/Show Links Button */}
      {!hasActiveLinks ? (
        <button
          onClick={generateFormLinks}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            'Generate Form Links'
          )}
        </button>
      ) : (
        <button
          onClick={() => setShowLinks(!showLinks)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
        >
          {showLinks ? 'Hide' : 'Show'} Form Links
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute top-full left-0 mt-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm z-10 whitespace-nowrap">
          {error}
        </div>
      )}

      {/* Form Links Display */}
      {showLinks && formLinks && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20 min-w-96">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">Form Links for {planName}</h4>
            <button
              onClick={() => setShowLinks(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {formLinks.links.map((link) => (
              <div key={link.role} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    link.role === 'co_manager' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {link.role === 'co_manager' ? 'Co-Manager' : 'Participant'}
                  </span>
                  <span className={`text-xs ${
                    link.isActive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {link.isActive ? 'Active' : 'Expired'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={link.url}
                    readOnly
                    className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(link.url, link.role)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
                  >
                    {copySuccess[link.role] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                
                <p className="text-xs text-gray-600">
                  {link.role === 'co_manager' 
                    ? formLinks.instructions.co_manager
                    : formLinks.instructions.other
                  }
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Expires: {new Date(formLinks.expires_at).toLocaleDateString()}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={generateFormLinks}
                disabled={loading}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={revokeLinks}
                disabled={loading}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}