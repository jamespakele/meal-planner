'use client'

import { useMockAuth } from './MockAuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import MockAuthButton from './MockAuthButton'

export default function HomePage() {
  const { user, loading } = useMockAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <div>
          <h1 className="text-4xl font-bold mb-2">Meal Planner</h1>
          <p className="text-lg">Group-based meal planning with collaborative decision-making</p>
        </div>
        <MockAuthButton />
      </div>
      
      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-gray-200 px-5 py-4 transition-all hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30">
          <h2 className="mb-3 text-2xl font-semibold text-gray-800 group-hover:text-blue-700">
            Create Group{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600 group-hover:text-gray-700">
            Set up your group demographics and dietary restrictions.
          </p>
        </div>

        <div className="group rounded-lg border border-gray-200 px-5 py-4 transition-all hover:border-green-400 hover:shadow-md hover:bg-green-50/30">
          <h2 className="mb-3 text-2xl font-semibold text-gray-800 group-hover:text-green-700">
            Generate Plan{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600 group-hover:text-gray-700">
            AI-powered meal suggestions based on your group profile.
          </p>
        </div>

        <div className="group rounded-lg border border-gray-200 px-5 py-4 transition-all hover:border-purple-400 hover:shadow-md hover:bg-purple-50/30">
          <h2 className="mb-3 text-2xl font-semibold text-gray-800 group-hover:text-purple-700">
            Share Links{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600 group-hover:text-gray-700">
            Dual link system for co-managers and other participants.
          </p>
        </div>

        <div className="group rounded-lg border border-gray-200 px-5 py-4 transition-all hover:border-orange-400 hover:shadow-md hover:bg-orange-50/30">
          <h2 className="mb-3 text-2xl font-semibold text-gray-800 group-hover:text-orange-700">
            Shopping List{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600 group-hover:text-gray-700">
            Automatically scaled ingredient lists for your finalized plan.
          </p>
        </div>
      </div>
    </main>
  )
}