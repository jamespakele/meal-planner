-- Enhance form_links table for public meal viewing system
-- Add analytics and security columns to existing form_links table

-- Add analytics and security tracking columns
ALTER TABLE form_links 
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS views_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient public token lookups (without NOW() for immutability)
CREATE INDEX IF NOT EXISTS idx_form_links_public_token_active 
ON form_links(public_token) 
WHERE revoked_at IS NULL;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_form_links_views_count ON form_links(views_count);
CREATE INDEX IF NOT EXISTS idx_form_links_last_accessed ON form_links(last_accessed_at);

-- Add comment for documentation
COMMENT ON COLUMN form_links.revoked_at IS 'Timestamp when token was revoked (NULL = active)';
COMMENT ON COLUMN form_links.token_version IS 'Version number for token rotation tracking';
COMMENT ON COLUMN form_links.views_count IS 'Number of times the public form was accessed';
COMMENT ON COLUMN form_links.last_accessed_at IS 'Last time the public form was accessed';

-- Create function to increment view count atomically
CREATE OR REPLACE FUNCTION increment_form_link_views(token_value VARCHAR)
RETURNS void AS $$
BEGIN
    UPDATE form_links 
    SET views_count = views_count + 1,
        last_accessed_at = NOW()
    WHERE public_token = token_value 
    AND revoked_at IS NULL 
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_form_link_views(VARCHAR) TO authenticated, anon;

-- Create view for active form links (for easier querying)
CREATE OR REPLACE VIEW active_form_links AS
SELECT *
FROM form_links
WHERE revoked_at IS NULL 
AND (expires_at IS NULL OR expires_at > NOW());

-- Grant access to the view
GRANT SELECT ON active_form_links TO authenticated, anon;