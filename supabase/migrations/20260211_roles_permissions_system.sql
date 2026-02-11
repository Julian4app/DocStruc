-- =====================================================
-- COMPREHENSIVE ROLES & PERMISSIONS SYSTEM
-- Created: 2026-02-11
-- Purpose: Implement secure role-based access control
-- =====================================================

-- =====================================================
-- 1. PERMISSION MODULES (Available pages/features)
-- =====================================================
CREATE TABLE IF NOT EXISTS permission_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT UNIQUE NOT NULL,
  module_name TEXT NOT NULL,
  module_description TEXT,
  route_path TEXT,
  icon_name TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert all available modules
INSERT INTO permission_modules (module_key, module_name, module_description, route_path, icon_name, display_order) VALUES
  ('manage_projects', 'Projekte anlegen', 'Neue Projekte erstellen und verwalten', '/manage-projects', 'FolderPlus', 1),
  ('accessors', 'Zugreifer verwalten', 'Benutzer und Rollen verwalten', '/accessors', 'UserCog', 2),
  ('tasks', 'Aufgaben', 'Aufgaben ansehen und bearbeiten', '/tasks', 'CheckSquare', 3),
  ('defects', 'Mängel', 'Mängel dokumentieren und verfolgen', '/defects', 'AlertCircle', 4),
  ('schedule', 'Termine & Ablauf', 'Zeitpläne und Meilensteine', '/schedule', 'Calendar', 5),
  ('time_tracking', 'Zeiten & Dauer', 'Zeiterfassung und Tracking', '/time-tracking', 'Clock', 6),
  ('documentation', 'Dokumentation', 'Projektdokumentation', '/documentation', 'FileText', 7),
  ('files', 'Dokumente', 'Dateiverwaltung', '/files', 'FolderOpen', 8),
  ('diary', 'Bautagebuch', 'Tägliche Baustellendokumentation', '/diary', 'BookOpen', 9),
  ('communication', 'Kommunikation', 'Nachrichten und Notizen', '/communication', 'MessageSquare', 10),
  ('participants', 'Beteiligte', 'Projektteilnehmer verwalten', '/participants', 'Users', 11),
  ('reports', 'Berichte & Exporte', 'Berichte generieren und exportieren', '/reports', 'BarChart3', 12),
  ('activity', 'Aktivitäten', 'Aktivitätsverlauf', '/activity', 'Activity', 13),
  ('settings', 'Einstellungen', 'Projekteinstellungen', '/settings', 'Settings', 14)
ON CONFLICT (module_key) DO NOTHING;

-- =====================================================
-- 2. ROLES DEFINITION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  role_description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_role_per_user UNIQUE(user_id, role_name)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active) WHERE is_active = true;

