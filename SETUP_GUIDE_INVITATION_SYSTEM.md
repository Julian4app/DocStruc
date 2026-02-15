# Quick Setup Guide - Invitation System

## Database Migrations (MUST DO FIRST)

You need to apply two new migrations to your Supabase database:

### 1. Apply project_roles table migration
```bash
# Option A: Via Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Paste contents of: supabase/migrations/20260215_project_roles_table.sql
3. Run the query

# Option B: Via Supabase CLI
supabase db push
```

### 2. Apply member status migration
```bash
# Option A: Via Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Paste contents of: supabase/migrations/20260215_member_status_and_invitations.sql
3. Run the query

# Option B: Via Supabase CLI
supabase db push
```

## Testing the System

### Step 1: Create Accessors & Roles
1. Go to `/accessors` page
2. **Zugreifer tab**: Create some test accessors (users who can be added to projects)
   - Example: "Max Mustermann", email: "max@example.com", type: "Mitarbeiter"
3. **Rollen tab**: Create some test roles
   - Example: "Bauleiter" with full permissions
   - Example: "Bauherr" with view-only permissions

### Step 2: Create Project & Assign Resources
1. Go to `/manage-projects/new` → Create a new project
2. Edit the project at `/manage-projects/:id`
3. Scroll to **"Projektrollen"** section
   - Select which roles should be available for THIS project (e.g., "Bauleiter", "Bauherr")
   - This is NEW - you're defining which roles can be assigned in this specific project
4. Scroll to **"Beteiligte Personen"** section
   - Select the accessors you want to add to this project
   - They will be added with status "Offen" (open)
5. Click **"Speichern"**

### Step 3: Verify Members Appear
1. Open the project
2. Go to the **"Beteiligte"** tab
3. You should see all the members you added with status **"Offen"** (gray badge)
4. If you don't see them, check the browser console for errors

### Step 4: Assign Roles & Invite
1. On the "Beteiligte" page, for each member:
   - Click the **⋮** (three dots) action menu
   - Select **"Berechtigungen bearbeiten"**
   - Choose a role from the dropdown (only roles you selected in Step 2.3 will appear)
   - Click **"Speichern"**
2. After assigning a role, an **"Einladen"** button appears on the member card
3. Click **"Einladen"** → Status changes to **"Eingeladen"** (orange badge)
4. You'll see a success message (email sending will fail gracefully if edge function not configured)

### Step 5: Test Other Actions
- **"Alle einladen"** button: Invites all open members who have roles
- **Action menu (⋮)**:
  - Edit permissions: Change role or set custom permissions
  - Set inactive: Member can't see project anymore (red badge)
  - Reactivate: Restore access (back to green)
  - Re-invite: Send invitation again
  - Remove: Delete from project permanently
- **Status filters**: Click tabs at top (All/Offen/Eingeladen/Aktiv/Inaktiv)

## Common Issues & Solutions

### Issue: "Keine Rollen für dieses Projekt verfügbar"
**Solution:** Go back to `/manage-projects/:id` and select roles in the "Projektrollen" section

### Issue: Members not appearing in "Beteiligte" tab
**Possible causes:**
1. Migrations not applied → Apply both migrations first
2. Members not saved → Click "Speichern" on manage-projects page
3. Browser cache → Hard refresh (Cmd+Shift+R on Mac)

### Issue: Can't invite members
**Possible causes:**
1. No role assigned → Assign a role first via "Berechtigungen bearbeiten"
2. No roles available for project → Add roles in "Projektrollen" section on manage-projects page

### Issue: Email not sending
**Expected behavior:** The system gracefully handles missing email edge function with a warning message. To enable actual email sending, you need to create a Supabase Edge Function called `send-invitation`.

## Edge Function (Optional - For Email Sending)

If you want actual invitation emails to be sent, create this edge function:

**Location:** `supabase/functions/send-invitation/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const { to, inviterName, projectName, inviteUrl, memberName } = await req.json()

  const res = await fetch('https://api.resend.com/emails', {
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

Deploy with: `supabase functions deploy send-invitation`

## System Flow Summary

```
1. Superuser creates accessors & roles (/accessors)
                    ↓
2. Superuser creates project & selects:
   - Which roles are available for this project (Projektrollen)
   - Which accessors are members (Beteiligte Personen)
                    ↓
3. Members appear in /participants with status "Offen"
                    ↓
4. Superuser assigns roles to members
                    ↓
5. Superuser clicks "Einladen" (or "Alle einladen")
   Status: Offen → Eingeladen
                    ↓
6. User receives email, clicks link, registers/logs in
   Status: Eingeladen → Aktiv
                    ↓
7. User can now access project with assigned permissions
```

## Status Lifecycle

- **Offen** (Open): Added to project but not invited yet
- **Eingeladen** (Invited): Invitation sent, waiting for acceptance
- **Aktiv** (Active): User accepted and can access project
- **Inaktiv** (Inactive): Superuser deactivated, no project access

## Questions?

See `COMPLETE_INVITATION_SYSTEM.md` for full technical documentation.
