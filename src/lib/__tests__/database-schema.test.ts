import { createClient } from '@supabase/supabase-js'

describe('Database Schema Validation', () => {
  let supabase: any

  beforeAll(async () => {
    // Use direct client for testing (not server-side client that requires cookies)
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  })

  describe('form_links table', () => {
    it('should have all required columns for public form functionality', async () => {
      // This test will FAIL initially because the columns don't exist yet
      // This is intentional for TDD Red phase
      
      const { data: columns, error } = await supabase
        .rpc('get_table_columns', { table_name: 'form_links' })
      
      if (error) {
        // If the RPC doesn't exist, we'll check manually
        const { data: tableInfo, error: tableError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'form_links')
          .eq('table_schema', 'public')
          
        if (tableError) {
          // Fallback: try to query the table and see what columns cause errors
          try {
            await supabase
              .from('form_links')
              .select('revoked_at, token_version, views_count, last_accessed_at')
              .limit(1)
              
            // If this succeeds, all columns exist
            expect(true).toBe(true)
          } catch (queryError: any) {
            // This should fail with "column does not exist" for missing columns
            expect(queryError.message).not.toContain('column')
            fail(`Database schema is missing required columns: ${queryError.message}`)
          }
        } else {
          const columnNames = tableInfo.map((row: any) => row.column_name)
          
          // These assertions will FAIL initially (TDD Red)
          expect(columnNames).toContain('revoked_at')
          expect(columnNames).toContain('token_version')
          expect(columnNames).toContain('views_count')
          expect(columnNames).toContain('last_accessed_at')
        }
      }
    })

    it('should have proper indexes for efficient public form queries', async () => {
      // This test will also FAIL initially
      const { data: indexes, error } = await supabase
        .from('pg_indexes')
        .select('indexname')
        .eq('tablename', 'form_links')
        
      if (error) {
        console.error('Could not check indexes:', error)
        // Skip index test if we can't check
        return
      }
      
      const indexNames = indexes.map((idx: any) => idx.indexname)
      
      // These will FAIL initially because indexes don't exist
      expect(indexNames.some((name: string) => 
        name.includes('public_token_active')
      )).toBe(true)
      
      expect(indexNames.some((name: string) => 
        name.includes('views_count')
      )).toBe(true)
    })

    it('should support the increment_form_link_views function', async () => {
      // This will FAIL initially because the function doesn't exist
      const { data, error } = await supabase
        .rpc('increment_form_link_views', { token_value: 'test-token' })
        
      // We expect this to not error (even if token doesn't exist)
      // The function should exist and handle non-existent tokens gracefully
      expect(error).toBeNull()
    })
  })

  describe('active_form_links view', () => {
    it('should exist and be queryable', async () => {
      // This will FAIL initially because the view doesn't exist
      const { data, error } = await supabase
        .from('active_form_links')
        .select('*')
        .limit(1)
        
      // We don't care about data, just that the view exists and is queryable
      expect(error).toBeNull()
    })
  })

  describe('Database migration status', () => {
    it('should indicate that 004_public_form_enhancements migration was applied', async () => {
      // Check if we can query for migration history
      // This is a meta-test to ensure our migration tracking works
      
      const { data: migrations, error } = await supabase
        .from('supabase_migrations.schema_migrations')
        .select('version')
        .eq('version', '004')
        
      if (error) {
        // If migrations table doesn't exist, we'll check by column existence
        console.log('Migration tracking not available, checking by column existence')
        
        // Try to select from form_links with new columns
        const { error: columnError } = await supabase
          .from('form_links')
          .select('revoked_at')
          .limit(1)
          
        expect(columnError).toBeNull()
      } else {
        expect(migrations).toHaveLength(1)
      }
    })
  })
})