-- =====================================================
-- 3. ROLE PERMISSIONS (What each role can access)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES permission_modules(module_key) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_role_module UNIQUE(role_id, module_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module_key ON role_permissions(module_key);

-- =====================================================
-- 4. USER ACCESSORS (Users that can be added to projects)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_accessors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessor_email TEXT NOT NULL,
  accessor_first_name TEXT,
  accessor_last_name TEXT,
  accessor_phone TEXT,
  accessor_company TEXT,
  accessor_type TEXT NOT NULL CHECK (accessor_type IN ('employee', 'owner', 'subcontractor', 'other')),
  notes TEXT,
  invited_at TIMESTAMPTZ DEFAULT now(),
  registered_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_accessor_per_owner UNIQUE(owner_id, accessor_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_accessors_owner_id ON user_accessors(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_accessors_email ON user_accessors(accessor_email);
CREATE INDEX IF NOT EXISTS idx_user_accessors_registered_user ON user_accessors(registered_user_id);
CREATE INDEX IF NOT EXISTS idx_user_accessors_active ON user_accessors(is_active) WHERE is_active = true;

-- =====================================================
-- 5. PROJECT MEMBERS WITH PERMISSIONS
-- =====================================================
-- Drop old project_members table constraints if exists
ALTER TABLE IF EXISTS project_members DROP CONSTRAINT IF EXISTS project_members_role_check;

-- Modify existing project_members or create new structure
DO $$ 
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='project_members' AND column_name='role_id') THEN
    ALTER TABLE project_members ADD COLUMN role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='project_members' AND column_name='custom_permissions') THEN
    ALTER TABLE project_members ADD COLUMN custom_permissions JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='project_members' AND column_name='accessor_id') THEN
    ALTER TABLE project_members ADD COLUMN accessor_id UUID REFERENCES user_accessors(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='project_members' AND column_name='member_type') THEN
    ALTER TABLE project_members ADD COLUMN member_type TEXT CHECK (member_type IN ('employee', 'owner', 'subcontractor', 'other'));
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_members_role_id ON project_members(role_id);
CREATE INDEX IF NOT EXISTS idx_project_members_accessor_id ON project_members(accessor_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_user ON project_members(project_id, user_id);

-- =====================================================
-- 6. PROJECT MEMBER PERMISSIONS (Individual overrides)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_member_id UUID NOT NULL REFERENCES project_members(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES permission_modules(module_key) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_member_module UNIQUE(project_member_id, module_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_member_permissions_member_id ON project_member_permissions(project_member_id);
CREATE INDEX IF NOT EXISTS idx_project_member_permissions_module ON project_member_permissions(module_key);

-- =====================================================
-- 7. AUDIT LOG FOR SECURITY
-- =====================================================
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_permission_audit_user_id ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_project_id ON permission_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_created_at ON permission_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_action ON permission_audit_log(action);

-- =====================================================
-- 8. FUNCTIONS FOR PERMISSION CHECKING
-- =====================================================

-- Function to check if user has specific permission on a project
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_project_id UUID,
  p_module_key TEXT,
  p_permission_type TEXT -- 'view', 'create', 'edit', 'delete'
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_member_id UUID;
  v_role_id UUID;
  v_has_permission BOOLEAN := false;
BEGIN
  -- Check if user is project owner (full access)
  SELECT EXISTS(
    SELECT 1 FROM projects 
    WHERE id = p_project_id AND owner_id = p_user_id
  ) INTO v_is_owner;
  
  IF v_is_owner THEN
    RETURN true;
  END IF;
  
  -- Get member record
  SELECT id, role_id INTO v_member_id, v_role_id
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
  
  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check custom permissions first (override role permissions)
  IF p_permission_type = 'view' THEN
    SELECT can_view INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'create' THEN
    SELECT can_create INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'edit' THEN
    SELECT can_edit INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'delete' THEN
    SELECT can_delete INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  END IF;
  
  -- If custom permission found, return it
  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;
  
  -- Otherwise check role permissions
  IF v_role_id IS NOT NULL THEN
    IF p_permission_type = 'view' THEN
      SELECT can_view INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'create' THEN
      SELECT can_create INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'edit' THEN
      SELECT can_edit INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'delete' THEN
      SELECT can_delete INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    END IF;
  END IF;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all user permissions for a project
CREATE OR REPLACE FUNCTION get_user_project_permissions(
  p_user_id UUID,
  p_project_id UUID
) RETURNS TABLE(
  module_key TEXT,
  module_name TEXT,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  -- Check if user is project owner (full access to all modules)
  IF EXISTS(SELECT 1 FROM projects WHERE id = p_project_id AND owner_id = p_user_id) THEN
    RETURN QUERY
    SELECT 
      pm.module_key,
      pm.module_name,
      true AS can_view,
      true AS can_create,
      true AS can_edit,
      true AS can_delete
    FROM permission_modules pm
    WHERE pm.is_active = true
    ORDER BY pm.display_order;
    RETURN;
  END IF;
  
  -- Get permissions for regular member
  RETURN QUERY
  WITH member_info AS (
    SELECT id, role_id
    FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
    LIMIT 1
  ),
  role_perms AS (
    SELECT 
      rp.module_key,
      rp.can_view,
      rp.can_create,
      rp.can_edit,
      rp.can_delete
    FROM role_permissions rp
    JOIN member_info mi ON rp.role_id = mi.role_id
  ),
  custom_perms AS (
    SELECT 
      pmp.module_key,
      pmp.can_view,
      pmp.can_create,
      pmp.can_edit,
      pmp.can_delete
    FROM project_member_permissions pmp
    JOIN member_info mi ON pmp.project_member_id = mi.id
  )
  SELECT 
    pm.module_key,
    pm.module_name,
    COALESCE(cp.can_view, rp.can_view, false) AS can_view,
    COALESCE(cp.can_create, rp.can_create, false) AS can_create,
    COALESCE(cp.can_edit, rp.can_edit, false) AS can_edit,
    COALESCE(cp.can_delete, rp.can_delete, false) AS can_delete
  FROM permission_modules pm
  LEFT JOIN role_perms rp ON pm.module_key = rp.module_key
  LEFT JOIN custom_perms cp ON pm.module_key = cp.module_key
  WHERE pm.is_active = true
  ORDER BY pm.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE permission_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Permission Modules: Everyone can read (needed for UI)
CREATE POLICY "Anyone can view active permission modules"
  ON permission_modules FOR SELECT
  USING (is_active = true);

-- Roles: Users can only manage their own roles
CREATE POLICY "Users can view their own roles"
  ON roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own roles"
  ON roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own roles"
  ON roles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own roles"
  ON roles FOR DELETE
  USING (user_id = auth.uid());

-- Role Permissions: Users can manage permissions for their own roles
CREATE POLICY "Users can view permissions for their roles"
  ON role_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.user_id = auth.uid()
  ));

CREATE POLICY "Users can create permissions for their roles"
  ON role_permissions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update permissions for their roles"
  ON role_permissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete permissions for their roles"
  ON role_permissions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id AND roles.user_id = auth.uid()
  ));

