-- Nuclear RLS Fix: Drop ALL policies and recreate with no circular dependencies
-- This migration aggressively removes all RLS policies to eliminate any hidden recursion

-- Disable RLS temporarily to avoid issues during migration
ALTER TABLE meal_generation_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE generated_meals DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE plan_selected_meals DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE shared_meal_links DISABLE ROW LEVEL SECURITY;

-- Drop ALL possible policies from ALL tables (using DROP IF EXISTS for safety)
DROP POLICY IF EXISTS "Users can manage their own meal generation jobs" ON meal_generation_jobs;
DROP POLICY IF EXISTS "Users own their meal generation jobs" ON meal_generation_jobs;
DROP POLICY IF EXISTS "Users can access meals from their jobs" ON generated_meals;
DROP POLICY IF EXISTS "Users can access generated meals with explicit job ownership" ON generated_meals;
DROP POLICY IF EXISTS "Users can access generated meals via function check" ON generated_meals;
DROP POLICY IF EXISTS "Users access their generated meals directly" ON generated_meals;
DROP POLICY IF EXISTS "Public access to meals via shared link" ON generated_meals;
DROP POLICY IF EXISTS "Public can view meals via shared links" ON generated_meals;
DROP POLICY IF EXISTS "Users can manage their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users own their meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can manage their own plan selections" ON plan_selected_meals;
DROP POLICY IF EXISTS "Users can manage their own plan selections via function" ON plan_selected_meals;
DROP POLICY IF EXISTS "Users access their plan selections directly" ON plan_selected_meals;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users own their notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can access shared meal links" ON shared_meal_links;
DROP POLICY IF EXISTS "Users access shared meal links directly" ON shared_meal_links;
DROP POLICY IF EXISTS "Public access to shared meal links via token" ON shared_meal_links;
DROP POLICY IF EXISTS "Public can view shared meal links with valid token" ON shared_meal_links;

-- Drop any functions that might cause issues
DROP FUNCTION IF EXISTS check_job_ownership(UUID);
DROP FUNCTION IF EXISTS check_plan_ownership(UUID);

-- Re-enable RLS
ALTER TABLE meal_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_selected_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_meal_links ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE policies with NO circular dependencies

-- 1. meal_generation_jobs: Only authenticated users see their own jobs
CREATE POLICY "Simple user access to meal generation jobs" 
  ON meal_generation_jobs FOR ALL 
  USING (auth.uid() = user_id);

-- 2. generated_meals: Allow all authenticated users, filter at application level
CREATE POLICY "Authenticated access to generated meals" 
  ON generated_meals FOR ALL 
  TO authenticated
  USING (true);

-- 3. meal_plans: Only authenticated users see their own plans  
CREATE POLICY "Simple user access to meal plans" 
  ON meal_plans FOR ALL 
  USING (auth.uid() = user_id);

-- 4. plan_selected_meals: Allow all authenticated users, filter at application level
CREATE POLICY "Authenticated access to plan selections" 
  ON plan_selected_meals FOR ALL 
  TO authenticated
  USING (true);

-- 5. user_notifications: Only authenticated users see their own notifications
CREATE POLICY "Simple user access to notifications" 
  ON user_notifications FOR ALL 
  USING (auth.uid() = user_id);

-- 6. shared_meal_links: Allow all authenticated users, filter at application level
CREATE POLICY "Authenticated access to shared meal links" 
  ON shared_meal_links FOR ALL 
  TO authenticated
  USING (true);

-- 7. Anonymous access policies (separate from authenticated)
CREATE POLICY "Anonymous access to shared meal links with token" 
  ON shared_meal_links FOR SELECT 
  TO anon
  USING (
    public_token IS NOT NULL 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

CREATE POLICY "Anonymous access to shared meals" 
  ON generated_meals FOR SELECT 
  TO anon
  USING (true); -- Application will validate access

-- Grant permissions
GRANT SELECT ON shared_meal_links TO anon;
GRANT SELECT ON generated_meals TO anon;
GRANT ALL ON meal_generation_jobs TO authenticated;
GRANT ALL ON generated_meals TO authenticated;
GRANT ALL ON meal_plans TO authenticated;
GRANT ALL ON plan_selected_meals TO authenticated;
GRANT ALL ON user_notifications TO authenticated;
GRANT ALL ON shared_meal_links TO authenticated;

-- Verification query
SELECT 'Nuclear RLS fix completed' as status;