# 🚀 DocStruc Setup & Testing Checklist

## ⚠️ CRITICAL: Run This First!

Before testing the application, you **MUST** run the database migration in Supabase.

### Step 1: Run Database Migration

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Copy and paste the entire contents of `ADD_COUNTRY_FIELDS.sql`
3. Click **Run** to execute the migration
4. Verify no errors appear

This migration will:
- ✅ Create or update `crm_contacts` table with all required columns
- ✅ Create or update `subcontractors` table with address and website fields
- ✅ Create or update `subcontractor_contacts` table
- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Create access policies for authenticated users
- ✅ Add indexes for better performance

---

## 📋 Testing Checklist

### ✅ Test 1: Add New Employee

**Steps:**
1. Navigate to Accessors page
2. Click on **Employees** tab
3. Click **+ Add New** button
4. Fill in the form:
   - First Name: "Max"
   - Last Name: "Mustermann"
   - Email: "max@example.com"
   - Phone: "+49 123 456789"
   - Personal Number: "EMP001"
   - Department: "Construction"
5. Click **Save**

**Expected Result:**
- ✅ No errors appear
- ✅ Employee is added to the list
- ✅ Employee details are displayed correctly
- ✅ `company_name` field should NOT cause errors (it's null for employees)

---

### ✅ Test 2: Add New Owner

**Steps:**
1. Navigate to Accessors page
2. Click on **Owners** tab
3. Click **+ Add New** button
4. Fill in the form:
   - First Name: "Anna"
   - Last Name: "Schmidt"
   - Email: "anna@example.com"
   - Phone: "+49 987 654321"
   - Company Name: "Schmidt Bauunternehmen GmbH"
   - Street: "Hauptstraße 123"
   - ZIP: "10115"
   - City: "Berlin"
   - Country: Select "Germany" (🇩🇪)
   - Notes: "Important client"
5. Click **Save**

**Expected Result:**
- ✅ No errors appear
- ✅ Owner is added to the list
- ✅ Address fields are saved separately (street, zip, city, country)
- ✅ Country dropdown is visible and works properly
- ✅ Country dropdown appears ABOVE the Save/Cancel buttons

---

### ✅ Test 3: Add New Subcontractor

**Steps:**
1. Navigate to Accessors page
2. Click on **Subcontractors** tab
3. Click **+ Add New** button
4. Fill in the form:
   - Name: "Elektro Fischer GmbH"
   - Trade: "Electrician"
   - Street: "Industriestraße 45"
   - ZIP: "80335"
   - City: "München"
   - Country: Select "Germany" (🇩🇪)
   - Website: "https://elektro-fischer.de"
5. Click **+ Add Contact**
6. Fill in contact:
   - First Name: "Thomas"
   - Last Name: "Fischer"
   - Email: "t.fischer@elektro-fischer.de"
7. Click **Save**

**Expected Result:**
- ✅ No errors appear
- ✅ Subcontractor is added to the list
- ✅ Website field is saved correctly
- ✅ Contact person is saved and linked to subcontractor
- ✅ Country dropdown works properly
- ✅ Address fields are split correctly

---

### ✅ Test 4: Delete Contact Person

**Steps:**
1. Edit an existing subcontractor with contacts
2. Or create a new subcontractor and add 2-3 contacts
3. Click the **red trash icon** 🗑️ next to a contact
4. Click **Save**

**Expected Result:**
- ✅ Contact is removed from the list immediately
- ✅ Remaining contacts stay intact
- ✅ After saving, deleted contact is gone from database

---

### ✅ Test 5: Country Dropdown Z-Index

**Steps:**
1. Open any form (Owner or Subcontractor)
2. Scroll down so the Country field is near the bottom
3. Click on the Country dropdown
4. The dropdown should open upward

**Expected Result:**
- ✅ Dropdown appears ABOVE the Save/Cancel buttons
- ✅ Dropdown is NOT transparent
- ✅ All countries are clearly visible
- ✅ You can click on any country to select it
- ✅ Search field works in the dropdown

---

### ✅ Test 6: Edit Existing Records

**Steps:**
1. Click on any existing Employee/Owner/Subcontractor card
2. Click the **Edit** icon (pencil) in the detail view
3. Modify some fields
4. Click **Save**

**Expected Result:**
- ✅ No errors appear
- ✅ Changes are saved correctly
- ✅ Updated data appears in the list and detail view

---

### ✅ Test 7: View Details

**Steps:**
1. Click on any Employee/Owner/Subcontractor card
2. Review the detail popup

**Expected Result:**
- ✅ All fields display correctly
- ✅ Address shows as: "Street, ZIP City, Country"
- ✅ Website shows for subcontractors
- ✅ Contact persons are listed for subcontractors
- ✅ Avatar/logo images display if uploaded

---

## 🔍 Common Issues & Solutions

### Issue: "Could not find the 'X' column"

**Solution:** You haven't run the SQL migration yet. Go to Step 1 above.

---

### Issue: Country dropdown is transparent

**Solution:** This has been fixed in the code. Make sure you're running the latest version with `z-index: 99999` in CountrySelect.tsx.

---

### Issue: Can't delete contacts

**Solution:** Make sure the trash icon button is visible. It should appear as a red button next to the name inputs.

---

### Issue: Website field not showing

**Solution:** Make sure you ran the complete SQL migration that includes the `website` column for `subcontractors` table.

---

## 📁 Files Changed

### Frontend Code:
- `apps/web/src/pages/superuser/Accessors.tsx` - Main CRM page
- `apps/web/src/components/CountrySelect.tsx` - Country selector with flags
- `apps/web/src/layouts/WebLayout.tsx` - Header with live user data

### Database Migration:
- `ADD_COUNTRY_FIELDS.sql` - **RUN THIS IN SUPABASE!**

---

## ✨ Features Summary

### Employees
- ✅ Personal Number
- ✅ Department
- ✅ Basic contact info (name, email, phone)
- ✅ Avatar upload

### Owners
- ✅ Company Name
- ✅ Split address (Street, ZIP, City, Country)
- ✅ Country selector with flags
- ✅ Notes field
- ✅ Basic contact info

### Subcontractors
- ✅ Company Name
- ✅ Trade/Gewerke
- ✅ Split address (Street, ZIP, City, Country)
- ✅ Website URL
- ✅ Logo upload
- ✅ Multiple contact persons
- ✅ Add/Remove contacts dynamically

---

## 🎯 Next Steps After Testing

1. ✅ Verify all forms work without errors
2. ✅ Check that all data persists correctly in Supabase
3. ✅ Test on different screen sizes (responsive design)
4. ✅ Upload some test avatars/logos
5. ✅ Test with multiple users (if available)

---

## 📞 Support

If you encounter any issues not covered here, check:
1. Browser console for JavaScript errors
2. Supabase logs for database errors
3. Network tab for failed API requests
