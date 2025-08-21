import { createClient } from '@/lib/supabase/server'
import { PlanData } from '@/lib/planValidation'

/**
 * Background job processing function for meal generation
 * This function handles the actual AI generation and database updates
 */
export async function processJobInBackground(
  jobId: string, 
  userId: string, 
  groupsData: any[], 
  planData: PlanData
) {
  console.log(`[BACKGROUND] Processing job ${jobId} for user ${userId}`)
  
  try {
    const supabase = await createClient()
    console.log(`[BACKGROUND] Supabase client created successfully`)
    
    console.log(`[BACKGROUND] Updating job ${jobId} to processing status`)
    // Update job status to processing using SECURITY DEFINER function
    const { error: updateError } = await supabase.rpc('update_meal_generation_job', {
      p_job_id: jobId,
      p_status: 'processing',
      p_started_at: new Date().toISOString(),
      p_progress: 10,
      p_current_step: 'Preparing AI request...'
    })

    if (updateError) {
      console.error(`[BACKGROUND] Failed to update job status:`, updateError)
      throw updateError
    }
    console.log(`[BACKGROUND] Job status updated successfully`)

    // Import the meal generator functions
    const { generateMealsWithCombinedChatGPT } = await import('@/lib/mealGenerator')

    // Prepare the combined request
    console.log('[BACKGROUND] groupsData received:', JSON.stringify(groupsData, null, 2))
    
    const combinedRequest = {
      plan_name: planData.name,
      week_start: planData.week_start,
      additional_notes: planData.notes,
      groups: groupsData
    }
    
    console.log('[BACKGROUND] combinedRequest:', JSON.stringify(combinedRequest, null, 2))

    await supabase.rpc('update_meal_generation_job', {
      p_job_id: jobId,
      p_progress: 30,
      p_current_step: 'Generating meals with AI...'
    })

    const startTime = Date.now()

    // Generate meals using AI
    const allGroupMeals = await generateMealsWithCombinedChatGPT(combinedRequest)

    const generationTime = Date.now() - startTime

    await supabase.rpc('update_meal_generation_job', {
      p_job_id: jobId,
      p_progress: 80,
      p_current_step: 'Saving generated meals...'
    })

    // Save generated meals to database
    const mealsToInsert = []
    let totalMealsGenerated = 0

    for (const [groupName, meals] of Object.entries(allGroupMeals)) {
      const groupData = groupsData.find(g => g.group_name === groupName)
      
      for (const meal of meals) {
        mealsToInsert.push({
          job_id: jobId,
          group_id: groupData?.group_id || groupName,
          group_name: groupName,
          title: meal.title,
          description: meal.description,
          prep_time: Math.round(meal.prep_time), // Ensure integer
          cook_time: Math.round(meal.cook_time), // Ensure integer
          total_time: Math.round(meal.total_time), // Ensure integer
          servings: Math.round(meal.servings), // Ensure integer
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          tags: meal.tags,
          dietary_info: meal.dietary_info,
          difficulty: meal.difficulty
        })
        totalMealsGenerated++
      }
    }

    // Insert all meals using SECURITY DEFINER function
    if (mealsToInsert.length > 0) {
      const { error: mealsError } = await supabase.rpc('insert_generated_meals', {
        p_job_id: jobId,
        p_meals: mealsToInsert
      })

      if (mealsError) {
        throw new Error(`Failed to save meals: ${mealsError.message}`)
      }
    }

    // Update job as completed using SECURITY DEFINER function
    await supabase.rpc('update_meal_generation_job', {
      p_job_id: jobId,
      p_status: 'completed',
      p_progress: 100,
      p_current_step: 'Completed',
      p_completed_at: new Date().toISOString(),
      p_total_meals_generated: totalMealsGenerated,
      p_api_calls_made: 1,
      p_generation_time_ms: generationTime
    })

    // Create success notification using SECURITY DEFINER function
    await supabase.rpc('insert_user_notification', {
      p_user_id: userId,
      p_type: 'meal_generation_completed',
      p_title: 'Meal generation completed!',
      p_message: `${totalMealsGenerated} meals have been generated for "${planData.name}".`,
      p_job_id: jobId
    })

  } catch (error) {
    console.error('Background job processing failed:', error)
    
    // Update job as failed using SECURITY DEFINER function
    const supabase = await createClient()
    await supabase.rpc('update_meal_generation_job', {
      p_job_id: jobId,
      p_status: 'failed',
      p_completed_at: new Date().toISOString(),
      p_error_message: error instanceof Error ? error.message : 'Unknown error',
      p_error_details: { error: String(error) }
    })

    // Create failure notification using SECURITY DEFINER function
    await supabase.rpc('insert_user_notification', {
      p_user_id: userId,
      p_type: 'meal_generation_failed',
      p_title: 'Meal generation failed',
      p_message: `Failed to generate meals for "${planData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      p_job_id: jobId
    })
  }
}