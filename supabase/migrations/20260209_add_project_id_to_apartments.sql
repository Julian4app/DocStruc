-- Add project_id column to building_apartments table to support standalone apartments
-- This allows apartments to exist without a floor_id (directly attached to project)

-- First, make floor_id nullable if not already
ALTER TABLE building_apartments ALTER COLUMN floor_id DROP NOT NULL;

-- Add project_id column
ALTER TABLE building_apartments 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Create index for project_id lookups
CREATE INDEX IF NOT EXISTS idx_building_apartments_project ON building_apartments(project_id);

-- Add a check constraint to ensure either floor_id or project_id is set (but not both null)
ALTER TABLE building_apartments 
  ADD CONSTRAINT building_apartments_parent_check 
  CHECK (
    (floor_id IS NOT NULL AND project_id IS NULL) OR 
    (floor_id IS NULL AND project_id IS NOT NULL)
  );
