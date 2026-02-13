-- Building Plan / Objektplan Tables
-- Staircases → Floors → Apartments hierarchy with plan data and attachments

-- Staircases (Treppenhäuser)
CREATE TABLE IF NOT EXISTS building_staircases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Floors (Stockwerke)
CREATE TABLE IF NOT EXISTS building_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staircase_id UUID NOT NULL REFERENCES building_staircases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apartments (Wohnungen) — floor_id is nullable to support standalone apartments
CREATE TABLE IF NOT EXISTS building_apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID REFERENCES building_floors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor_plan_data JSONB,         -- Freeform canvas elements (JSON)
  technical_plan_data JSONB,     -- Technical floor plan elements (JSON)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attachments (uploaded plans: PDF, images, CAD files)
CREATE TABLE IF NOT EXISTS building_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID NOT NULL REFERENCES building_apartments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  size BIGINT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_building_staircases_project ON building_staircases(project_id);
CREATE INDEX IF NOT EXISTS idx_building_floors_staircase ON building_floors(staircase_id);
CREATE INDEX IF NOT EXISTS idx_building_apartments_floor ON building_apartments(floor_id);
CREATE INDEX IF NOT EXISTS idx_building_apartments_project ON building_apartments(project_id);
CREATE INDEX IF NOT EXISTS idx_building_attachments_apartment ON building_attachments(apartment_id);

-- RLS Policies
ALTER TABLE building_staircases ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_attachments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (project access is controlled at the project level)
CREATE POLICY "Users can manage building_staircases" ON building_staircases
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage building_floors" ON building_floors
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage building_apartments" ON building_apartments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage building_attachments" ON building_attachments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
