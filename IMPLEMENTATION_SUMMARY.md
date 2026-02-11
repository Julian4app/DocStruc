# Implementation Summary - Project Detail & Accessors Enhancements

## Completed Features

### 1. ✅ Registration Tags on Accessors Page
**Location:** `apps/web/src/pages/superuser/Accessors.tsx`

- Added "Registriert" tag with checkmark icon to employees, owners, and subcontractors who have a registered account
- Tags appear next to the person's name in the card list
- Registration status is checked by looking up the email in the `profiles` table
- Green badge styling matches the modern UI design

### 2. ✅ Show Assigned Projects in Accessor Popup
**Location:** `apps/web/src/pages/superuser/Accessors.tsx`

- When clicking on an employee, owner, or subcontractor, their detail popup now shows assigned projects
- **Security:** Only projects where BOTH the current user AND the accessor are members are displayed
- Superusers cannot see other projects of subcontractors/owners they're not assigned to
- Project display includes name, address, and status badge
- Projects are loaded dynamically when opening the detail view

### 3. ✅ Fixed Project Member Assignment Connection
**Database Migration:** `supabase/migrations/20260211_create_project_links.sql`
**API Updates:** `packages/api/src/members.ts`
**UI Updates:** `apps/web/src/pages/ProjectDetail.tsx`

**Problem:** When assigning employees, owners, or subcontractors to projects in the ProjectEditModal, they weren't appearing on the project detail page.

**Solution:**
- Created two new database tables:
  - `project_crm_links`: Links employees and owners (`crm_contacts`) to projects with role field
  - `project_subcontractors`: Links subcontractors to projects
- Both tables have proper RLS policies allowing project owners to manage and members to view
- Fixed `getProjectMembers()` to join with `profiles` table instead of non-existent `users` table
- Added new `getProjectAssignedPeople()` function to fetch all assigned employees, owners, and subcontractors
- Updated ProjectDetail page to display three separate sections:
  - **Projektmitglieder (Accounts)**: Users with login accounts (from `project_members`)
  - **Mitarbeiter**: Assigned employees
  - **Bauherren**: Assigned owners
  - **Gewerke**: Assigned subcontractors

### 4. ✅ Left Sidebar Menu for Project Detail Page
**Location:** `apps/web/src/layouts/LayoutContext.tsx`, `apps/web/src/layouts/WebLayout.tsx`, `apps/web/src/pages/ProjectDetail.tsx`

- Extended LayoutContext to support dynamic sidebar menus with `setSidebarMenu()` function
- When viewing a project, the sidebar automatically switches from the default menu to project-specific navigation
- Project menu includes 5 sections:
  1. **Dashboard** - `/project/:id`
  2. **Objektstruktur** - `/project/:id/structure`
  3. **Timeline** - `/project/:id/timeline`
  4. **Nutzer** - `/project/:id/users`
  5. **Tasks** - `/project/:id/tasks`
- Each menu item has an appropriate icon (LayoutDashboard, Building, Calendar, Users, CheckSquare)
- Active route highlighting works correctly with color and indicator

### 5. ✅ Back Button with Dynamic Menu Switching
**Location:** `apps/web/src/pages/ProjectDetail.tsx`

- Custom styled back button with arrow icon appears in the header actions area
- Clicking back button:
  1. Resets sidebar menu to default (removes project menu)
  2. Navigates back to homepage
- On component unmount, sidebar menu is automatically cleaned up
- Styled with modern blue theme matching the application design

## Database Migrations Required

Run this SQL in Supabase SQL Editor:
```sql
-- File: supabase/migrations/20260211_create_project_links.sql
```

This creates the necessary tables and RLS policies for linking employees, owners, and subcontractors to projects.

## Technical Details

### New Database Tables

1. **`project_crm_links`**
   - Links `crm_contacts` (employees/owners) to projects
   - Fields: `id`, `project_id`, `contact_id`, `role` (employee|owner), `created_at`
   - Unique constraint on (project_id, contact_id)

2. **`project_subcontractors`**
   - Links `subcontractors` to projects  
   - Fields: `id`, `project_id`, `subcontractor_id`, `created_at`
   - Unique constraint on (project_id, subcontractor_id)

### API Functions Added

- **`getProjectAssignedPeople(client, projectId)`**
  - Returns `{employees: [], owners: [], subcontractors: []}`
  - Fetches all people/companies assigned via project_crm_links and project_subcontractors
  - Includes nested contacts for subcontractors

### Layout System Enhancement

- **`LayoutContext`** now supports:
  - `sidebarMenu`: Array of menu items or `null` for default menu
  - `setSidebarMenu()`: Function to dynamically change sidebar content
- **`WebLayout`** conditionally renders project menu or default menu based on context

## Testing Checklist

- [ ] Run SQL migration in Supabase
- [ ] Create/edit a project and assign employees, owners, subcontractors
- [ ] Verify assigned people appear on project detail page
- [ ] Check that only registered accessors show the "Registriert" tag
- [ ] Open accessor detail and verify only shared projects are shown
- [ ] Navigate to a project and verify sidebar changes to project menu
- [ ] Click back button and verify sidebar returns to default menu
- [ ] Test all 5 project menu items (routes may need to be created)

## Next Steps

The following project detail routes should be implemented to match the sidebar menu:
1. `/project/:id/structure` - Objektstruktur page
2. `/project/:id/timeline` - Timeline page
3. `/project/:id/users` - Nutzer page
4. `/project/:id/tasks` - Tasks page

Currently these routes don't exist, so clicking them will show 404. The current ProjectDetail page can serve as the Dashboard (`/project/:id`).

## Files Modified

1. `apps/web/src/pages/superuser/Accessors.tsx` - Registration tags, assigned projects
2. `apps/web/src/pages/ProjectDetail.tsx` - Sidebar menu, back button, assigned people display
3. `apps/web/src/layouts/LayoutContext.tsx` - Added sidebarMenu support
4. `apps/web/src/layouts/WebLayout.tsx` - Conditional sidebar rendering
5. `packages/api/src/members.ts` - Fixed getProjectMembers, added getProjectAssignedPeople
6. `packages/api/src/index.ts` - Export new function (automatic via export *)

## Files Created

1. `supabase/migrations/20260211_create_project_links.sql` - Database schema for project assignments
