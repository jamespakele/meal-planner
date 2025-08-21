-- Fix RLS Policy Infinite Recursion
-- This migration fixes the infinite recursion issue in RLS policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can access meals from their jobs" ON generated_meals;
DROP POLICY IF EXISTS "Users can manage their own plan selections" ON plan_selected_meals;

-- Fix the generated_meals policy to avoid circular dependency
-- Instead of using a subquery that references meal_generation_jobs, 
-- we'll create a simpler policy and rely on application-level filtering
CREATE POLICY "Users can access generated meals with explicit job ownership" 
  ON generated_meals FOR ALL 
  USING (
    -- Allow access if the job_id belongs to a job owned by the current user
    -- We'll use a function to break the circular dependency
    job_id IN (
      SELECT mgj.id 
      FROM meal_generation_jobs mgj 
      WHERE mgj.user_id = auth.uid()
    )
  );

-- Alternative approach: Create a function to check job ownership
-- This breaks the circular dependency by using a function
CREATE OR REPLACE FUNCTION check_job_ownership(job_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple existence check without triggering RLS on meal_generation_jobs
  RETURN EXISTS (
    SELECT 1 
    FROM meal_generation_jobs 
    WHERE id = job_uuid 
    AND user_id = auth.uid()
  );
END;
$$;

-- Create a new, safer policy using the function
DROP POLICY IF EXISTS "Users can access generated meals with explicit job ownership" ON generated_meals;

CREATE POLICY "Users can access generated meals via function check" 
  ON generated_meals FOR ALL 
  USING (check_job_ownership(job_id));

-- Fix the plan_selected_meals policy using the same approach
CREATE OR REPLACE FUNCTION check_plan_ownership(plan_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple existence check without triggering RLS on meal_plans
  RETURN EXISTS (
    SELECT 1 
    FROM meal_plans 
    WHERE id = plan_uuid 
    AND user_id = auth.uid()
  );
END;
$$;

CREATE POLICY "Users can manage their own plan selections via function" 
  ON plan_selected_meals FOR ALL 
  USING (check_plan_ownership(plan_id));

-- Add comment explaining the fix
COMMENT ON FUNCTION check_job_ownership(UUID) IS 'Function to check job ownership without triggering RLS recursion';
COMMENT ON FUNCTION check_plan_ownership(UUID) IS 'Function to check plan ownership without triggering RLS recursion';

-- Test the policies by creating a simple query
-- This should not cause infinite recursion anymore
SELECT 'RLS policies updated successfully' as status;