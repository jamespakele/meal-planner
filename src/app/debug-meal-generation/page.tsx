'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabase/singleton'

export default function DebugMealGenerationPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => getSupabaseClient(), [])
  
  const [planData, setPlanData] = useState({
    name: 'Debug Test Plan',
    week_start: '2025-08-18',
    notes: 'Test notes for debugging meal generation',
    group_meals: []
  })

  useEffect(() => {
    if (user) {
      loadGroups()
    }
  }, [user])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const { data: userGroups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setGroups(userGroups || [])
      
      // Auto-populate plan data with first group if available
      if (userGroups && userGroups.length > 0) {
        setPlanData(prev => ({
          ...prev,
          group_meals: [
            {
              group_id: userGroups[0].id,
              meal_count: 5,
              notes: `Debug meals for ${userGroups[0].name}`
            }
          ]
        }))
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const [generationContext, setGenerationContext] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)

  const buildGenerationPrompt = () => {
    const groupContexts = planData.group_meals.map(gm => {
      const group = groups.find(g => g.id === gm.group_id)
      if (!group) return null

      // Calculate adult equivalent
      const adultEquivalent = (group.adults * 1.0) + (group.teens * 1.2) + (group.kids * 0.7) + (group.toddlers * 0.4)

      return {
        group_id: gm.group_id,
        group_name: group.name,
        demographics: { 
          adults: group.adults, 
          teens: group.teens, 
          kids: group.kids, 
          toddlers: group.toddlers 
        },
        dietary_restrictions: group.dietary_restrictions || [],
        meal_count_requested: gm.meal_count,
        adult_equivalent: adultEquivalent,
        group_notes: gm.notes
      }
    }).filter(Boolean)

    const combinedRequest = {
      plan_name: planData.name,
      week_start: planData.week_start,
      additional_notes: planData.notes,
      groups: groupContexts.map(context => ({
        group_id: context.group_id,
        group_name: context.group_name,
        demographics: context.demographics,
        dietary_restrictions: context.dietary_restrictions,
        meals_to_generate: context.meal_count_requested + 2, // DEFAULT_EXTRA_MEALS
        group_notes: context.group_notes,
        adult_equivalent: context.adult_equivalent
      }))
    }

    const prompt = `You are a professional meal planning assistant. Generate varied, practical meals for multiple groups with different demographics and dietary needs.

MEAL PLAN REQUEST:
Plan Name: ${combinedRequest.plan_name}
Week Starting: ${combinedRequest.week_start}
Additional Notes: ${combinedRequest.additional_notes || 'None'}

GROUPS TO GENERATE MEALS FOR:
${combinedRequest.groups.map((group, index) => `
Group ${index + 1}: ${group.group_name}
- Demographics: ${group.demographics.adults} adults, ${group.demographics.teens} teens, ${group.demographics.kids} kids, ${group.demographics.toddlers} toddlers
- Adult Equivalent: ${group.adult_equivalent} servings
- Dietary Restrictions: ${group.dietary_restrictions.join(', ') || 'None'}
- Meals to Generate: ${group.meals_to_generate}
- Notes: ${group.group_notes || 'None'}
`).join('')}

REQUIREMENTS:
1. Generate EXACTLY the requested number of meals for each group
2. All meals must include complete ingredient lists with quantities scaled for the adult equivalent
3. Include step-by-step cooking instructions
4. Consider dietary restrictions carefully
5. Provide variety in cuisine types and cooking methods
6. Include prep time, cook time, and total time
7. Rate difficulty level (Easy/Medium/Hard)
8. Add relevant dietary tags

Please respond with a JSON object where each group name is a key containing an array of meal objects.`

    return { prompt, request: combinedRequest }
  }

  const testMealGeneration = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/meal-generation/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planData })
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const { prompt, request } = buildGenerationPrompt()

  if (!user) {
    return <div className="p-8">Please log in to access this debug page.</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Meal Generation Debug Interface</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-center mt-4">Loading your groups...</p>
          </div>
        </div>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Meal Generation Debug Interface</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">No Groups Found</h3>
              <p className="text-gray-600 mb-6">You need to create at least one group before you can test meal generation.</p>
              <a 
                href="/dashboard" 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Meal Generation Debug Interface</h1>
        
        {/* Available Groups */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Available Groups ({groups.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="border rounded p-3">
                <h3 className="font-medium">{group.name}</h3>
                <p className="text-sm text-gray-600">
                  {group.adults} adults, {group.teens} teens, {group.kids} kids, {group.toddlers} toddlers
                </p>
                {group.dietary_restrictions?.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    {group.dietary_restrictions.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input Data */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Plan Data</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(planData, null, 2)}
              </pre>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Generation Context</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(request, null, 2)}
              </pre>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Test Generation</h2>
              <button
                onClick={testMealGeneration}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                {isLoading ? 'Creating Job...' : 'Start Test Generation'}
              </button>
              
              {result && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Result:</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - OpenAI Prompt */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">OpenAI Prompt</h2>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800 mb-2">
                  This is the exact prompt that would be sent to OpenAI's API:
                </p>
                <div className="bg-white p-4 rounded border text-sm font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                  {prompt}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Expected Response Format</h2>
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-sm text-green-800 mb-2">
                  OpenAI should respond with:
                </p>
                <pre className="bg-white p-4 rounded border text-sm overflow-auto">
{`{
  "Group test-group-1": [
    {
      "title": "Vegetarian Pasta Primavera",
      "description": "Fresh vegetables in a light garlic sauce",
      "prep_time": "15 minutes",
      "cook_time": "20 minutes", 
      "total_time": "35 minutes",
      "servings": "3.2 adult equivalents",
      "ingredients": [
        "400g whole wheat pasta",
        "2 zucchini, sliced",
        "1 bell pepper, diced",
        "..."
      ],
      "instructions": [
        "Cook pasta according to package directions",
        "Sauté vegetables in olive oil",
        "..."
      ],
      "tags": ["vegetarian", "quick", "healthy"],
      "dietary_info": {
        "vegetarian": true,
        "vegan": false,
        "gluten_free": false
      },
      "difficulty": "Easy"
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}