-- User Accessors: Users can only manage their own accessors
CREATE POLICY "Users can view their own accessors"
  ON user_accessors FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own accessors"
  ON user_accessors FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own accessors"
  ON user_accessors FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their own accessors"
  ON user_accessors FOR DELETE
  USING (owner_id = auth.uid());

-- Project Member Permissions: Only project owner can manage
CREATE POLICY "Project owners can manage member permissions"
  ON project_member_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.id = project_member_permissions.project_member_id 
    AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_members pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.id = project_member_permissions.project_member_id 
    AND p.owner_id = auth.uid()
  ));

-- Project members can view their own permissions
CREATE POLICY "Members can view their own permissions"
  ON project_member_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.id = project_member_permissions.project_member_id 
    AND pm.user_id = auth.uid()
  ));

-- Audit Log: Users can only view their own actions
CREATE POLICY "Users can view their own audit logs"
  ON permission_audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Project owners can view all audit logs for their projects
CREATE POLICY "Project owners can view project audit logs"
  ON permission_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = permission_audit_log.project_id AND owner_id = auth.uid()
  ));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON permission_audit_log FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 10. TRIGGERS FOR AUDIT LOGGING
-- =====================================================

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, new_values)
    VALUES (NEW.user_id, 'CREATE_ROLE', 'role', NEW.id, row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (NEW.user_id, 'UPDATE_ROLE', 'role', NEW.id, row_to_json(OLD), row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, old_values)
    VALUES (OLD.user_id, 'DELETE_ROLE', 'role', OLD.id, row_to_json(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION log_role_changes();

-- Function to log permission changes
CREATE OR REPLACE FUNCTION log_permission_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'role_permissions' THEN
    SELECT user_id INTO v_user_id FROM roles WHERE id = COALESCE(NEW.role_id, OLD.role_id);
  ELSIF TG_TABLE_NAME = 'project_member_permissions' THEN
    SELECT pm.user_id, pm.project_id INTO v_user_id, v_project_id 
    FROM project_members pm 
    WHERE pm.id = COALESCE(NEW.project_member_id, OLD.project_member_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, project_id, new_values)
    VALUES (v_user_id, 'GRANT_PERMISSION', TG_TABLE_NAME, NEW.id, v_project_id, row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, project_id, old_values, new_values)
    VALUES (v_user_id, 'UPDATE_PERMISSION', TG_TABLE_NAME, NEW.id, v_project_id, row_to_json(OLD), row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO permission_audit_log (user_id, action, resource_type, resource_id, project_id, old_values)
    VALUES (v_user_id, 'REVOKE_PERMISSION', TG_TABLE_NAME, OLD.id, v_project_id, row_to_json(OLD));
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_role_permission_changes
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();

CREATE TRIGGER audit_project_member_permission_changes
  AFTER INSERT OR UPDATE OR DELETE ON project_member_permissions
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();

-- =====================================================
-- 11. UPDATE TIMESTAMPS TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_permission_modules_updated_at BEFORE UPDATE ON permission_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_accessors_updated_at BEFORE UPDATE ON user_accessors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_member_permissions_updated_at BEFORE UPDATE ON project_member_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. GRANT PERMISSIONS TO AUTHENTICATED USERS
-- =====================================================

GRANT SELECT ON permission_modules TO authenticated;
GRANT ALL ON roles TO authenticated;
GRANT ALL ON role_permissions TO authenticated;
GRANT ALL ON user_accessors TO authenticated;
GRANT ALL ON project_member_permissions TO authenticated;
GRANT SELECT, INSERT ON permission_audit_log TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
