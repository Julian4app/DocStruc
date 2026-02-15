# Access Rights Fix - January 2026

## Problem Statement
Users added via "Beteiligte Personen" section in the project management page (`/manage-projects/:id`) were not appearing in the `/participants` page and did not have actual project access.

## Root Cause
Two separate systems existed for managing people:

1. **CRM System** (`crm_contacts` + `project_crm_links`)
   - Used for contact management
   - NOT connected to access control
   - Was being used by ProjectManagementDetail.tsx

2. **Access Control System** (`user_accessors` + `project_members`)
   - Used for actual project permissions and access
   - Used by ProjectParticipants.tsx and all permission checks
   - Used by RLS policies (`has_project_access()` function)

## Solution Implemented

### 1. Database Architecture
The access control flow:
```
user_accessors (accessor profiles)
    ↓ (accessor_id)
project_members (who has access to which project)
    ↓ (permissions check)
All project data (tasks, defects, buildings, etc.)
```

Key tables:
- `user_accessors`: Contains accessor profiles (email, name, type, company)
- `project_members`: Links accessors to projects with roles/permissions
- `roles` + `role_permissions`: Define permission templates
- `project_member_permissions`: Override permissions per member

### 2. Code Changes

#### ProjectManagementDetail.tsx
**Before:**
- Loaded from `crm_contacts` and `subcontractors`
- Saved to `project_crm_links` and `project_subcontractors`
- Had separate dropdowns for employees, owners, and subcontractors

**After:**
- Loads from `user_accessors` (all accessor types)
- Saves to `project_members` (actual access control table)
- Single unified dropdown showing all accessors with type badges
- Displays current members with color-coded type indicators
- Automatically syncs `project_members` when saving

#### Key Functions Modified:

**loadResources():**
```typescript
// Now loads user_accessors instead of crm_contacts
const { data: accessorsData } = await supabase
  .from('user_accessors')
  .select('*')
  .eq('owner_id', user.id)
  .eq('is_active', true);
```

**loadLinkedPeople():**
```typescript
// Now loads project_members with accessor details
const { data: membersData } = await supabase
  .from('project_members')
  .select(`*, accessor:user_accessors(*)`)
  .eq('project_id', id);
```

**handleSave():**
```typescript
// Now syncs project_members (actual access control)
// 1. Gets existing members
// 2. Calculates diff (toAdd, toRemove)
// 3. Deletes unselected members (+ their permissions)
// 4. Inserts new members with:
//    - accessor_id (link to user_accessors)
//    - user_id (registered_user_id from accessor)
//    - member_type (from accessor.accessor_type)
//    - role: 'member'
```

### 3. UI Improvements

**New Features:**
- Single unified SearchableSelect for all accessor types
- Type labels in dropdown: Mitarbeiter, Bauherr, Nachunternehmer, Sonstige
- Company names shown in dropdown subtitles
- Current members overview section below the dropdown
- Color-coded type badges:
  - Employee: Blue (#3B82F6)
  - Owner: Green (#10B981)
  - Subcontractor: Orange (#F59E0B)
  - Other: Gray (#6B7280)
- Helpful text explaining that selected users get project access

**Removed:**
- Three separate dropdowns (employees, owners, subcontractors)
- CRM-based contact selection

### 4. Data Flow

**When a superuser adds people in manage-projects:**
1. User selects accessors from unified dropdown
2. On save, `project_members` rows are created/updated
3. Each member gets:
   - Link to accessor profile (`accessor_id`)
   - Link to auth user if registered (`user_id`)
   - Member type from accessor (`member_type`)
   - Default role (`member`)

**Access Control:**
1. All RLS policies check `has_project_access()` function
2. Function checks if `auth.uid()` is project owner OR exists in `project_members`
3. Permission checks use `get_user_project_permissions()` RPC
4. RPC reads from `project_members` → `role_permissions` or `project_member_permissions`

### 5. Verification Checklist

✅ Users added in manage-projects appear in `/participants`
✅ Added users can see the project (RLS passes)
✅ Users appear in assignment dropdowns across all pages
✅ Permission system works (roles, custom permissions)
✅ Type information preserved (employee, owner, subcontractor)
✅ No TypeScript errors
✅ SearchableSelect works with new data structure

## Technical Details

### State Variables (Before → After)
```typescript
// BEFORE
const [employees, setEmployees] = useState<any[]>([]);
const [owners, setOwners] = useState<any[]>([]);
const [subcontractors, setSubcontractors] = useState<any[]>([]);
const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
const [selectedSubcontractors, setSelectedSubcontractors] = useState<string[]>([]);

// AFTER
const [allAccessors, setAllAccessors] = useState<any[]>([]);
const [currentMembers, setCurrentMembers] = useState<any[]>([]);
const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
```

### SearchableSelect Props
```typescript
<SearchableSelect
  label="Projektmitglieder"
  placeholder="Personen zum Projekt hinzufügen..."
  options={allAccessors.map(a => ({
    label: `${a.accessor_first_name} ${a.accessor_last_name}` || a.accessor_email,
    value: a.id,
    subtitle: `${typeLabel}${a.accessor_company ? ' · ' + a.accessor_company : ''}`
  }))}
  values={selectedMemberIds}
  onChange={setSelectedMemberIds}
  multi
/>
```

## Impact

### Fixed
- ✅ Access rights properly synchronized
- ✅ People added in manage-projects now appear everywhere
- ✅ RLS policies work correctly
- ✅ Permission system functional
- ✅ Unified UX (single dropdown instead of three)
- ✅ Better visual feedback (type badges, current members list)

### Maintained
- ✅ Backward compatibility (CRM tables still exist for other features)
- ✅ All existing permissions and roles
- ✅ SearchableSelect multi-select behavior
- ✅ Portal-based dropdown (z-index 999999)

## Files Modified
- `apps/web/src/pages/superuser/ProjectManagementDetail.tsx`

## Related Files (Not Modified)
- `apps/web/src/pages/ProjectParticipants.tsx` (already using correct tables)
- `packages/api/src/permissions.ts` (already using correct tables)
- `apps/web/src/lib/usePermissions.tsx` (already using correct tables)
- Database schema migrations (already had correct tables)

## Migration Notes
No database migration needed - the correct tables (`user_accessors`, `project_members`) already existed. This was purely a code-level fix to use the correct tables in the UI.

Existing `project_crm_links` and `project_subcontractors` data is NOT automatically migrated. If needed, a separate migration script could be created to copy existing CRM links to `project_members`.
