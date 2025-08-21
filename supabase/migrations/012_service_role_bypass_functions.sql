-- Migration: Service Role Bypass Functions for Meal Generation
-- This migration creates SECURITY DEFINER functions that bypass RLS policies
-- using service role permissions to avoid the infinite recursion issue

-- Drop existing problematic policies first
DROP POLICY IF EXISTS "Simple user access to meal generation jobs" ON meal_generation_jobs;

-- Create SECURITY DEFINER function for creating meal generation jobs
-- This function runs with the privileges of the function owner (service role)
-- and bypasses RLS policies that cause infinite recursion
CREATE OR REPLACE FUNCTION create_meal_generation_job(
  p_plan_name text,
  p_week_start date,
  p_user_id uuid,
  p_groups_data jsonb,
  p_additional_notes text DEFAULT NULL
) RETURNS TABLE (
  job_id uuid,
  job_status text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_job_id uuid;
BEGIN
  -- Verify user exists and is the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: can only create jobs for authenticated user';
  END IF;

  -- Insert job bypassing RLS policies
  INSERT INTO meal_generation_jobs (
    plan_name,
    week_start,
    user_id,
    status,
    groups_data,
    additional_notes,
    created_at,
    progress,
    current_step
  ) VALUES (
    p_plan_name,
    p_week_start,
    p_user_id,
    'pending',
    p_groups_data,
    p_additional_notes,
    now(),
    0,
    'Initializing...'
  )
  RETURNING id INTO new_job_id;

  -- Return job info
  RETURN QUERY SELECT new_job_id, 'pending'::text;
END;
$$;

-- Create SECURITY DEFINER function for updating meal generation jobs
CREATE OR REPLACE FUNCTION update_meal_generation_job(
  p_job_id uuid,
  p_status text DEFAULT NULL,
  p_progress integer DEFAULT NULL,
  p_current_step text DEFAULT NULL,
  p_started_at timestamptz DEFAULT NULL,
  p_completed_at timestamptz DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_error_details jsonb DEFAULT NULL,
  p_total_meals_generated integer DEFAULT NULL,
  p_api_calls_made integer DEFAULT NULL,
  p_generation_time_ms integer DEFAULT NULL
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  job_user_id uuid;
BEGIN
  -- Get the user_id for this job
  SELECT user_id INTO job_user_id 
  FROM meal_generation_jobs 
  WHERE id = p_job_id;

  -- Verify user owns this job or is service role
  IF job_user_id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF job_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: can only update own jobs';
  END IF;

  -- Update job bypassing RLS policies
  UPDATE meal_generation_jobs
  SET 
    status = COALESCE(p_status, status),
    progress = COALESCE(p_progress, progress),
    current_step = COALESCE(p_current_step, current_step),
    started_at = COALESCE(p_started_at, started_at),
    completed_at = COALESCE(p_completed_at, completed_at),
    error_message = COALESCE(p_error_message, error_message),
    error_details = COALESCE(p_error_details, error_details),
    total_meals_generated = COALESCE(p_total_meals_generated, total_meals_generated),
    api_calls_made = COALESCE(p_api_calls_made, api_calls_made),
    generation_time_ms = COALESCE(p_generation_time_ms, generation_time_ms)
  WHERE id = p_job_id;
END;
$$;

-- Create SECURITY DEFINER function for querying meal generation jobs
CREATE OR REPLACE FUNCTION get_meal_generation_jobs(
  p_user_id uuid,
  p_job_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_plan_name text DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  plan_name character varying(255),
  week_start date,
  status character varying(50),
  progress integer,
  current_step character varying(500),
  total_meals_generated integer,
  error_message character varying(1000),
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify user is authenticated and requesting their own jobs
  IF p_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: can only access own jobs';
  END IF;

  -- Return jobs bypassing RLS policies
  RETURN QUERY
  SELECT 
    mgj.id,
    mgj.plan_name,
    mgj.week_start,
    mgj.status,
    mgj.progress,
    mgj.current_step,
    mgj.total_meals_generated,
    mgj.error_message,
    mgj.created_at,
    mgj.started_at,
    mgj.completed_at
  FROM meal_generation_jobs mgj
  WHERE mgj.user_id = p_user_id
    AND (p_job_id IS NULL OR mgj.id = p_job_id)
    AND (p_status IS NULL OR mgj.status = p_status)
    AND (p_plan_name IS NULL OR mgj.plan_name = p_plan_name)
  ORDER BY mgj.created_at DESC;
END;
$$;

-- Create SECURITY DEFINER function for inserting generated meals
CREATE OR REPLACE FUNCTION insert_generated_meals(
  p_job_id uuid,
  p_meals jsonb
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  job_user_id uuid;
  meal jsonb;
BEGIN
  -- Get the user_id for this job
  SELECT user_id INTO job_user_id 
  FROM meal_generation_jobs 
  WHERE id = p_job_id;

  -- Verify job exists and user owns it or is service role
  IF job_user_id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF job_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: can only insert meals for own jobs';
  END IF;

  -- Insert each meal bypassing RLS policies
  FOR meal IN SELECT * FROM jsonb_array_elements(p_meals)
  LOOP
    INSERT INTO generated_meals (
      job_id,
      group_id,
      group_name,
      title,
      description,
      prep_time,
      cook_time,
      total_time,
      servings,
      ingredients,
      instructions,
      tags,
      dietary_info,
      difficulty,
      selected,
      created_at
    ) VALUES (
      p_job_id,
      (meal->>'group_id')::uuid,
      meal->>'group_name',
      meal->>'title',
      meal->>'description',
      (meal->>'prep_time')::integer,
      (meal->>'cook_time')::integer,
      (meal->>'total_time')::integer,
      (meal->>'servings')::integer,
      meal->'ingredients',
      meal->'instructions',
      meal->'tags',
      meal->'dietary_info',
      meal->>'difficulty',
      COALESCE((meal->>'selected')::boolean, false),
      now()
    );
  END LOOP;
END;
$$;

-- Create SECURITY DEFINER function for inserting user notifications
CREATE OR REPLACE FUNCTION insert_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_job_id uuid DEFAULT NULL
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify user is authenticated and inserting for themselves or is service role
  IF p_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: can only create notifications for authenticated user';
  END IF;

  -- Insert notification bypassing RLS policies
  INSERT INTO user_notifications (
    user_id,
    type,
    title,
    message,
    job_id,
    created_at,
    read
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_job_id,
    now(),
    false
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_meal_generation_job TO authenticated;
GRANT EXECUTE ON FUNCTION update_meal_generation_job TO authenticated;
GRANT EXECUTE ON FUNCTION get_meal_generation_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION insert_generated_meals TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user_notification TO authenticated;

-- Grant execute permissions to service role for background processing
GRANT EXECUTE ON FUNCTION create_meal_generation_job TO service_role;
GRANT EXECUTE ON FUNCTION update_meal_generation_job TO service_role;
GRANT EXECUTE ON FUNCTION get_meal_generation_jobs TO service_role;
GRANT EXECUTE ON FUNCTION insert_generated_meals TO service_role;
GRANT EXECUTE ON FUNCTION insert_user_notification TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION create_meal_generation_job IS 'Creates meal generation job bypassing RLS infinite recursion';
COMMENT ON FUNCTION update_meal_generation_job IS 'Updates meal generation job status bypassing RLS issues';
COMMENT ON FUNCTION get_meal_generation_jobs IS 'Queries meal generation jobs bypassing RLS issues';
COMMENT ON FUNCTION insert_generated_meals IS 'Inserts generated meals bypassing RLS issues';
COMMENT ON FUNCTION insert_user_notification IS 'Creates user notifications bypassing RLS issues';