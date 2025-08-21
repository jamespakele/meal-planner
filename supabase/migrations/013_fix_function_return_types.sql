-- Migration: Fix SECURITY DEFINER function return types to match actual table schema
-- This fixes the "structure of query does not match function result type" error

-- Drop and recreate the get_meal_generation_jobs function with correct return types
DROP FUNCTION IF EXISTS get_meal_generation_jobs(uuid, uuid, text, text);

-- Create SECURITY DEFINER function for querying meal generation jobs with correct types
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
  current_step character varying(255),
  total_meals_generated integer,
  error_message text,                    -- Fixed: was character varying(1000), now matches table schema (TEXT)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_meal_generation_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION get_meal_generation_jobs TO service_role;

-- Add comment
COMMENT ON FUNCTION get_meal_generation_jobs IS 'Queries meal generation jobs with corrected return types matching table schema';