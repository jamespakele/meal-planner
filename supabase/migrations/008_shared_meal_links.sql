-- Shared Meal Links System
-- Enables public sharing of generated meal collections via secure tokens

-- Create shared meal links table
CREATE TABLE shared_meal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES meal_generation_jobs(id) ON DELETE CASCADE NOT NULL,
  public_token VARCHAR(32) UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ, -- NULL = never expires
  access_count INTEGER DEFAULT 0 NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  
  -- Ensure only one active share link per job
  UNIQUE(job_id)
);

-- Create indexes for performance
CREATE INDEX idx_shared_meal_links_token ON shared_meal_links(public_token);
CREATE INDEX idx_shared_meal_links_job ON shared_meal_links(job_id);
CREATE INDEX idx_shared_meal_links_creator ON shared_meal_links(created_by, created_at DESC);

-- Enable Row Level Security
ALTER TABLE shared_meal_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared meal links
-- Users can create and manage share links for their own meal generation jobs
CREATE POLICY "Users can manage shared links for their jobs" 
  ON shared_meal_links FOR ALL 
  USING (
    job_id IN (
      SELECT id FROM meal_generation_jobs 
      WHERE user_id = auth.uid()
    )
  );

-- Anonymous users can view share link details via public token (for access tracking)
CREATE POLICY "Public access to shared meal links via token" 
  ON shared_meal_links FOR SELECT 
  USING (
    public_token IS NOT NULL 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Grant permissions for anonymous access to the table
GRANT SELECT ON shared_meal_links TO anon;

-- Update RLS policies for generated_meals to allow public access via shared links
-- This policy allows anonymous users to view meals if they have a valid share link
CREATE POLICY "Public access to meals via shared link" 
  ON generated_meals FOR SELECT 
  USING (
    job_id IN (
      SELECT job_id FROM shared_meal_links 
      WHERE (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- Allow anonymous users to read meals table for public sharing
GRANT SELECT ON generated_meals TO anon;

-- Update RLS policies for meal_generation_jobs to allow minimal public access
-- This allows fetching job details (plan name, dates) for shared meal collections
CREATE POLICY "Public access to job details via shared link" 
  ON meal_generation_jobs FOR SELECT 
  USING (
    id IN (
      SELECT job_id FROM shared_meal_links 
      WHERE (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- Allow anonymous users to read basic job info for shared meals
GRANT SELECT ON meal_generation_jobs TO anon;

-- Function to increment access count atomically
CREATE OR REPLACE FUNCTION increment_shared_meal_access(token_value VARCHAR)
RETURNS void AS $$
BEGIN
    UPDATE shared_meal_links 
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE public_token = token_value 
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_shared_meal_access(VARCHAR) TO authenticated, anon;

-- Create view for active shared links (for easier querying)
CREATE OR REPLACE VIEW active_shared_meal_links AS
SELECT 
  sml.*,
  mgj.plan_name,
  mgj.week_start,
  mgj.total_meals_generated,
  mgj.created_at as job_created_at
FROM shared_meal_links sml
JOIN meal_generation_jobs mgj ON mgj.id = sml.job_id
WHERE sml.expires_at IS NULL OR sml.expires_at > NOW();

-- Grant access to the view
GRANT SELECT ON active_shared_meal_links TO authenticated, anon;

-- Add comments for documentation
COMMENT ON TABLE shared_meal_links IS 'Public shareable links for meal generation results';
COMMENT ON COLUMN shared_meal_links.public_token IS 'Secure random token for public access';
COMMENT ON COLUMN shared_meal_links.expires_at IS 'Optional expiration date (NULL = never expires)';
COMMENT ON COLUMN shared_meal_links.access_count IS 'Number of times the shared link was accessed';
COMMENT ON FUNCTION increment_shared_meal_access IS 'Atomically increment access count and update last accessed time';