'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'

interface SharedMeal {
  id: string
  group_name: string
  title: string
  description: string
  prep_time: number
  cook_time: number
  total_time: number
  servings: number
  ingredients: string[]
  instructions: string[]
  tags: string[]
  dietary_info: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  created_at: string
}

interface SharedMealJob {
  id: string
  plan_name: string
  week_start: string
  total_meals_generated: number
  created_at: string
}

interface SharedMealsData {
  job: SharedMealJob
  meals: SharedMeal[]
  share_info: {
    created_at: string
    access_count: number
    expires_at: string | null
  }
  total_meals: number
}

export default function SharedMealsPage() {
  const params = useParams()
  const token = params.token as string
  
  const [data, setData] = useState<SharedMealsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      notFound()
      return
    }

    loadSharedMeals()
  }, [token])

  const loadSharedMeals = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/shared-meals?token=${token}`)
      const result = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          notFound()
          return
        }
        throw new Error(result.error || 'Failed to load shared meals')
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to load shared meals')
      }

      setData(result.data)
    } catch (err) {
      console.error('Error loading shared meals:', err)
      setError(err instanceof Error ? err.message : 'Failed to load shared meals')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const groupMealsByGroup = (meals: SharedMeal[]) => {
    return meals.reduce((groups, meal) => {
      const group = meal.group_name
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(meal)
      return groups
    }, {} as Record<string, SharedMeal[]>)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shared meal plan...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mx-auto h-16 w-16 text-red-500 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Share Link Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This shared meal plan may have expired or the link may be invalid.
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    notFound()
    return null
  }

  const mealGroups = groupMealsByGroup(data.meals)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-3">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Shared Meal Plan
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{data.job.plan_name}</h1>
            <p className="mt-2 text-gray-600">
              Week of {formatDate(data.job.week_start)} • {data.total_meals} meals
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.meals.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meals available</h3>
            <p className="text-gray-600">This meal plan doesn&apos;t have any generated meals yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(mealGroups).map(([groupName, meals]) => (
              <section key={groupName}>
                <div className="flex items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">{groupName}</h2>
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {meals.map((meal) => (
                    <div key={meal.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                      <div className="p-6">
                        {/* Meal Header */}
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                            {meal.title}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(meal.difficulty)}`}>
                            {meal.difficulty.charAt(0).toUpperCase() + meal.difficulty.slice(1)}
                          </span>
                        </div>

                        {meal.description && (
                          <p className="text-gray-600 text-sm mb-4">{meal.description}</p>
                        )}

                        {/* Meal Metadata */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {meal.prep_time} min prep
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                            {meal.cook_time} min cook
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {meal.servings} servings
                          </span>
                        </div>

                        {/* Tags and Dietary Info */}
                        {(meal.tags.length > 0 || meal.dietary_info.length > 0) && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {meal.tags.map((tag, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                {tag}
                              </span>
                            ))}
                            {meal.dietary_info.map((info, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700">
                                {info}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Ingredients */}
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Ingredients</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {meal.ingredients.map((ingredient, index) => (
                              <li key={index} className="flex items-start">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                {ingredient}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Instructions */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
                          <ol className="text-sm text-gray-600 space-y-2">
                            {meal.instructions.map((instruction, index) => (
                              <li key={index} className="flex items-start">
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mr-2 flex-shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                {instruction}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>
              This meal plan was shared on {formatDate(data.share_info.created_at)}
              {data.share_info.expires_at && (
                <span> • Expires {formatDate(data.share_info.expires_at)}</span>
              )}
            </p>
            <p className="mt-1">
              Viewed {data.share_info.access_count} {data.share_info.access_count === 1 ? 'time' : 'times'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}