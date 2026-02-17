# Content Visibility Security Implementation

## Overview
This document explains the backend RLS (Row Level Security) policies that enforce content visibility rules at the database level, ensuring the highest security standards.

## What Was Implemented

### 1. Helper Function
**File:** `20260217_visibility_helper_functions.sql`

Created `can_user_see_content()` function that:
- Checks content_visibility_overrides for item-specific rules
- Falls back to project_content_defaults for module-level rules
- Implements team_only logic by comparing user's team with creator's team
- Returns boolean indicating if user can see the content

### 2. RLS Policies
**File:** `20260217_implement_content_visibility_rls.sql`

Implemented visibility-aware SELECT policies on:

| Table | Module Key | Creator Field | Notes |
|-------|-----------|---------------|-------|
| `tasks` | `tasks` or `defects` | `creator_id` | Differentiates via `task_type` field |
| `diary_entries` | `diary` | `created_by` | Daily construction diary |
| `project_messages` | `communication` | `user_id` | Messages and notes (via `message_type`) |
| `project_files` | `files` | `uploaded_by` | File uploads |
| `task_documentation` | `documentation` | `created_by` | Task-related documentation |
| `project_timeline` | `schedule` | none | Milestones have no creator |

### Policy Logic

Each policy follows this pattern:

```sql
-- 1. Allow project owners
auth.uid() IN (SELECT owner_id FROM projects WHERE id = <table>.project_id)

OR

-- 2. Allow superusers
auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true)

OR

-- 3. Check visibility rules for regular project members
(
  has_project_access(<table>.project_id)  -- Must be a project member
  AND
  <visibility logic>  -- Check overrides and defaults
)
```

### Visibility Levels

1. **all_participants**: Everyone in the project can see the content
2. **team_only**: Only members of the creator's team can see the content
3. **owner_only**: Only the project owner can see the content

## How It Works

### Override Priority
1. Check `content_visibility_overrides` for item-specific visibility
2. If no override, use `project_content_defaults` for module-level default
3. If no default set, fallback to `all_participants`

### Team Matching
For `team_only` visibility:
- User's team is determined by: `project_members.member_team_id` OR `profiles.team_id`
- Creator's team is determined by: `project_members.member_team_id` OR `profiles.team_id`
- Teams must match AND user must have a team (not NULL)
- Creator always sees their own content

### Special Cases
- **Project owner**: Can see everything regardless of visibility
- **Superusers**: Can see everything regardless of visibility
- **Item creator**: Can always see their own content (checked in team_only logic)
- **No creator field**: (e.g., milestones) - visibility rules still apply but creator checks are skipped

## Applying the Migrations

### Prerequisites
1. Supabase CLI installed
2. Supabase project linked: `supabase link --project-ref your-project-ref`
3. Database access configured

### Step 1: Apply Helper Functions
```bash
supabase db push supabase/migrations/20260217_visibility_helper_functions.sql
```

This creates the `can_user_see_content()` function.

### Step 2: Apply RLS Policies
```bash
supabase db push supabase/migrations/20260217_implement_content_visibility_rls.sql
```

This drops old permissive policies and creates visibility-aware policies.

### Alternative: Push All Pending Migrations
```bash
supabase db push
```

## Testing the Implementation

### Test Case 1: Superuser Access
**Setup:**
- Login as superuser
- Set `/defects` module to "team_only"
- Create a defect as Team A member

**Expected Result:**
- Superuser can see all defects regardless of team

### Test Case 2: Team Only - Same Team
**Setup:**
- Login as Team A member (not owner, not superuser)
- Another Team A member creates a defect
- Module default is "team_only"

**Expected Result:**
- Team A member can see the defect

### Test Case 3: Team Only - Different Team
**Setup:**
- Login as Team B member (not owner, not superuser)
- Team A member creates a defect
- Module default is "team_only"

**Expected Result:**
- Team B member CANNOT see the defect (filtered by RLS)

### Test Case 4: Item Override
**Setup:**
- Module default is "team_only"
- Create a defect as Team A member
- Set item-specific override to "all_participants"

**Expected Result:**
- All project members can see this defect, regardless of team

### Test Case 5: Owner Access
**Setup:**
- Login as project owner (not superuser)
- Set module to "team_only"
- Team A member creates content

