# Pre-Registration Invitation Fix - February 16, 2026

## Problem
When the superuser tried to invite users from the participants page, they received the error:
**"Benutzer hat noch keinen registrierten Account"**

This happened even when:
1. The user already had a registered account
2. The user didn't have an account yet (but should still be invitable)

## Root Causes

### Issue 1: Incorrect Field Check
The code was checking `member.user_id` which might not be populated, instead of checking `member.accessor.registered_user_id` which contains the actual registered user ID.

### Issue 2: No Support for Pre-Registration Invitations
The system didn't support inviting users who don't have accounts yet. This is important because:
- Superuser should be able to invite someone by email
- That person can then register with the invited email
- Upon registration, they automatically get access to the project

## Solution

### 1. Updated Database Function
**File:** `supabase/migrations/20260216_fix_invitation_pre_registration.sql`

Created an updated `send_project_invitation` function that:
- Accepts either `p_user_id` (for registered users) OR `p_email` (for unregistered users)
- Creates in-app notifications ONLY if user has an account
- Updates member status to 'invited' in both cases
- Returns `has_account` flag to indicate if user is registered

**Key changes:**
```sql
CREATE OR REPLACE FUNCTION public.send_project_invitation(
  p_project_id UUID,
  p_user_id UUID DEFAULT NULL,      -- Optional: for registered users
  p_email TEXT DEFAULT NULL,         -- Optional: for unregistered users
  p_role TEXT DEFAULT 'member'
) RETURNS JSONB
```

### 2. Updated Frontend Logic
**File:** `apps/web/src/pages/project/ProjectParticipants.tsx`

#### Changes in `inviteMember()`:
- Checks both `member.user_id` AND `member.accessor.registered_user_id`
- Removed the early return error for unregistered users
- Passes either `p_user_id` or `p_email` to the RPC based on registration status
- Shows different success messages for registered vs unregistered users

```typescript
const registeredUserId = member.user_id || member.accessor?.registered_user_id;
const hasAccount = !!registeredUserId;

await supabase.rpc('send_project_invitation', {
  p_project_id: projectId,
  p_user_id: registeredUserId || null,
  p_email: !registeredUserId ? member.accessor.accessor_email : null,
  p_role: member.role_id || 'member'
});
```

#### Changes in `reInviteMember()`:
- Same logic as `inviteMember()`
- Removed early return error check
- Supports re-inviting both registered and unregistered users

## How It Works Now

### Scenario 1: Inviting Registered User
1. Superuser clicks "Einladen" on participants page
2. System detects user has `registered_user_id`
3. RPC function:
   - Updates member status to 'invited'
   - Creates in-app notification
   - Returns invitation token
4. Email is sent with invitation link
5. User receives:
   - Email notification
   - In-app notification (bell icon)
6. User clicks accept → Gets project access

**Success message:** "Einladung an user@example.com gesendet (E-Mail + Benachrichtigung)"

### Scenario 2: Inviting Unregistered User (Pre-Registration)
1. Superuser clicks "Einladen" on participants page
2. System detects user has NO `registered_user_id`
3. RPC function:
   - Updates member status to 'invited'
   - Does NOT create in-app notification (no account yet)
   - Returns invitation token
4. Email is sent with invitation link
5. User receives:
   - Email notification only
   - Link to accept invitation
6. User clicks link → Redirected to registration page
7. After registration with the invited email:
   - System links user to existing member record
   - User automatically gets project access

**Success message:** "Einladung per E-Mail an user@example.com gesendet"

### Scenario 3: Email Not Configured
If the email edge function is not set up:

**Registered user:**
- In-app notification is created
- Message: "Benachrichtigung an user@example.com gesendet"

**Unregistered user:**
- No notification (user has no account)
- Message: "Einladung für user@example.com vorbereitet (E-Mail-Versand nicht konfiguriert)"
- Note: User won't know about invitation until they register and check their account

## Migration Required

Apply the new migration:

```bash
cd supabase
supabase migration up
```

Or manually run the SQL in:
`supabase/migrations/20260216_fix_invitation_pre_registration.sql`

## Testing

### Test 1: Registered User Invitation
1. Login as superuser
2. Go to project → Participants page
3. Find a member with registered account (has user icon or email matched to system)
4. Assign role → Click "Einladen"
5. ✅ Should work without error
6. ✅ User should receive in-app notification

### Test 2: Unregistered User Invitation
1. Login as superuser
2. Go to project → Settings → Beteiligte Personen
3. Add a new person with email that's NOT in the system
4. Save → Go to Participants page
5. Assign role → Click "Einladen"
6. ✅ Should work without error
7. ✅ Email should be sent (if configured)
8. User registers with that email → ✅ Should automatically have project access

### Test 3: Re-Invitation
1. Click "Erneut" (re-invite) on any member
2. ✅ Should work for both registered and unregistered users
3. ✅ Should show appropriate success message

## Benefits

1. **No More Errors:** Superusers can invite anyone, regardless of registration status
2. **Pre-Registration Invitations:** Invite users before they have accounts
3. **Automatic Linking:** When invited user registers, they're automatically linked to the project
4. **Clear Feedback:** Different messages for registered vs unregistered users
5. **Flexible Workflow:** Supports both "register first" and "invite first" approaches

## Important Notes

### For Unregistered Users:
- **Email is REQUIRED:** If email edge function is not configured, unregistered users won't know about the invitation
- **Registration Email Match:** User must register with the exact email they were invited with
- **Manual Setup Needed:** Set up the `send-invitation` edge function for best experience

### For Registered Users:
- **Works Without Email:** In-app notifications work even if email is not configured
- **Immediate Notification:** User sees invitation immediately in bell icon
- **Can Accept Anytime:** Notification persists until accepted or declined

## Files Modified

1. **`supabase/migrations/20260216_fix_invitation_pre_registration.sql`** - New migration with updated RPC function
2. **`apps/web/src/pages/project/ProjectParticipants.tsx`** - Fixed invitation logic

## Next Steps

1. **Apply the migration** to your database
2. **Test both scenarios** (registered and unregistered users)
3. **Configure email sending** if you want pre-registration invitations to work smoothly
4. **Update AcceptInvitation page** to handle registration flow for new users (if needed)

## Troubleshooting

**Error: "Member not found"**
- Cause: Trying to invite by email, but member doesn't exist in project
- Solution: Add member first through project settings → Beteiligte Personen

**Error: "Either user_id or email must be provided"**
- Cause: Both fields are null
- Solution: Check that accessor has email address set

**Unregistered users not getting invitations**
- Cause: Email edge function not configured
- Solution: Set up `send-invitation` edge function (see INVITATION_NOTIFICATION_FIX.md)
