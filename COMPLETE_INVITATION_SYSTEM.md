# Complete Access Rights & Invitation System - February 15, 2026

## Overview
This document describes the complete user access rights and invitation lifecycle system for the DocStruc project management platform.

## System Flow

### 1. Create Accessors & Roles (Superuser)
**Location:** `/accessors` page

The superuser can create:
- **Accessors** (Zugreifer tab): Individual users who can be added to projects
  - Email, First/Last Name, Company, Phone
  - Type: Employee, Owner (Bauherr), Subcontractor (Nachunternehmer), Other
- **Roles** (Rollen tab): Permission templates with module-level permissions
  - Role name and description
  - Per-module permissions (view, create, edit, delete)

### 2. Create Project & Assign Roles/People (Superuser)
**Location:** `/manage-projects/:id` page

When creating or editing a project, the superuser can:

#### A. Define Available Roles for This Project
- **Section:** "Projektrollen"
- Select which roles (from the global roles list) should be available for assignment in this specific project
- These roles are stored in the `project_roles` junction table
- Only these selected roles will appear in the `/participants` page for this project

#### B. Add Project Members
- **Section:** "Beteiligte Personen"
- Select accessors from the unified dropdown
- Selected accessors are automatically added to `project_members` with `status='open'`
- All added members are saved to the database immediately upon clicking "Speichern"

**Key Points:**
- Members added here appear in ALL project views (assignments, participants, etc.)
- RLS policies grant actual project access based on `project_members` table
- Status starts as `open` until invited

### 3. Assign Roles & Manage Invitations (Superuser)
**Location:** `/project/:id/participants` page

This is where the superuser manages the invitation lifecycle:

#### A. View All Members with Status Filter
- **Tabs:** All / Offen / Eingeladen / Aktiv / Inaktiv
- Each member shows:
  - Name, email, company
  - Type badge (Employee, Owner, Subcontractor, Other)
  - Status badge with icon and color coding:
    - 🙋 **Offen** (Open) - Gray: Added but not yet invited
    - 📧 **Eingeladen** (Invited) - Orange: Invitation sent
    - ✅ **Aktiv** (Active) - Green: Registered/accepted
    - 🚫 **Inaktiv** (Inactive) - Red: Deactivated by superuser
  - Assigned role or warning if no role
  - Invited/accepted dates

#### B. Assign Roles to Members
For each member, the superuser can:
1. Click the action menu (⋮)
2. Select "Berechtigungen bearbeiten"
3. Choose either:
   - **Predefined Role:** Select from roles assigned to this project
   - **Custom Permissions:** Define module-by-module permissions

**Important:** Only roles that were selected in the "Projektrollen" section on the project management page will be available here.

#### C. Invite Members
**Individual Invite:**
- Each member with `status='open'` and an assigned role shows an "Einladen" button
- Clicking sends invitation email (if edge function configured) and changes status to `invited`

**Bulk Invite:**
- "Alle einladen" button at the top invites all open members who have roles assigned
- Useful for batch processing

**Warning:** Members without a role show a warning bar: "⚠️ Bitte Rolle zuweisen bevor Sie einladen können"

#### D. Manage Active/Inactive Members
Action menu (⋮) options:
- **Edit permissions:** Change role or custom permissions
- **Set inactive:** Change status to `inactive` - member loses project access
- **Reactivate:** Change status back to `active` - member regains access
- **Re-invite:** Send invitation email again (for invited or active members)
- **Remove:** Permanently delete member from project

### 4. Accept Invitation (End User)
**Location:** Invitation email → `/login?invite=<member_id>`

When a user receives an invitation:
1. Clicks the link in the email
2. If not registered: Creates account with the accessor's email
3. If already registered: Logs in
4. System calls `accept_project_invitation(invitation_token)` function
5. Member status changes from `invited` → `active`
6. User can now access the project with their assigned permissions

## Database Schema

### Core Tables

