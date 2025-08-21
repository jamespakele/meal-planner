# RLS Infinite Recursion Fix - Complete Solution

## Problem Summary

**Issue**: "Meal Generation failed: Failed to fetch jobs" error in UI
**Root Cause**: `Error fetching meal generation jobs: { code: '42P17', message: 'infinite recursion detected in policy for relation "meal_generation_jobs"' }`
**Impact**: Users see meal generation failure even though background processing may be working correctly

## Error Analysis

### Current Error Flow
1. ✅ User clicks "Generate Meals" → Job created successfully (POST returns 200)
2. ✅ Background processing starts → Meal generation begins in background
3. ❌ UI polling fails → GET `/api/meal-generation/jobs?jobId=xxx` returns 500 Internal Server Error
4. ❌ UI shows error → "Meal Generation failed: Failed to fetch jobs"
5. ❌ User experience broken → Appears to fail even if background job succeeds

### Technical Details
- **Error Code**: 42P17 (PostgreSQL infinite recursion)
- **Location**: `src/app/api/meal-generation/jobs/route.ts:185-210`
- **Query**: `supabase.from('meal_generation_jobs').select(...).eq('user_id', user.id)`
- **Issue**: RLS policy evaluation creates circular dependency

## Solution: Migration 014

### Migration File: `supabase/migrations/014_final_rls_recursion_fix.sql`

This migration:
1. **Completely disables RLS** during migration to avoid issues
2. **Drops ALL existing policies** on `meal_generation_jobs` table
3. **Drops any functions** that might cause recursion
4. **Creates simple policy**: `user_id = auth.uid()` with no function calls
5. **Adds service role bypass** for SECURITY DEFINER functions
6. **Tests policy immediately** after creation

### Key Policy Changes

**Before (Problematic)**:
```sql
-- Complex policies with potential circular dependencies
CREATE POLICY "Users can manage their own meal generation jobs" 
  ON meal_generation_jobs USING (check_job_ownership(id));
```

**After (Fixed)**:
```sql
-- Simple, direct comparison with no function calls
CREATE POLICY "meal_jobs_user_access" 
  ON meal_generation_jobs 
  FOR ALL 
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## Application Instructions

### Step 1: Apply Migration in WSL2

```bash
# Navigate to meal-planner directory in WSL2
cd /path/to/meal-planner

# Option A: Reset database (applies all migrations)
supabase db reset

# Option B: Apply only pending migrations
supabase migration up
```

### Step 2: Restart Services

```bash
# Restart Supabase to ensure migration is fully applied
supabase stop
supabase start
```

### Step 3: Verify Fix

#### Browser Testing
1. Navigate to `http://localhost:3000/dashboard`
2. Create a meal plan and assign meals to groups
3. Click "Generate Meals" button
4. **Expected**: UI shows progress instead of "Failed to fetch jobs"
5. **Check**: Browser Network tab shows 200 OK for job polling

#### Server Log Verification
- **Before Fix**: `Error fetching meal generation jobs: infinite recursion detected`
- **After Fix**: Normal job processing without RLS errors

## Success Criteria

### ✅ API Endpoints
- GET `/api/meal-generation/jobs` returns 200 or 401, **NOT 500**
- GET `/api/meal-generation/jobs?jobId=xxx` returns 200 or 401, **NOT 500**
- No "infinite recursion detected" errors in server logs

### ✅ UI Behavior
- Meal generation shows proper progress: "Generating meals... 30% complete"
- No "Meal Generation failed: Failed to fetch jobs" error
- Complete workflow from trigger to completion works

### ✅ Background Processing
- Job creation continues to work (POST endpoint unaffected)
- Background meal generation processing continues normally
- SECURITY DEFINER functions still bypass RLS correctly

## Testing Verification

### Automated Tests Created
1. `src/lib/__tests__/rls-policies-meal-jobs.test.ts` - RLS policy tests
2. `src/lib/__tests__/api-meal-jobs-500-error.test.ts` - Error reproduction
3. `src/lib/__tests__/rls-fix-verification.test.ts` - Fix verification
4. `src/lib/__tests__/api-job-polling-fixed.test.ts` - Post-fix validation

### Manual Testing Checklist
- [ ] Apply migration 014 in WSL2 Supabase
- [ ] Restart Supabase services
- [ ] Test meal generation in browser
- [ ] Verify no 500 errors in API calls
- [ ] Confirm job polling shows progress
- [ ] Complete end-to-end meal generation workflow

## Technical Implementation

### RLS Policy Structure
```sql
-- User access policy (simple auth.uid() comparison)
CREATE POLICY "meal_jobs_user_access" 
    ON meal_generation_jobs 
    FOR ALL 
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role bypass (for SECURITY DEFINER functions)
CREATE POLICY "meal_jobs_service_role_bypass" 
    ON meal_generation_jobs 
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);
```

### Why This Works
- **No function calls**: Eliminates circular dependency risk
- **Direct comparison**: `auth.uid() = user_id` is evaluated directly by PostgreSQL
- **Service role bypass**: Maintains SECURITY DEFINER function compatibility
- **Simple logic**: Reduces complexity that could cause recursion

## Rollback Plan

If migration 014 causes issues:

1. **Revert migration**: `supabase db reset` to previous state
2. **Alternative approach**: Disable RLS temporarily for debugging
3. **Fallback option**: Use application-level access control

### Alternative Solutions
- Use SECURITY DEFINER functions for all meal_generation_jobs operations
- Implement row-level filtering in application code
- Create even simpler policies with explicit user checks

## Files Modified/Created

### Migration Files
- `supabase/migrations/014_final_rls_recursion_fix.sql` - **NEW** (main fix)

### Test Files Created
- `src/lib/__tests__/rls-policies-meal-jobs.test.ts`
- `src/lib/__tests__/api-meal-jobs-500-error.test.ts`
- `src/lib/__tests__/rls-fix-verification.test.ts`
- `src/lib/__tests__/api-job-polling-fixed.test.ts`

### Documentation
- `RLS_INFINITE_RECURSION_FIX.md` - This comprehensive fix guide

## Expected Outcome

**Before Fix**:
- ❌ UI: "Meal Generation failed: Failed to fetch jobs"
- ❌ Browser: 500 Internal Server Error
- ❌ Server: "infinite recursion detected in policy"

**After Fix**:
- ✅ UI: "Generating meals... 30% complete" → "5 meals generated successfully!"
- ✅ Browser: 200 OK responses
- ✅ Server: Normal job processing without RLS errors

This fix eliminates the root cause of infinite recursion while maintaining proper user data isolation and security.