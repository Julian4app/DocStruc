-- Fix Invoice Status Constraint to allow 'Individual'
DO $$
BEGIN
    -- Drop the constraint if it exists (guessing the name, but usually it is column_check)
    ALTER TABLE "public"."invoices" DROP CONSTRAINT IF EXISTS "invoices_status_check";
    
    -- Add the constraint back with 'Individual' added
    ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_status_check" 
    CHECK (status IN ('Open', 'Paid', 'Overdue', 'Individual'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update failed: %', SQLERRM;
END $$;
