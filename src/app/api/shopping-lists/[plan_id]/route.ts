import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthenticatedUser, successResponse, errorResponse } from '@/lib/utils'

// GET /api/shopping-lists/[plan_id] - Get shopping list for a plan
export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ plan_id: string }> }
) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  
  if (authError || !user) {
    return errorResponse('Authentication required', 401)
  }

  const { plan_id: planId } = await params

  try {
    const supabase = createServerClient()
    
    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        id,
        groups!inner (
          user_id
        )
      `)
      .eq('groups.user_id', user.id)
      .eq('id', planId)
      .single()
    
    if (planError || !plan) {
      return errorResponse('Plan not found or access denied', 404)
    }
    
    // Get shopping list
    const { data: shoppingList, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('plan_id', planId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Shopping list not found - plan may not be finalized yet', 404)
      }
      return errorResponse('Failed to fetch shopping list', 500)
    }
    
    // Group items by category for better organization
    const itemsByCategory = shoppingList.items.reduce((acc: any, item: any) => {
      const category = item.category || 'uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {})
    
    return successResponse({
      shopping_list: shoppingList,
      items_by_category: itemsByCategory,
      total_items: shoppingList.items.length
    })
    
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
}