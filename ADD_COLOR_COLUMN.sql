-- Add color column to tags table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'color') THEN 
        ALTER TABLE tags ADD COLUMN color text DEFAULT '#6B7280'; 
    END IF; 
END $$;
