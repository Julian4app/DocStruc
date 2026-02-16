# Quick Reference: Invitation System Behavior

## 🎯 When Superuser Clicks "Einladen"

### ✅ User HAS Account (Registered)
```
1. System detects: member.accessor.registered_user_id exists
2. RPC creates:
   ✓ In-app notification (bell icon)
   ✓ Updates status to "invited"
   ✓ Generates invitation token
3. Email sent (if configured):
   ✓ Link: /accept-invitation?token=xxx
4. User receives:
   ✓ Bell icon shows red dot
   ✓ Email in inbox (if configured)
5. User clicks "Akzeptieren":
   ✓ Redirected to project
   ✓ Status → "Aktiv"
   ✓ Notification deleted

Success Message:
"Einladung an user@example.com gesendet (E-Mail + Benachrichtigung)"
```

### ✅ User NO Account (Unregistered)
```
1. System detects: no registered_user_id
2. RPC creates:
   ✓ Updates status to "invited"
   ✓ Generates invitation token
   ✗ NO in-app notification (no account yet)
3. Email sent (if configured):
   ✓ Link: /accept-invitation?token=xxx
4. User receives:
   ✓ Email in inbox only
   ✗ No bell notification (not logged in)
5. User clicks email link:
   ✓ Redirected to login/register
   ✓ After registration → Auto project access
   ✓ Status → "Aktiv"

Success Message:
"Einladung per E-Mail an user@example.com gesendet"
```

## 🔧 Email Configuration Status

### With Email Configured (send-invitation edge function)
- ✅ Registered users: Email + Notification
- ✅ Unregistered users: Email only
- ✅ Both can accept invitation

### Without Email (edge function not set up)
- ✅ Registered users: Notification only (still works!)
- ⚠️ Unregistered users: No way to know about invitation
- ⚠️ Message: "Einladung vorbereitet (E-Mail-Versand nicht konfiguriert)"

## 📊 Status Flow

```
Member Added → Status: "Offen" (gray)
       ↓
  Superuser assigns role
       ↓
  Superuser clicks "Einladen"
       ↓
  Status: "Eingeladen" (orange)
       ↓
  User accepts invitation
       ↓
  Status: "Aktiv" (green)
```

## 🚨 Common Scenarios

### Scenario: "User has account but shows as unregistered"
**Problem:** `user_id` field is null, but `accessor.registered_user_id` exists

**Solution:** ✅ Fixed! Code now checks both fields:
```typescript
const registeredUserId = member.user_id || member.accessor?.registered_user_id;
```

### Scenario: "Want to invite someone before they register"
**Solution:** ✅ Supported! Just invite by email:
- System uses `p_email` parameter
- User registers with that email
- Automatically gets project access

### Scenario: "Email not working but need to invite registered user"
**Solution:** ✅ Still works! In-app notification doesn't need email:
- User sees bell icon notification
- Can accept directly in app
- Email is optional for registered users

## 🔑 Key Differences

| Aspect | Registered User | Unregistered User |
|--------|----------------|-------------------|
| **RPC Parameter** | `p_user_id` | `p_email` |
| **In-App Notification** | ✅ Yes | ❌ No |
| **Email Required?** | ❌ Optional | ✅ Required |
| **Accept Method** | Bell icon or email | Email only |
| **Success Message** | "E-Mail + Benachrichtigung" | "E-Mail gesendet" |

## 🎬 Action Items

1. **Apply Migration:**
   ```bash
   cd supabase && supabase migration up
   ```

2. **Test Registered User:**
   - Invite someone who has an account
   - Check they get notification
   - Have them accept

3. **Test Unregistered User:**
   - Invite someone without account
   - Check email is sent
   - Have them register and check access

4. **Optional - Setup Email:**
   - Create `send-invitation` edge function
   - Configure RESEND_API_KEY
   - Test email delivery
