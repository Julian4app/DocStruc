# Database Migration Instructions

## Important: Apply These SQL Migrations in Supabase

You need to run the following SQL migrations in your Supabase SQL Editor to fix the database issues:

### 1. Fix Structure RLS Policies (Buildings, Floors, Rooms)
**File:** `supabase/migrations/20260208_fix_structure_rls.sql`

This migration fixes the "new row violates row-level security policy for table 'buildings'" error by adding proper RLS policies for buildings, floors, and rooms tables.

**To Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20260208_fix_structure_rls.sql`
3. Paste and run the SQL
4. Verify: Try adding a new "Gebäude" in the project detail page

### 2. Create Project Timeline Table
**File:** `supabase/migrations/20260208_create_timeline_table.sql`

This migration creates the missing `project_timeline` table that stores milestones.

**To Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20260208_create_timeline_table.sql`
3. Paste and run the SQL
4. Verify: Try adding a "Meilenstein" in the project detail page - it should now appear in the timeline

## Summary of All Fixes Applied

### ✅ 1. OpenStreetMap Display on Project Cards
**What was wrong:** Map URLs were using city names directly which doesn't work with OSM static map services.

**Fix:** Updated `ProjectCard.tsx` to use proper OpenStreetMap static map service with coordinates:
- Uses `staticmap.openstreetmap.de` API
- Detects Vienna postal codes and sets appropriate coordinates
- Shows map with a red marker at the location
- Fallback to default Vienna center if address can't be parsed

**Result:** Maps now display properly on project cards when an address is set.

---

### ✅ 2. Superuser Can't Add Buildings (RLS Error)
**What was wrong:** No RLS policies existed for `buildings`, `floors`, and `rooms` tables.

**Fix:** Created comprehensive RLS policies in `20260208_fix_structure_rls.sql`:
- Buildings: Project members can view/create/update/delete
- Floors: Project members can manage floors within their project's buildings
- Rooms: Project members can manage rooms within their project's floors
- Uses existing `has_project_access()` function for permission checks

**Result:** Superusers and project members can now add Gebäude, Etagen, and Räume without RLS errors.

---

### ✅ 3. Milestones Not Showing After Creation
**What was wrong:** The `project_timeline` table didn't exist in the database.

**Fix:** Created the table in `20260208_create_timeline_table.sql`:
- Table structure: id, project_id, title, date, eventType, completed
- Full RLS policies for project members
- Indexes for performance

**Result:** Milestones now save and display correctly in the timeline section.

---

### ✅ 4. Permission Check for Adding Project Members
**What was wrong:** Any user could add members to a project, no permission check.

**Fix:** Updated `ProjectDetail.tsx`:
- Added `canManageMembers` permission check (only project owners can add members)
- Hide invite form for non-owners
- Show error toast if unauthorized user tries to add members
- Uses existing `useProjectPermissions` hook

**Result:** Only project owners can now add new members to projects.

---

### ✅ 5. Improved Project Overview Design
**What was wrong:** Project cards and dashboard looked "boring" and basic.

**Fix:** Enhanced visual design:

**ProjectCard.tsx:**
- Increased card height and visual hierarchy
- Enhanced hover effects with scale and lift animation
- Better shadows and border styling
- Larger, bolder typography with better spacing
- Enhanced status badges with shadows
- Improved footer with primary-colored arrow button
- Better map overlay styling
- Increased media container height (180px)

**Dashboard.tsx:**
- Changed from flexbox to CSS Grid layout
- Auto-fill grid with min 380px columns
- Increased gap between cards (24px)
- Better responsive layout

**Result:** Project overview now has a modern, polished, professional appearance with smooth animations and better visual hierarchy.

## Testing Checklist

After applying the migrations and reloading the app, verify:

- [ ] Project cards show OpenStreetMap when address is set
- [ ] Can add new "Gebäude" without RLS errors
- [ ] Can add new "Etage" to buildings
- [ ] Can add new "Raum" to floors
- [ ] Can add "Meilenstein" and it appears in timeline
- [ ] Milestones can be marked as completed
- [ ] Only project owner sees "Benutzer einladen" section
- [ ] Non-owners cannot add members (get error message)
- [ ] Project cards have improved visual design
- [ ] Hover effects work smoothly
- [ ] Grid layout adapts responsively

## Notes

- The OpenStreetMap implementation uses Vienna-specific coordinates. For production, consider:
  - Storing lat/lon in the database with projects
  - Using a proper geocoding service
  - Or using a more robust map tile service with API key

- The permission system uses the existing `has_project_access()` function which checks both project ownership and membership.

- All database changes are in migration files that can be version controlled and re-run on other environments.
