# Invitation & Notification System - Complete Fix (February 16, 2026)

## Overview
Fixed the invitation system so that when a superuser invites a member on the `/project/:id/participants` page, the invited user receives:
1. **In-app notification** (bell icon dropdown)
2. **Email notification** (if edge function configured)
3. **Accept/Decline options** in the notification
4. **Automatic project access** upon acceptance

## Changes Made

### 1. Fixed Invitation Flow - `ProjectParticipants.tsx`
**File:** `apps/web/src/pages/project/ProjectParticipants.tsx`

**Problem:** The `inviteMember` and `reInviteMember` functions were only updating the database status without calling the `send_project_invitation` RPC function, which is responsible for creating in-app notifications.

**Solution:**
- Updated `inviteMember()` to call `send_project_invitation` RPC
- Updated `reInviteMember()` to call `send_project_invitation` RPC
- Both functions now:
  1. Call the RPC which creates the notification AND updates member status
  2. Get the invitation token from the RPC response
  3. Try to send email with the correct invitation URL format
  4. Show appropriate success message

**Key Changes:**
```typescript
// OLD: Only updated status, no notification
await supabase.from('project_members')
  .update({ status: 'invited', invited_at: new Date().toISOString() })
  .eq('id', member.id);

// NEW: Calls RPC that creates notification
const { data: inviteResult, error: inviteError } = await supabase.rpc('send_project_invitation', {
  p_project_id: projectId,
  p_user_id: member.user_id,
  p_role: member.role_id || 'member'
});
```

### 2. Improved Notification UI - Dropdown Design
**File:** `apps/web/src/layouts/WebLayout.tsx`

**Changes:**
- Replaced modal with dropdown design
- Added click-outside handler to close dropdown
- Positioned dropdown below bell icon in header
- Added proper z-index layering

**Dropdown Specs:**
- Width: 380px
- Max height: 500px
- Styled with shadow and border
- Auto-closes when clicking outside

### 3. Enhanced NotificationCenter Component
**File:** `packages/ui/src/NotificationCenter.tsx`

**Improvements:**
- More compact styling for dropdown use
- Smaller font sizes (13px for content, 11-15px for other elements)
- Reduced padding throughout
- Better button styling for accept/decline actions
- Improved event handling (stopPropagation on buttons)

### 4. Database Schema (Already Exists)
**File:** `supabase/migrations/20260216_project_invitations_system.sql`

The migration already includes:
- `notifications` table with RLS policies
- `send_project_invitation()` RPC function
- `accept_project_invitation()` RPC function
- Helper functions for marking notifications as read

## How It Works Now

### Invitation Flow:

1. **Superuser invites member** at `/project/:id/participants`:
   - Clicks "Einladen" button
   - System calls `send_project_invitation` RPC
   - RPC creates/updates `project_members` record with status='invited'
   - RPC creates notification in `notifications` table
   - System tries to send email (if edge function exists)

2. **Invited user receives notifications**:
   - Sees red dot on bell icon (unread notification)
   - Clicks bell icon → Dropdown appears
   - Sees invitation with "Akzeptieren" and "Ablehnen" buttons

3. **User accepts invitation**:
   - Clicks "Akzeptieren" button
   - System calls `accept_project_invitation` RPC
   - RPC updates member status to 'active'
   - RPC deletes invitation notification
   - RPC creates success notification
   - User redirected to project page
   - Project appears in user's dashboard

4. **User declines invitation**:
   - Clicks "Ablehnen" button
   - Notification is deleted
   - Member record remains with status='invited' (can be re-invited)

## Testing the System

### Prerequisites:
1. Apply migration if not already applied:
   ```bash
   cd supabase
   supabase migration up
   ```

2. Have at least two users:
   - User A: Superuser/Project Owner
   - User B: Registered user (has account)

### Test Steps:

1. **Login as User A** (superuser)
   - Create or open a project
   - Go to "Einstellungen" → "Beteiligte Personen"
   - Add User B as a member (must select from registered users)
   - Save the project

2. **Go to Participants page** (`/project/:id/participants`)
   - User B should appear with status "Offen"
   - Click "⋮" menu → "Berechtigungen bearbeiten"
   - Assign a role (e.g., "Viewer" or "Editor")
   - Click "Speichern"

3. **Invite User B**
   - Click "Einladen" button on User B's card
   - Status changes to "Eingeladen" (orange badge)
   - Toast shows success message

