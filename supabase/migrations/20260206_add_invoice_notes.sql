DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
        ALTER TABLE "public"."invoices" ADD COLUMN "notes" JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
