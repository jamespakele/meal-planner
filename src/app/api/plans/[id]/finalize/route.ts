import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { successResponse, errorResponse, calculateAdultEquivalent } from '@/lib/utils'

// POST /api/plans/[id]/finalize - Finalize plan with conflict resolution
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params

  try {
    // Get authenticated user using cookie-based auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error in finalize API:', authError)
      return errorResponse('Authentication required', 401)
    }
    
    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        *,
        groups (
          id,
          user_id,
          adults,
          teens,
          kids,
          toddlers
        )
      `)
      .eq('id', planId)
      .single()
    
    if (planError || !plan || plan.groups.user_id !== user.id) {
      return errorResponse('Plan not found or access denied', 404)
    }
    
    // Get all form responses for this plan
    const { data: responses, error: responsesError } = await supabase
      .from('form_responses')
      .select(`
        *,
        form_links (
          id,
          role
        )
      `)
      .eq('form_links.plan_id', planId)
    
    if (responsesError) {
      return errorResponse('Failed to fetch responses', 500)
    }
    
    // Apply conflict resolution: co_manager overrides other responses
    const coManagerResponses = responses.filter(r => r.form_link_role === 'co_manager')
    const otherResponses = responses.filter(r => r.form_link_role === 'other')
    
    // Use the most recent co_manager response, fallback to most recent other response
    const finalSelections = {}
    
    // First apply other responses
    if (otherResponses.length > 0) {
      const latestOther = otherResponses.sort((a, b) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0]
      Object.assign(finalSelections, latestOther.selections)
    }
    
    // Then override with co_manager responses (higher priority)
    if (coManagerResponses.length > 0) {
      const latestCoManager = coManagerResponses.sort((a, b) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0]
      Object.assign(finalSelections, latestCoManager.selections)
    }
    
    // Convert selections to plan_meals records
    const planMeals = []
    for (const [day, mealIds] of Object.entries(finalSelections)) {
      if (Array.isArray(mealIds)) {
        for (const mealId of mealIds) {
          planMeals.push({
            plan_id: planId,
            meal_id: mealId,
            day
          })
        }
      }
    }
    
    // Clear existing plan meals and insert new ones
    await supabase.from('plan_meals').delete().eq('plan_id', planId)
    
    if (planMeals.length > 0) {
      const { error: mealsError } = await supabase
        .from('plan_meals')
        .insert(planMeals)
      
      if (mealsError) {
        return errorResponse('Failed to save finalized meals', 500)
      }
    }
    
    // Update plan status to finalized
    const { error: updateError } = await supabase
      .from('plans')
      .update({ status: 'finalized' })
      .eq('id', planId)
    
    if (updateError) {
      return errorResponse('Failed to update plan status', 500)
    }
    
    // Generate shopping list
    await generateShoppingList(planId, plan.groups)
    
    return successResponse({
      message: 'Plan finalized successfully',
      plan_id: planId,
      selections_applied: Object.keys(finalSelections).length,
      co_manager_responses: coManagerResponses.length,
      other_responses: otherResponses.length
    })
    
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}

// Helper function to generate shopping list
async function generateShoppingList(planId: string, group: any) {
  const supabase = await createClient()
  
  // Get all meals for the finalized plan
  const { data: planMeals, error } = await supabase
    .from('plan_meals')
    .select(`
      *,
      meals (
        id,
        title,
        ingredients
      )
    `)
    .eq('plan_id', planId)
  
  if (error || !planMeals) {
    return
  }
  
  // Calculate adult equivalent for scaling
  const ae = calculateAdultEquivalent(
    group.adults,
    group.teens,
    group.kids,
    group.toddlers
  )
  
  // Aggregate ingredients
  const ingredientMap = new Map()
  
  planMeals.forEach(planMeal => {
    planMeal.meals.ingredients.forEach((ingredient: string) => {
      // Simple ingredient parsing - in a real app, you'd want more sophisticated parsing
      const key = ingredient.toLowerCase()
      if (ingredientMap.has(key)) {
        ingredientMap.set(key, ingredientMap.get(key) + 1)
      } else {
        ingredientMap.set(key, 1)
      }
    })
  })
  
  // Convert to shopping list items with scaling
  const items = Array.from(ingredientMap.entries()).map(([ingredient, count]) => ({
    name: ingredient,
    quantity: count * ae, // Scale by adult equivalent
    unit: 'serving', // Simplified - real app would parse units
    category: 'uncategorized' // Simplified - real app would categorize
  }))
  
  // Save shopping list
  await supabase
    .from('shopping_lists')
    .upsert({
      plan_id: planId,
      items
    })
}