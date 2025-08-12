-- Add group_meals column to meal_plans table
-- This migration fixes the issue where meal plan editing doesn't load group meal counts properly
-- by adding proper storage for group meal assignments in the database

-- Add group_meals JSONB column to store group meal assignments
ALTER TABLE meal_plans 
ADD COLUMN group_meals JSONB DEFAULT '[]'::jsonb;

-- Create index for performance on group_meals queries
CREATE INDEX idx_meal_plans_group_meals ON meal_plans USING gin(group_meals);

-- Add simple constraint to validate group_meals is an array
ALTER TABLE meal_plans 
ADD CONSTRAINT check_group_meals_is_array 
CHECK (jsonb_typeof(group_meals) = 'array');

-- Update existing plans to have empty group_meals array if NULL
UPDATE meal_plans 
SET group_meals = '[]'::jsonb 
WHERE group_meals IS NULL;

-- Make group_meals NOT NULL after updating existing records
ALTER TABLE meal_plans 
ALTER COLUMN group_meals SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meal_plans.group_meals IS 'JSONB array storing group meal assignments with structure: [{"group_id": "uuid", "meal_count": number, "notes": "string"}]';

-- Example of expected group_meals structure:
-- [
--   {
--     "group_id": "550e8400-e29b-41d4-a716-446655440000",
--     "meal_count": 5,
--     "notes": "Main family meals for the week"
--   },
--   {
--     "group_id": "550e8400-e29b-41d4-a716-446655440001", 
--     "meal_count": 3,
--     "notes": "Light meals for seniors"
--   }
-- ]