-- Final RLS Recursion Fix: Eliminate infinite recursion in meal_generation_jobs
-- This migration specifically targets the "infinite recursion detected in policy" error

-- First, completely disable RLS to ensure no policies are active during migration
ALTER TABLE meal_generation_jobs DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on meal_generation_jobs table with extreme prejudice
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'meal_generation_jobs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON meal_generation_jobs', pol.policyname);
    END LOOP;
END $$;

-- Drop any functions that might be referenced by policies and cause recursion
DROP FUNCTION IF EXISTS check_job_ownership(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_job_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS verify_meal_job_access(UUID) CASCADE;

-- Verify no policies exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'meal_generation_jobs'
    ) THEN
        RAISE EXCEPTION 'Failed to drop all policies on meal_generation_jobs';
    END IF;
END $$;

-- Re-enable RLS
ALTER TABLE meal_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Create ONE simple policy with NO function calls or complex logic
-- This policy uses only built-in auth.uid() function and direct comparison
CREATE POLICY "meal_jobs_user_access" 
    ON meal_generation_jobs 
    FOR ALL 
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Ensure proper grants exist
GRANT ALL ON meal_generation_jobs TO authenticated;

-- Add policy for service_role to bypass RLS (for SECURITY DEFINER functions)
CREATE POLICY "meal_jobs_service_role_bypass" 
    ON meal_generation_jobs 
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON meal_generation_jobs TO service_role;

-- Test the policy immediately
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    -- This should not cause infinite recursion
    SELECT COUNT(*) INTO test_result 
    FROM meal_generation_jobs 
    WHERE user_id = '00000000-0000-0000-0000-000000000000'::UUID;
    
    RAISE NOTICE 'RLS policy test completed successfully. Count: %', test_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'RLS policy test failed: %', SQLERRM;
END $$;

-- Verification query to confirm fix
SELECT 
    'Final RLS recursion fix completed' as status,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'meal_generation_jobs';