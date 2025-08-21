-- Fix RLS policies for form_links to work with meal_plans table instead of plans table
-- The original policies were designed for the plans table with group_id reference
-- Now we need policies that work with meal_plans table which has direct user_id reference

-- Drop existing policies that reference the old plans table structure
DROP POLICY IF EXISTS "Users can view form links for their plans" ON form_links;
DROP POLICY IF EXISTS "Users can insert form links for their plans" ON form_links;
DROP POLICY IF EXISTS "Users can update form links for their plans" ON form_links;
DROP POLICY IF EXISTS "Users can delete form links for their plans" ON form_links;

-- Create new policies that work with meal_plans table
CREATE POLICY "Users can view form links for their meal plans" ON form_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = form_links.plan_id
            AND mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert form links for their meal plans" ON form_links
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = form_links.plan_id
            AND mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update form links for their meal plans" ON form_links
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = form_links.plan_id
            AND mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete form links for their meal plans" ON form_links
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM meal_plans mp
            WHERE mp.id = form_links.plan_id
            AND mp.user_id = auth.uid()
        )
    );

-- Add policy for anonymous users to access active public form links
-- This is needed for the public form functionality
CREATE POLICY "Anonymous users can view active form links" ON form_links
    FOR SELECT USING (
        revoked_at IS NULL 
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Grant necessary permissions for public access
GRANT SELECT ON form_links TO anon;