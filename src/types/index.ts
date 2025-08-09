import { Database } from './database'

// Extract types from database schema for easier use
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupInsert = Database['public']['Tables']['groups']['Insert']
export type GroupUpdate = Database['public']['Tables']['groups']['Update']

export type Meal = Database['public']['Tables']['meals']['Row']
export type MealInsert = Database['public']['Tables']['meals']['Insert']
export type MealUpdate = Database['public']['Tables']['meals']['Update']

export type Plan = Database['public']['Tables']['plans']['Row']
export type PlanInsert = Database['public']['Tables']['plans']['Insert']
export type PlanUpdate = Database['public']['Tables']['plans']['Update']

export type PlanMeal = Database['public']['Tables']['plan_meals']['Row']
export type PlanMealInsert = Database['public']['Tables']['plan_meals']['Insert']
export type PlanMealUpdate = Database['public']['Tables']['plan_meals']['Update']

export type FormLink = Database['public']['Tables']['form_links']['Row']
export type FormLinkInsert = Database['public']['Tables']['form_links']['Insert']
export type FormLinkUpdate = Database['public']['Tables']['form_links']['Update']

export type FormResponse = Database['public']['Tables']['form_responses']['Row']
export type FormResponseInsert = Database['public']['Tables']['form_responses']['Insert']
export type FormResponseUpdate = Database['public']['Tables']['form_responses']['Update']

export type ShoppingList = Database['public']['Tables']['shopping_lists']['Row']
export type ShoppingListInsert = Database['public']['Tables']['shopping_lists']['Insert']
export type ShoppingListUpdate = Database['public']['Tables']['shopping_lists']['Update']

// Utility types
export type FormLinkRole = Database['public']['Enums']['form_link_role']
export type GroupStatus = Database['public']['Enums']['group_status']
export type PlanStatus = Database['public']['Enums']['plan_status']

// Adult Equivalent calculation helper
export interface AdultEquivalentParams {
  adults: number
  teens: number
  kids: number
  toddlers: number
}

// Meal selection for forms
export interface MealSelection {
  mealId: string
  day: string
  selected: boolean
}

// Shopping list item structure
export interface ShoppingListItem {
  name: string
  quantity: number
  unit: string
  category: string
}