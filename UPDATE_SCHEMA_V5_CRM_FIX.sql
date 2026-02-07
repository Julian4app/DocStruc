-- 8. FIX CRM STORAGE + CONTACTS
-- Since we cannot create 'auth.users' from the client, we need a place to store
-- "Mitarbeiter" and "Bauherren" data before they sign up, or if they are just contacts.
-- We will create a `crm_contacts` table that acts as a pool of people.

CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('employee', 'owner')), 
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT, -- Unique? Not necessarily if we have duplicates, but good practice.
    phone TEXT,
    avatar_url TEXT,
    
    -- Specific fields
    personal_number TEXT,    -- For Employees
    detailed_address TEXT,   -- For Owners
    notes TEXT,             -- For Owners
    
    -- Status
    linked_user_id UUID REFERENCES auth.users(id), -- If they eventually sign up
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SUBCONTRACTOR CONTACTS
-- "Gewerke" need multiple contact persons.
CREATE TABLE IF NOT EXISTS public.subcontractor_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT, -- "Abteilung"
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update Subcontractors table if needed (it was created in V4)
ALTER TABLE public.subcontractors 
ADD COLUMN IF NOT EXISTS detailed_address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