**Expected Result:**
- Project owner can see all content regardless of visibility settings

### Verification Queries

Check if policies are active:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('tasks', 'diary_entries', 'project_messages', 'project_files', 'task_documentation', 'project_timeline')
AND policyname LIKE '%visibility%';
```

Check if function exists:
```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_name = 'can_user_see_content';
```

Test visibility filtering (as regular user):
```sql
-- Should only return items you're allowed to see
SELECT id, creator_id, project_id
FROM tasks
WHERE project_id = 'your-project-id';
```

## Client-Side vs Server-Side

### Client-Side Filtering (useContentVisibility hook)
- **Purpose**: UX optimization - hide items before they render
- **Location**: `apps/web/src/hooks/useContentVisibility.tsx`
- **Security**: NOT secure - can be bypassed in browser

### Server-Side RLS (these migrations)
- **Purpose**: Security enforcement - prevent unauthorized data access
- **Location**: Database policies
- **Security**: Fully secure - enforced by Postgres, cannot be bypassed

### Why Both?
- **RLS is the security layer** - prevents data exfiltration via API
- **Client filtering is the UX layer** - provides instant feedback without network calls
- Both use the same logic so they produce consistent results

## Troubleshooting

### Issue: User can't see their own content
**Cause**: User's team_id is NULL in both `profiles` and `project_members`
**Solution**: Ensure users have a team assigned:
```sql
UPDATE project_members 
SET member_team_id = 'team-uuid'
WHERE user_id = 'user-uuid' AND project_id = 'project-uuid';
```

### Issue: RLS policy is too slow
**Cause**: Complex subqueries on large tables
**Solution**: Add indexes:
```sql
CREATE INDEX idx_content_visibility_overrides_lookup 
ON content_visibility_overrides(module_key, content_id);

CREATE INDEX idx_project_content_defaults_lookup 
ON project_content_defaults(project_id, module_key);

CREATE INDEX idx_project_members_team_lookup 
ON project_members(project_id, user_id, member_team_id);
```

### Issue: Policies conflict with existing data
**Cause**: Old data doesn't have `creator_id` or team assignments
**Solution**: Backfill missing data:
```sql
-- Add creator_id to tasks that only have created_by
UPDATE tasks 
SET creator_id = created_by 
WHERE creator_id IS NULL AND created_by IS NOT NULL;
```

## Security Considerations

### ✅ What's Protected
- Unauthorized users cannot query content outside their visibility level
- API calls that try to fetch restricted content return empty results
- Even if client code is modified, RLS prevents data exposure
- Superusers and project owners have appropriate elevated access

### ⚠️ What's NOT Protected by These Policies
- **INSERT/UPDATE/DELETE operations**: These migrations only add SELECT policies
  - Users can still create/edit/delete content they have project access to
  - Additional policies needed if you want to restrict who can create/modify content
- **Storage/Files**: The `project_files` table is protected, but Supabase Storage bucket policies are separate
  - Need to ensure storage policies also check visibility
- **Realtime subscriptions**: Supabase Realtime may bypass RLS in some configurations
  - Ensure realtime is configured to respect RLS

### Next Steps for Complete Security
1. Add INSERT/UPDATE/DELETE policies with visibility checks
2. Update Supabase Storage policies to match content visibility
3. Configure Realtime to respect RLS policies
4. Add audit logging for visibility changes
5. Create migration to backfill missing creator fields

## Maintenance

### Adding a New Content Type
1. Add module_key to `project_content_defaults` table
2. Update `useContentVisibility` hook to support the new module
3. Create RLS policy following the pattern in `20260217_implement_content_visibility_rls.sql`
4. Add UI controls in the new content page

### Changing Visibility Logic
1. Update `can_user_see_content()` function
2. Update RLS policies if needed
3. Update `useContentVisibility` hook to match
4. Test thoroughly - changes affect security!

## References
- **Client Hook**: `apps/web/src/hooks/useContentVisibility.tsx`
- **UI Components**: `apps/web/src/components/VisibilityControls.tsx`
- **Database Schema**: `supabase/migrations/20240204_initial_schema.sql`
- **Visibility Tables**: `project_content_defaults`, `content_visibility_overrides`
