'use client'

import React, { useState } from 'react'
import { ChatGPTMealRequest, CombinedChatGPTMealRequest, DIETARY_RESTRICTION_PROMPTS, INGREDIENT_CATEGORIES } from '@/lib/mealGenerator'

interface AIPromptDebuggerProps {
  combinedRequest?: CombinedChatGPTMealRequest | null
  chatGPTRequests?: ChatGPTMealRequest[] // Keep for backward compatibility
  className?: string
}

export default function AIPromptDebugger({ combinedRequest, chatGPTRequests = [], className = '' }: AIPromptDebuggerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Use combined request if available, otherwise fall back to legacy individual requests
  const hasData = combinedRequest || chatGPTRequests.length > 0

  if (!hasData) {
    return null
  }

  const buildCombinedPrompt = (request: CombinedChatGPTMealRequest): string => {
    const { plan_name, week_start, groups, additional_notes } = request

    // Build the combined prompt (same as in generateMealsWithCombinedChatGPT)
    let prompt = `Generate meal options for meal plan "${plan_name}" starting week of ${week_start}.\n\n`

    if (additional_notes) {
      prompt += `PLAN NOTES: ${additional_notes}\n\n`
    }

    prompt += `GROUPS TO GENERATE FOR:\n`

    groups.forEach((group, index) => {
      const { group_name, demographics, dietary_restrictions, meals_to_generate, group_notes, adult_equivalent } = group

      // Build dietary restrictions context
      const dietaryContext = dietary_restrictions.length > 0
        ? dietary_restrictions.map(restriction => 
            DIETARY_RESTRICTION_PROMPTS[restriction as keyof typeof DIETARY_RESTRICTION_PROMPTS] || restriction
          ).join(' ')
        : 'No specific dietary restrictions.'

      // Build demographics context
      const demoContext = `${demographics.adults} adults, ${demographics.teens} teens, ${demographics.kids} kids, ${demographics.toddlers} toddlers (${adult_equivalent} adult equivalents)`

      prompt += `
${index + 1}. GROUP: "${group_name}"
   - Demographics: ${demoContext}
   - Dietary Requirements: ${dietaryContext}
   - Meals needed: ${meals_to_generate}
   - Group notes: ${group_notes || 'None specified'}
   - Scale ingredients for ${adult_equivalent} adult equivalent servings
`
    })

    prompt += `
REQUIREMENTS:
- Generate meals for ALL groups listed above
- Each meal must include title, description, prep_time (minutes), cook_time (minutes), servings (base servings before scaling), ingredients with amounts/units/categories, step-by-step instructions, tags, dietary_info, and difficulty level (easy/medium/hard)
- Ingredients must be categorized: ${INGREDIENT_CATEGORIES.join(', ')}
- Base servings should be 4-6 people, ingredients will be scaled later
- Variety in cuisine types and cooking methods
- Family-friendly options when kids/toddlers are present
- Respect each group's dietary restrictions

Return ONLY valid JSON in this exact format:
{
  "groups": [`

    groups.forEach((group, index) => {
      prompt += `${index > 0 ? ',' : ''}
    {
      "group_name": "${group.group_name}",
      "meals": [
        {
          "title": "Meal Name",
          "description": "Brief description",
          "prep_time": 15,
          "cook_time": 25,
          "servings": 4,
          "ingredients": [
            {
              "name": "ingredient name",
              "amount": 1.5,
              "unit": "lbs",
              "category": "protein"
            }
          ],
          "instructions": ["Step 1", "Step 2"],
          "tags": ["quick", "family-friendly"],
          "dietary_info": ["vegetarian"],
          "difficulty": "easy"
        }
      ]
    }`
    })

    prompt += `
  ]
}`

    return prompt
  }

  const systemPrompt = 'You are a professional meal planning assistant. Generate meal suggestions that are practical, nutritious, and appropriate for the specified demographics and dietary restrictions. Return ONLY valid JSON.'

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">🔍 AI Prompt Debugger</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">DEV ONLY</span>
          </div>
          <div className="flex items-center space-x-2">
            {combinedRequest && (
              <span className="text-xs text-gray-500">
                Combined ({combinedRequest.groups.length} groups)
              </span>
            )}
            {!combinedRequest && chatGPTRequests.length > 1 && (
              <span className="text-xs text-gray-500">{chatGPTRequests.length} requests</span>
            )}
            <span className="text-sm text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-4">
          {combinedRequest ? (
            /* Combined Request View */
            <>
              {/* Context Information */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2">Plan Information</h4>
                <div className="bg-white p-3 rounded border text-xs space-y-2">
                  <div><strong>Plan Name:</strong> {combinedRequest.plan_name}</div>
                  <div><strong>Week Start:</strong> {combinedRequest.week_start}</div>
                  <div><strong>Number of Groups:</strong> {combinedRequest.groups.length}</div>
                  {combinedRequest.additional_notes && (
                    <div><strong>Plan Notes:</strong> {combinedRequest.additional_notes}</div>
                  )}
                </div>
              </div>

              {/* Groups Information */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2">Groups</h4>
                <div className="space-y-2">
                  {combinedRequest.groups.map((group, index) => (
                    <div key={index} className="bg-white p-3 rounded border text-xs">
                      <div className="font-medium text-gray-900 mb-2">{index + 1}. {group.group_name}</div>
                      <div className="space-y-1">
                        <div><strong>Demographics:</strong> {group.demographics.adults}A, {group.demographics.teens}T, {group.demographics.kids}K, {group.demographics.toddlers}Tod</div>
                        <div><strong>Adult Equivalent:</strong> {group.adult_equivalent}</div>
                        <div><strong>Meals to Generate:</strong> {group.meals_to_generate}</div>
                        {group.dietary_restrictions.length > 0 && (
                          <div><strong>Dietary Restrictions:</strong> {group.dietary_restrictions.join(', ')}</div>
                        )}
                        {group.group_notes && (
                          <div><strong>Group Notes:</strong> {group.group_notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2">System Prompt</h4>
                <div className="bg-blue-50 p-3 rounded border">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                    {systemPrompt}
                  </pre>
                </div>
              </div>

              {/* Combined User Prompt */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2">Combined User Prompt</h4>
                <div className="bg-green-50 p-3 rounded border max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                    {buildCombinedPrompt(combinedRequest)}
                  </pre>
                </div>
              </div>

              {/* API Configuration */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2">API Configuration</h4>
                <div className="bg-gray-100 p-3 rounded border text-xs space-y-1">
                  <div><strong>Model:</strong> gpt-4</div>
                  <div><strong>Max Tokens:</strong> 6000 (increased for multiple groups)</div>
                  <div><strong>Temperature:</strong> 0.7</div>
                  <div><strong>Timeout:</strong> 30000ms</div>
                  <div><strong>API Calls:</strong> 1 (combined request)</div>
                </div>
              </div>
            </>
          ) : (
            /* Legacy Individual Requests View */
            <>
              {/* Request selector */}
              {chatGPTRequests.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Request to view:
                  </label>
                  <select
                    value={0}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                  >
                    {chatGPTRequests.map((req, index) => (
                      <option key={index} value={index}>
                        {req.group_name} ({req.meals_to_generate} meals)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="text-xs text-gray-600 italic">
                Legacy individual request mode (deprecated)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}