#### `user_accessors`
Accessor profiles created by superuser:
```sql
- id (UUID, PK)
- owner_id (UUID) → auth.users
- accessor_email (TEXT)
- accessor_first_name (TEXT)
- accessor_last_name (TEXT)
- accessor_company (TEXT)
- accessor_phone (TEXT)
- accessor_type (TEXT) → 'employee'|'owner'|'subcontractor'|'other'
- registered_user_id (UUID) → auth.users (when user registers)
- is_active (BOOLEAN)
- notes (TEXT)
```

#### `roles`
Permission templates:
```sql
- id (UUID, PK)
- user_id (UUID) → auth.users (superuser who created it)
- role_name (TEXT)
- role_description (TEXT)
- is_active (BOOLEAN)
```

#### `project_roles` ⭐ NEW
Junction table - which roles are available for each project:
```sql
- id (UUID, PK)
- project_id (UUID) → projects
- role_id (UUID) → roles
- UNIQUE(project_id, role_id)
```

#### `project_members` ⭐ ENHANCED
Who has access to which project + invitation status:
```sql
- id (UUID, PK)
- project_id (UUID) → projects
- user_id (UUID) → auth.users (NULL if not registered yet)
- accessor_id (UUID) → user_accessors
- member_type (TEXT) → from accessor_type
- role_id (UUID) → roles (NULL if custom permissions)
- role (TEXT) → 'owner'|'member'|'viewer' (legacy field)
- status (TEXT) → 'open'|'invited'|'active'|'inactive' ⭐ NEW
- invited_at (TIMESTAMPTZ) ⭐ NEW
- accepted_at (TIMESTAMPTZ) ⭐ NEW
- invitation_token (UUID) ⭐ NEW
```

#### `role_permissions`
Permissions for each role:
```sql
- role_id (UUID) → roles
- module_key (TEXT) → permission_modules
- can_view, can_create, can_edit, can_delete (BOOLEAN)
```

#### `project_member_permissions`
Custom permissions (overrides role):
```sql
- project_member_id (UUID) → project_members
- module_key (TEXT) → permission_modules
- can_view, can_create, can_edit, can_delete (BOOLEAN)
```

## Security (RLS)

### Access Control Flow

1. **Project Access Check** (`has_project_access()` function):
   ```sql
   - Check if user is project owner (created_by or owner_id)
   - OR check if user exists in project_members with status='active'
   ```

2. **Permission Check** (`check_user_permission()` RPC):
   ```sql
   - If project owner: return TRUE for all permissions
   - If active member with role: check role_permissions
   - If active member with custom: check project_member_permissions
   - Otherwise: return FALSE
   ```

3. **RLS Policies:**
   - All project data tables check `has_project_access(project_id)`
   - Only active members can see/modify project data
   - Inactive members are completely blocked

## Files Modified

### 1. ProjectManagementDetail.tsx
**Path:** `apps/web/src/pages/superuser/ProjectManagementDetail.tsx`

**Changes:**
- Added "Projektrollen" section with SearchableSelect for roles
- Added state: `availableRoles`, `selectedProjectRoleIds`
- `loadResources()`: Now loads both accessors and roles
- `loadLinkedPeople()`: Now loads project_roles from junction table
- `handleSave()`: Syncs both `project_roles` and `project_members` tables
- Shows current members with status badges

### 2. ProjectParticipants.tsx
**Path:** `apps/web/src/pages/project/ProjectParticipants.tsx`

**Changes:**
- Complete rewrite with invitation lifecycle
- Status filter tabs (All/Open/Invited/Active/Inactive)
- `loadData()`: Now loads roles from `project_roles` instead of all roles
- Per-member actions: Invite, Re-invite, Edit, Inactive, Reactivate, Remove
- Warning when no roles are assigned to project
- Bulk "Alle einladen" button
- Status badges with icons and color coding
- Invited/accepted date display
- Email invitation via edge function (with fallback)

### 3. Database Migrations

#### `20260215_project_roles_table.sql`
- Creates `project_roles` junction table
- Adds RLS policies for role-project relationships
- Creates indexes for performance

#### `20260215_member_status_and_invitations.sql`
- Adds `status`, `invited_at`, `accepted_at`, `invitation_token` columns to `project_members`
- Updates `has_project_access()` to only allow `status='active'`
- Updates `check_user_permission()` for active-only checks
- Updates `get_user_project_permissions()` for active-only
- Creates `accept_project_invitation(token)` function
- Migrates existing members to `status='active'`

