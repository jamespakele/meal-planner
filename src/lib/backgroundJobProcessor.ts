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
    // Update job status to processing
    const updateResult = await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 10,
        current_step: 'Preparing AI request...'
      })
      .eq('id', jobId)

    if (updateResult.error) {
      console.error(`[BACKGROUND] Failed to update job status:`, updateResult.error)
      throw updateResult.error
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

    await supabase
      .from('meal_generation_jobs')
      .update({
        progress: 30,
        current_step: 'Generating meals with AI...'
      })
      .eq('id', jobId)

    const startTime = Date.now()

    // Generate meals using AI
    const allGroupMeals = await generateMealsWithCombinedChatGPT(combinedRequest)

    const generationTime = Date.now() - startTime

    await supabase
      .from('meal_generation_jobs')
      .update({
        progress: 80,
        current_step: 'Saving generated meals...'
      })
      .eq('id', jobId)

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
          prep_time: meal.prep_time,
          cook_time: meal.cook_time,
          total_time: meal.total_time,
          servings: meal.servings,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          tags: meal.tags,
          dietary_info: meal.dietary_info,
          difficulty: meal.difficulty
        })
        totalMealsGenerated++
      }
    }

    // Insert all meals
    if (mealsToInsert.length > 0) {
      const { error: mealsError } = await supabase
        .from('generated_meals')
        .insert(mealsToInsert)

      if (mealsError) {
        throw new Error(`Failed to save meals: ${mealsError.message}`)
      }
    }

    // Update job as completed
    await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'completed',
        progress: 100,
        current_step: 'Completed',
        completed_at: new Date().toISOString(),
        total_meals_generated: totalMealsGenerated,
        api_calls_made: 1,
        generation_time_ms: generationTime
      })
      .eq('id', jobId)

    // Create success notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'meal_generation_completed',
        title: 'Meal generation completed!',
        message: `${totalMealsGenerated} meals have been generated for "${planData.name}".`,
        job_id: jobId
      })

  } catch (error) {
    console.error('Background job processing failed:', error)
    
    // Update job as failed
    const supabase = await createClient()
    await supabase
      .from('meal_generation_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_details: { error: String(error) }
      })
      .eq('id', jobId)

    // Create failure notification
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'meal_generation_failed',
        title: 'Meal generation failed',
        message: `Failed to generate meals for "${planData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        job_id: jobId
      })
  }
}