-- Add detailed address fields to projects table
-- Run this in your Supabase SQL Editor

-- Add detailed address columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';

-- Optional: Add comments for documentation
COMMENT ON COLUMN projects.street IS 'Street address for Google Maps/Navigation';
COMMENT ON COLUMN projects.zip IS 'Postal/ZIP code';
COMMENT ON COLUMN projects.city IS 'City name';
COMMENT ON COLUMN projects.country IS 'Country code (e.g., DE, AT, CH)';

-- Optional: Create index for faster location-based lookups
CREATE INDEX IF NOT EXISTS idx_projects_city ON projects(city);
CREATE INDEX IF NOT EXISTS idx_projects_country ON projects(country);

-- Note: The 'address' column will still contain the full formatted address
-- e.g., "Hauptstraße 123, 10115 Berlin, DE" for navigation systems
