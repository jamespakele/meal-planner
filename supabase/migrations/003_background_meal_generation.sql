-- Background Meal Generation System
-- This migration adds support for asynchronous meal generation with proper database storage

-- Meal Generation Jobs Table
CREATE TABLE meal_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name VARCHAR(255) NOT NULL,
  week_start DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job status and progress
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step VARCHAR(255),
  
  -- Input data (JSON)
  groups_data JSONB NOT NULL, -- Array of group contexts
  additional_notes TEXT,
  
  -- Results
  total_meals_generated INTEGER,
  api_calls_made INTEGER DEFAULT 0,
  generation_time_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Meals Table (replaces the current mock storage)
CREATE TABLE generated_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES meal_generation_jobs(id) ON DELETE CASCADE,
  group_id VARCHAR(255) NOT NULL, -- References the group in the plan
  group_name VARCHAR(255) NOT NULL,
  
  -- Meal details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  prep_time INTEGER NOT NULL,
  cook_time INTEGER NOT NULL,
  total_time INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  
  -- Ingredients (JSON array)
  ingredients JSONB NOT NULL,
  
  -- Instructions (JSON array)
  instructions JSONB NOT NULL,
  
  -- Metadata
  tags JSONB DEFAULT '[]'::jsonb,
  dietary_info JSONB DEFAULT '[]'::jsonb,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  
  -- Selection status
  selected BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal Plans Table (for finalized plans)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES meal_generation_jobs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plan details
  name VARCHAR(255) NOT NULL,
  week_start DATE NOT NULL,
  notes TEXT,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  
  -- Meal selection summary
  total_meals_selected INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Selected Meals (many-to-many between meal_plans and generated_meals)
CREATE TABLE plan_selected_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES generated_meals(id) ON DELETE CASCADE,
  
  -- Custom notes or modifications for this meal in this plan
  custom_notes TEXT,
  
  -- Scheduling
  scheduled_date DATE,
  meal_type VARCHAR(50), -- breakfast, lunch, dinner, snack
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plan_id, meal_id)
);

-- Notifications Table (for async job completion notifications)
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification details
  type VARCHAR(100) NOT NULL, -- 'meal_generation_completed', 'meal_generation_failed', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Related data
  job_id UUID REFERENCES meal_generation_jobs(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_meal_generation_jobs_user_status ON meal_generation_jobs(user_id, status);
CREATE INDEX idx_meal_generation_jobs_created ON meal_generation_jobs(created_at DESC);
CREATE INDEX idx_generated_meals_job_id ON generated_meals(job_id);
CREATE INDEX idx_generated_meals_group ON generated_meals(job_id, group_id);
CREATE INDEX idx_generated_meals_selected ON generated_meals(job_id, selected);
CREATE INDEX idx_meal_plans_user ON meal_plans(user_id, created_at DESC);
CREATE INDEX idx_plan_selected_meals_plan ON plan_selected_meals(plan_id);
CREATE INDEX idx_user_notifications_user_unread ON user_notifications(user_id, read, created_at DESC);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_meal_generation_jobs_updated_at 
  BEFORE UPDATE ON meal_generation_jobs 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_generated_meals_updated_at 
  BEFORE UPDATE ON generated_meals 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at 
  BEFORE UPDATE ON meal_plans 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE meal_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_selected_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own meal generation jobs
CREATE POLICY "Users can manage their own meal generation jobs" 
  ON meal_generation_jobs FOR ALL 
  USING (auth.uid() = user_id);

-- Users can only access generated meals from their jobs
CREATE POLICY "Users can access meals from their jobs" 
  ON generated_meals FOR ALL 
  USING (job_id IN (
    SELECT id FROM meal_generation_jobs 
    WHERE user_id = auth.uid()
  ));

-- Users can only access their own meal plans
CREATE POLICY "Users can manage their own meal plans" 
  ON meal_plans FOR ALL 
  USING (auth.uid() = user_id);

-- Users can only access their own plan selections
CREATE POLICY "Users can manage their own plan selections" 
  ON plan_selected_meals FOR ALL 
  USING (plan_id IN (
    SELECT id FROM meal_plans 
    WHERE user_id = auth.uid()
  ));

-- Users can only access their own notifications
CREATE POLICY "Users can manage their own notifications" 
  ON user_notifications FOR ALL 
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE meal_generation_jobs IS 'Background jobs for AI meal generation';
COMMENT ON TABLE generated_meals IS 'AI-generated meal options from background jobs';
COMMENT ON TABLE meal_plans IS 'User-created meal plans with selected meals';
COMMENT ON TABLE plan_selected_meals IS 'Many-to-many relationship between plans and selected meals';
COMMENT ON TABLE user_notifications IS 'System notifications for users about job completion';