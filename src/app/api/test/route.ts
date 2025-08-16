import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test database connection by counting meals
    const { data: meals, error } = await supabase
      .from('meals')
      .select('id, title')
      .limit(5)
    
    if (error) {
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }
    
    return Response.json({ 
      success: true, 
      message: 'Database connected successfully',
      meal_count: meals?.length || 0,
      sample_meals: meals
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}