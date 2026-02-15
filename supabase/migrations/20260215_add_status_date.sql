-- Add status_date column to projects table for status-specific due dates
-- This allows tracking dates like "Pausiert bis DD.MM.YYYY" for paused/on_hold statuses

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status_date DATE;

COMMENT ON COLUMN projects.status_date IS 'Status-specific date (e.g., "paused until", "planned until")';