## User Experience Flow

### Superuser Creates Project:
1. Go to `/manage-projects/new` → Create project
2. Go to `/manage-projects/:id` → Edit project
3. **Projektrollen section:** Select which roles should be available (e.g., "Bauleiter", "Architekt", "Bauherr")
4. **Beteiligte Personen section:** Add team members from accessors
5. Click "Speichern" → Members added with `status='open'`, roles linked to project

### Superuser Invites Members:
1. Open project → Go to "Beteiligte" tab
2. See all members with status "Offen" (gray badge)
3. For each member:
   - Click ⋮ → "Berechtigungen bearbeiten"
   - Select role (only shows roles from step 3 above) OR define custom permissions
   - Click "Speichern"
4. Click "Einladen" button on member card OR "Alle einladen" at top
5. Status changes to "Eingeladen" (orange badge)
6. Email sent (if edge function configured)

### End User Accepts:
1. User receives email with link
2. Clicks link → Redirected to login/register
3. After auth, `accept_project_invitation()` is called
4. Status changes to "Aktiv" (green badge)
5. User can now access project with their permissions

### Superuser Can Later:
- **Re-invite:** Send email again (for invited or active users)
- **Edit permissions:** Change role or permissions anytime
- **Set inactive:** Temporarily revoke access (red badge, can't see project)
- **Reactivate:** Restore access (back to green active)
- **Remove:** Permanently delete from project

## Edge Function (To Be Created)

**Name:** `send-invitation`

**Location:** `supabase/functions/send-invitation/index.ts`

**Purpose:** Send invitation emails via Resend or similar service

**Expected Input:**
```typescript
{
  to: string,              // accessor email
  inviterName: string,     // who invited
  projectName: string,     // project name
  inviteUrl: string,       // invitation link
  memberName: string       // invitee name
}
```

**Note:** ProjectParticipants gracefully handles missing edge function with console.warn and continues

## Testing Checklist

- [ ] Apply both migrations to database
- [ ] Create accessors on `/accessors` (Zugreifer tab)
- [ ] Create roles on `/accessors` (Rollen tab)
- [ ] Create project on `/manage-projects/new`
- [ ] Edit project → Select roles in "Projektrollen" → Add members → Save
- [ ] Verify members appear in project's "Beteiligte" tab with status "Offen"
- [ ] Assign role to member via edit permissions modal
- [ ] Verify only selected project roles appear in role dropdown
- [ ] Click "Einladen" on member → Status changes to "Eingeladen"
- [ ] Verify email sent (or warning if edge function missing)
- [ ] Test action menu: edit, inactive, reactivate, remove
- [ ] Test "Alle einladen" bulk action
- [ ] Test status filter tabs (all/open/invited/active/inactive)
- [ ] Verify inactive members cannot access project
- [ ] Test end-user invitation acceptance (if edge function created)

## Key Improvements

### Before:
- ❌ Members added in manage-projects didn't appear elsewhere
- ❌ No invitation system
- ❌ No status tracking
- ❌ All roles visible to all projects (confusing)
- ❌ No role assignment workflow
- ❌ No way to revoke/reactivate access

### After:
- ✅ Members sync properly between manage-projects and participants
- ✅ Complete invitation lifecycle (open → invited → active → inactive)
- ✅ Status-based access control in RLS
- ✅ Project-specific role scoping via `project_roles` junction table
- ✅ Clear workflow: add member → assign role → invite → accept
- ✅ Flexible member management (edit, inactive, reactivate, remove)
- ✅ Bulk invite capability
- ✅ Visual status indicators (badges, icons, colors)
- ✅ Helpful warnings when roles not assigned
- ✅ Email notifications (when edge function configured)

## Summary

The system now works exactly as requested:
1. **Superuser creates accessors and roles** on `/accessors`
2. **Superuser assigns roles and members to project** on `/manage-projects/:id`
3. **Superuser manages invitations** on `/project/:id/participants`
4. **Members progress through statuses:** open → invited → active (or inactive)
5. **Access control is status-aware:** Only active members can access project data
