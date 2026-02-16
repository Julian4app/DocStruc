# Project Invitation System

## Overview
Complete invitation system that allows project owners to invite users to projects. Invited users receive notifications both in-app and via email, and can accept invitations through either method.

## How It Works

### 1. Database Schema
**New Tables:**
- `notifications` - Stores all user notifications with types: project_invitation, task_assigned, mention, system
- Uses RLS so users only see their own notifications

**Updated Tables:**
- `project_members.status` - Now supports: 'open', 'invited', 'active', 'inactive'
- `project_members.invitation_token` - UUID for email invitation links
- `project_members.invited_at` - Timestamp when invitation was sent
- `project_members.accepted_at` - Timestamp when invitation was accepted

### 2. Database Functions

**`send_project_invitation(p_project_id, p_user_id, p_role)`**
- Creates or updates project_member with status='invited'
- Generates unique invitation_token
- Creates in-app notification for the user
- Returns invitation details

**`accept_project_invitation(p_invitation_token)`**
- Validates invitation token
- Changes member status from 'invited' to 'active'
- Links user_id to the member record
- Deletes invitation notification
- Creates success notification
- Returns project details

**`create_notification(p_user_id, p_type, p_title, p_message, p_data)`**
- Creates a new notification
- Returns notification ID

**`mark_notification_read(p_notification_id)`**
- Marks single notification as read

**`mark_all_notifications_read()`**
- Marks all user notifications as read

### 3. Frontend Components

**NotificationCenter** (`packages/ui/src/NotificationCenter.tsx`)
- Real-time notification display with Supabase subscriptions
- Shows unread count badge
- Different actions per notification type
- For project invitations: Accept/Decline buttons
- For other types: Click to navigate
- Mark as read/delete functionality

**AcceptInvitation** (`apps/web/src/pages/AcceptInvitation.tsx`)
- Public page accessible via `/accept-invitation?token=<uuid>`
- Redirects to login if user not authenticated
- Calls accept_project_invitation RPC
- Shows success/error states
- Auto-redirects to project after success

### 4. Integration Points

**WebLayout**
- Bell icon in header shows unread notification count
- Click opens NotificationCenter modal
- Real-time updates via Supabase subscriptions

**ProjectManagementDetail (Settings)**
- When adding members with registered_user_id:
  - Calls `send_project_invitation` RPC
  - Creates member with status='invited'
  - Sends notification automatically
- When adding members without registered_user_id:
  - Creates member with status='open' (for future registration)

### 5. User Flow

**Scenario A: User invited to project**
1. Project owner adds user in Settings → Beteiligte Personen
2. User receives in-app notification (bell icon shows badge)
3. User clicks notification → sees invitation with Accept/Decline buttons
4. User clicks Accept → status changes to 'active', project appears in dashboard
5. User can now access all project content

**Scenario B: User invited via email**
1. Project owner adds user (email sent separately)
2. User clicks link in email → `/accept-invitation?token=<uuid>`
3. If not logged in → redirected to login with return URL
4. After login → invitation automatically accepted
5. Project appears in dashboard

**Scenario C: User accepts via both methods**
- Token is only valid once
- After accepting via app, email link shows "already accepted"
- After accepting via email, notification is removed from app

### 6. Migration Steps

**To apply this system:**

1. Run migration in Supabase SQL Editor:
```sql
-- Copy and paste entire content of:
supabase/migrations/20260216_project_invitations_system.sql
```

2. The migration creates:
   - notifications table with RLS policies
   - All invitation-related functions
   - Indexes for performance
   - GRANT permissions for authenticated users

3. Restart your development server to load new components

### 7. Testing

**Test invitation flow:**
1. Create two users (User A = owner, User B = invitee)
2. Login as User A → Create project
3. Go to Settings → Beteiligte Personen
4. Add User B to the project
5. Login as User B → Click bell icon
6. See invitation notification → Click Accept
7. Verify project appears in User B's dashboard
8. Verify User B can access project content

**Test email link flow:**
1. Get invitation token from project_members table:
   ```sql
   SELECT invitation_token FROM project_members WHERE user_id = '<user_b_id>' AND status = 'invited';
   ```
2. Open: `http://localhost:5173/accept-invitation?token=<token>`
3. Verify redirect to project after acceptance

### 8. RLS Security

**Projects visibility:**
- Users see projects where: `owner_id = auth.uid()` OR member with `status IN ('open', 'invited', 'active')`
- 'invited' users can see project but with limited initial access
- 'active' users have full access based on permissions

**Content visibility:**
- All project-related tables use `has_project_access(project_id)` function
- Function checks: owner OR active member
- Invited members see project overview but may have restricted content access until active

### 9. Email Integration (Optional Next Step)

To send actual email invitations:
1. Set up Supabase Auth email templates
2. Create Edge Function to send emails
3. Modify send_project_invitation to trigger email
4. Email should contain link: `https://your-domain.com/accept-invitation?token=<invitation_token>`

Example email template:
```
You've been invited to join the project "{project_name}"!

Click here to accept: https://your-domain.com/accept-invitation?token={invitation_token}

Or login to your account and check your notifications.
```

## Troubleshooting

**User doesn't see projects after accepting:**
- Check project_members.status is 'active'
- Verify user_id matches auth.uid()
- Check RLS policies with: `SELECT has_project_access('<project_id>')`

**Notification not appearing:**
- Check notifications table: `SELECT * FROM notifications WHERE user_id = auth.uid()`
- Verify WebLayout is subscribed to real-time changes
- Check browser console for errors

**Invitation link not working:**
- Verify token exists and status is 'invited'
- Check user is logged in (redirects to /login if not)
- Look for errors in accept_project_invitation function

## Database Queries for Debugging

```sql
-- Check user's project memberships
SELECT pm.*, p.name as project_name 
FROM project_members pm 
JOIN projects p ON p.id = pm.project_id 
WHERE pm.user_id = auth.uid();

-- Check user's notifications
SELECT * FROM notifications 
WHERE user_id = auth.uid() 
ORDER BY created_at DESC;

-- Check pending invitations for a user
SELECT pm.*, p.name as project_name 
FROM project_members pm 
JOIN projects p ON p.id = pm.project_id 
WHERE pm.user_id = auth.uid() AND pm.status = 'invited';

-- Manually accept invitation (for testing)
SELECT accept_project_invitation('<invitation_token>');

-- Check if user has project access
SELECT has_project_access('<project_id>');
```