4. **Login as User B**
   - Check bell icon → Should show red dot
   - Click bell icon → Dropdown appears
   - See invitation notification
   - Click "Akzeptieren"
   - Should redirect to project page

5. **Verify Access**
   - User B should see the project in dashboard
   - User B can access project modules according to assigned role
   - Back in User A's view, User B status is now "Aktiv" (green badge)

## Email Configuration (Optional)

To enable email invitations, create a Supabase Edge Function:

**File:** `supabase/functions/send-invitation/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const { to, inviterName, projectName, inviteUrl, memberName } = await req.json()

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'your-app@example.com',
      to: [to],
      subject: `Einladung zum Projekt: ${projectName}`,
      html: `
        <h2>Einladung zum Projekt</h2>
        <p>Hallo ${memberName},</p>
        <p>${inviterName} hat Sie zum Projekt <strong>${projectName}</strong> eingeladen.</p>
        <p><a href="${inviteUrl}">Einladung annehmen</a></p>
      `,
    }),
  })

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Deploy:
```bash
supabase functions deploy send-invitation
```

**Note:** The system works perfectly without email. Invited users will still receive in-app notifications.

## Troubleshooting

### Issue: No notification appears
**Cause:** Migration not applied or RPC function failed
**Solution:** 
- Check browser console for errors
- Verify migration is applied: `supabase migration list`
- Check that `member.user_id` exists (member must have registered account)

### Issue: Can't invite member
**Cause:** Member has no registered account
**Solution:**
- Only members with `registered_user_id` can receive invitations
- User must register first, then be added as member

### Issue: Dropdown doesn't close
**Cause:** Click-outside handler not working
**Solution:**
- Refresh the page
- Check browser console for errors

### Issue: Accept button doesn't work
**Cause:** RPC function error or invalid token
**Solution:**
- Check browser console
- Verify `accept_project_invitation` RPC exists in database
- Check notification data has `invitation_token` field

## Technical Details

### RPC Functions Used:

1. **`send_project_invitation(p_project_id, p_user_id, p_role)`**
   - Creates/updates project_member with status='invited'
   - Generates unique invitation_token
   - Creates notification with all invitation details
   - Returns: `{ success, member_id, invitation_token, project_name }`

2. **`accept_project_invitation(p_invitation_token)`**
   - Validates token and user
   - Updates member status to 'active'
   - Deletes invitation notification
   - Creates success notification
   - Returns: `{ success, project_id, project_name }`

3. **`mark_notification_read(p_notification_id)`**
   - Marks single notification as read

4. **`mark_all_notifications_read()`**
   - Marks all user's notifications as read

### Database Tables:

1. **`notifications`**
   - Stores all user notifications
   - RLS enabled (users see only their own)
   - Types: 'project_invitation', 'task_assigned', 'mention', 'system'

2. **`project_members`**
   - Links users to projects
   - Has `invitation_token` UUID for email links
   - Status: 'open', 'invited', 'active', 'inactive'
   - Tracks `invited_at` and `accepted_at` timestamps

## UI Components Modified

1. **WebLayout** - Header with notification bell and dropdown
2. **NotificationCenter** - Compact notification list component
3. **NotificationCenterWrapper** - Handles notification logic and state
4. **ProjectParticipants** - Invitation sending logic

## Files Changed Summary

| File | Purpose | Changes |
|------|---------|---------|
| `apps/web/src/pages/project/ProjectParticipants.tsx` | Invitation logic | Fixed RPC calls for notifications |
| `apps/web/src/layouts/WebLayout.tsx` | Header UI | Added dropdown design with click-outside |
| `packages/ui/src/NotificationCenter.tsx` | Notification display | Compact styling, better UX |
| `supabase/migrations/20260216_project_invitations_system.sql` | Database schema | Already exists (no changes needed) |

## Success Criteria ✓

- [x] Superuser can invite members from participants page
- [x] Invited users receive in-app notifications
- [x] Notification appears in bell icon dropdown
- [x] Users can accept invitations from notification
- [x] Users can decline invitations from notification
- [x] Accepted users get project access
- [x] Email invitations sent (when edge function configured)
- [x] Dropdown closes when clicking outside
- [x] Clean, modern UI design

## Next Steps (Optional Enhancements)

1. **Add notification sound** when new notification arrives
2. **Real-time notification updates** via Supabase Realtime subscriptions (already implemented)
3. **Notification preferences** (email on/off per user)
4. **Notification history page** to see all past notifications
5. **Push notifications** for mobile app integration
