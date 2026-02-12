# SQL Guide - Kommunikation, Berichte, Aktivitäten, Einstellungen

## 📋 Übersicht

Diese Migration aktiviert vollständige CRUD-Funktionalität für die letzten 4 Seiten:
1. ✅ **Kommunikation** (Messages & Notes)
2. ✅ **Berichte & Exporte** (Reports & Exports)
3. ✅ **Aktivitäten** (Activity Log)
4. ✅ **Einstellungen** (Project Settings)

---

## 🚀 Migration ausführen

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260211_final_pages_crud.sql
```

---

## 📊 1. KOMMUNIKATION - Erstellte Tabellen

### **project_messages** - Nachrichten & Notizen
```sql
CREATE TABLE project_messages (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message', -- 'message' oder 'note'
  is_pinned BOOLEAN DEFAULT false,
  pinned_by UUID REFERENCES profiles(id),
  pinned_at TIMESTAMPTZ,
  parent_message_id UUID, -- Für Antworten/Threads
  mentions UUID[], -- @-Erwähnungen
  attachments JSONB, -- Dateianhänge
  reactions JSONB, -- Emoji-Reaktionen
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Nachrichten & Notizen unterscheiden
- ✅ Nachricht anheften (Pinning)
- ✅ Antworten/Threads (parent_message_id)
- ✅ @-Erwähnungen (mentions)
- ✅ Dateianhänge (attachments JSONB)
- ✅ Emoji-Reaktionen
- ✅ Bearbeiten & Löschen (Soft-Delete)

### RLS Policies (Kommunikation)
```sql
-- Sehen: Projektmitglieder
CREATE POLICY "Project members can view messages"
  ON project_messages FOR SELECT
  USING (
    is_deleted = false AND
    (EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
    OR check_user_permission(auth.uid(), project_messages.project_id, 'communication', 'view'))
  );

-- Erstellen: Projektmitglieder
CREATE POLICY "Project members can create messages"
  ON project_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND ...);

-- Bearbeiten: Nur eigene Nachrichten
CREATE POLICY "Users can update their own messages"
  ON project_messages FOR UPDATE
  USING (user_id = auth.uid());

-- Löschen: Eigene oder Projektbesitzer
CREATE POLICY "Users can delete their own messages or project owner can delete"
  ON project_messages FOR DELETE
  USING (user_id = auth.uid() OR ...);
```

### Helper Function - Kommunikations-Statistik
```sql
SELECT get_communication_stats('<PROJECT_ID>');

-- Returns:
{
  "total_messages": 145,
  "total_notes": 12,
  "pinned_count": 3,
  "active_users": 8,
  "today_messages": 15,
  "this_week_messages": 67
}
```

---

## 📊 2. BERICHTE & EXPORTE - Erstellte Tabellen

### **report_templates** - Report-Vorlagen
```sql
CREATE TABLE report_templates (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id), -- NULL = System-Template
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'status', 'tasks', 'defects', 'time', 'diary', etc.
  format TEXT DEFAULT 'pdf', -- 'pdf', 'excel', 'csv', 'word'
  icon TEXT, -- Lucide Icon Name
  is_system_template BOOLEAN DEFAULT false,
  config JSONB, -- Template-Konfiguration
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**8 System-Templates vordefiniert:**
1. Projektstatus-Report (PDF)
2. Aufgaben-Report (Excel)
3. Mängel-Report (PDF)
4. Zeitauswertung (Excel)
5. Bautagebuch-Export (PDF)
6. Projekt-Dokumentation (PDF)
7. Teilnehmer-Liste (Excel)
8. Zeitplan & Meilensteine (PDF)

### **generated_reports** - Generierte Reports
```sql
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  template_id UUID REFERENCES report_templates(id),
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT, -- Pfad in Storage Bucket
  parameters JSONB, -- Generierungs-Parameter
  status TEXT DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,
  generated_by UUID REFERENCES profiles(id),
  generated_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ, -- Auto-Delete
  created_at TIMESTAMPTZ
);
```

### **scheduled_reports** - Automatische Reports
```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  template_id UUID REFERENCES report_templates(id),
  schedule_type TEXT, -- 'daily', 'weekly', 'monthly', 'quarterly'
  schedule_config JSONB, -- {day_of_week, time, etc.}
  recipients TEXT[], -- E-Mail-Adressen
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_generation_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ System-Templates (vordefiniert)
- ✅ Custom-Templates (pro Projekt)
- ✅ Report-Historie
- ✅ Status-Tracking (pending → generating → completed)
- ✅ Automatische Versendung (scheduled_reports)
- ✅ Download-Tracking
- ✅ Auto-Cleanup (expires_at)

### Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-reports', 'generated-reports', false);
```

---

## 📊 3. AKTIVITÄTEN - Activity Log

### **activity_logs** - Vollständiges Aktivitätsprotokoll
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'completed', etc.
  entity_type TEXT NOT NULL, -- 'task', 'defect', 'document', 'member', etc.
  entity_id UUID, -- ID des betroffenen Elements
  entity_title TEXT, -- Titel zur Anzeige
  old_values JSONB, -- Alte Werte (bei Updates)
  new_values JSONB, -- Neue Werte (bei Updates)
  metadata JSONB, -- Zusätzlicher Context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ
);
```

**Actions:**
- `created` - Neu erstellt
- `updated` - Aktualisiert
- `deleted` - Gelöscht
- `completed` - Abgeschlossen
- `archived` - Archiviert
- `restored` - Wiederhergestellt
- `assigned` - Zugewiesen
- `commented` - Kommentiert

**Entity Types:**
- `task` - Aufgabe
- `defect` - Mangel
- `document` - Dokument
- `member` - Mitglied
- `project` - Projekt
- `message` - Nachricht
- `note` - Notiz
- `diary_entry` - Bautagebuch-Eintrag
- `time_entry` - Zeiteintrag

### Helper Function - Activity Logging
```sql
-- Manuell Activity Log erstellen
SELECT log_activity(
  '<PROJECT_ID>',
  'created',
  'task',
  '<TASK_ID>',
  'Aufgabentitel',
  '{}'::jsonb,
  '{"status": "open"}'::jsonb,
  '{"priority": "high"}'::jsonb
);
```

### Automatische Triggers
```sql
-- Trigger für Tasks (erstellt automatisch Activity Logs)
CREATE TRIGGER tasks_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_activity();

-- Trigger für Project Members
CREATE TRIGGER project_members_activity_log_trigger
  AFTER INSERT OR DELETE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_activity();
```

### Helper Function - Activity Statistik
```sql
SELECT get_activity_stats('<PROJECT_ID>');

-- Returns:
{
  "total_activities": 234,
  "today_activities": 15,
  "this_week_activities": 89,
  "by_action": {
    "created": 120,
    "updated": 85,
    "completed": 29
  },
  "by_entity_type": {
    "task": 150,
    "defect": 40,
    "document": 44
  },
  "most_active_user": "user-uuid-123"
}
```

---

## 📊 4. EINSTELLUNGEN - Project Settings

### Settings-Spalte in projects-Tabelle
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
```

### Settings-Struktur
```json
{
  "notifications": {
    "email_on_task_assigned": true,
    "email_on_task_completed": false,
    "email_on_defect_created": true,
    "email_on_comment": true,
    "email_daily_summary": false,
    "email_weekly_report": false
  },
  "features": {
    "enable_time_tracking": true,
    "enable_diary": true,
    "enable_documentation": true,
    "enable_chat": true
  },
  "defaults": {
    "task_priority": "medium",
    "defect_severity": "medium",
    "working_hours_start": "08:00",
    "working_hours_end": "17:00"
  },
  "integrations": {
    "google_maps_enabled": true,
    "calendar_sync": false
  }
}
```

### Helper Functions - Settings

#### Settings laden (mit Defaults)
```sql
SELECT get_project_settings('<PROJECT_ID>');

-- Returns: Vollständige Settings mit Defaults
```

#### Settings aktualisieren
```sql
SELECT update_project_settings(
  '<PROJECT_ID>',
  '{"notifications": {"email_on_task_assigned": false}}'::jsonb
);

-- Returns: Aktualisierte Settings (merged mit existierenden)
```

---

## 🔍 Nützliche Queries

### 1. Alle Nachrichten eines Projekts (mit User-Info)
```sql
SELECT 
  pm.*,
  p.email as user_email,
  p.first_name,
  p.last_name
FROM project_messages pm
JOIN profiles p ON pm.user_id = p.id
WHERE pm.project_id = '<PROJECT_ID>'
  AND pm.is_deleted = false
ORDER BY pm.created_at DESC;
```

### 2. Angeheftete Nachrichten
```sql
SELECT *
FROM project_messages
WHERE project_id = '<PROJECT_ID>'
  AND is_pinned = true
  AND is_deleted = false
ORDER BY pinned_at DESC;
```

### 3. Notizen vs. Nachrichten
```sql
-- Nur Notizen
SELECT * FROM project_messages
WHERE project_id = '<PROJECT_ID>'
  AND message_type = 'note'
  AND is_deleted = false;

-- Nur Nachrichten
SELECT * FROM project_messages
WHERE project_id = '<PROJECT_ID>'
  AND message_type = 'message'
  AND is_deleted = false;
```

### 4. Generierte Reports eines Projekts
```sql
SELECT 
  gr.*,
  rt.title as template_title,
  p.email as generated_by_email
FROM generated_reports gr
LEFT JOIN report_templates rt ON gr.template_id = rt.id
LEFT JOIN profiles p ON gr.generated_by = p.id
WHERE gr.project_id = '<PROJECT_ID>'
ORDER BY gr.generated_at DESC;
```

### 5. Aktive Scheduled Reports
```sql
SELECT 
  sr.*,
  rt.title as template_title,
  rt.format
FROM scheduled_reports sr
JOIN report_templates rt ON sr.template_id = rt.id
WHERE sr.project_id = '<PROJECT_ID>'
  AND sr.is_active = true
ORDER BY sr.next_generation_at;
```

### 6. Aktivitäten der letzten 7 Tage
```sql
SELECT 
  al.*,
  p.email as user_email,
  p.first_name || ' ' || p.last_name as user_name
FROM activity_logs al
JOIN profiles p ON al.user_id = p.id
WHERE al.project_id = '<PROJECT_ID>'
  AND al.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY al.created_at DESC;
```

### 7. Aktivitäten nach Entity-Type filtern
```sql
-- Nur Task-Aktivitäten
SELECT * FROM activity_logs
WHERE project_id = '<PROJECT_ID>'
  AND entity_type = 'task'
ORDER BY created_at DESC;

-- Nur Mitglieder-Aktivitäten
SELECT * FROM activity_logs
WHERE project_id = '<PROJECT_ID>'
  AND entity_type = 'member'
ORDER BY created_at DESC;
```

### 8. Aktivste User (Leaderboard)
```sql
SELECT 
  user_id,
  p.email,
  p.first_name || ' ' || p.last_name as name,
  COUNT(*) as activity_count,
  COUNT(*) FILTER (WHERE action = 'created') as created_count,
  COUNT(*) FILTER (WHERE action = 'updated') as updated_count,
  COUNT(*) FILTER (WHERE action = 'completed') as completed_count
FROM activity_logs al
JOIN profiles p ON al.user_id = p.id
WHERE al.project_id = '<PROJECT_ID>'
  AND al.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, p.email, p.first_name, p.last_name
ORDER BY activity_count DESC
LIMIT 10;
```

---

## ✅ Überprüfungen nach Migration

```sql
-- 1. Alle Tabellen existieren?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'project_messages',
  'report_templates',
  'generated_reports',
  'scheduled_reports',
  'activity_logs'
);

-- 2. RLS aktiviert?
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('project_messages', 'activity_logs', 'generated_reports');

-- 3. Functions existieren?
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_communication_stats',
    'get_activity_stats',
    'log_activity',
    'get_project_settings',
    'update_project_settings',
    'cleanup_expired_reports',
    'cleanup_old_activity_logs'
  );

-- 4. Triggers existieren?
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'tasks_activity_log_trigger',
  'project_members_activity_log_trigger'
);

-- 5. System Report Templates eingefügt?
SELECT COUNT(*) FROM report_templates WHERE is_system_template = true;
-- Sollte 8 sein

-- 6. Storage Bucket existiert?
SELECT id, name, public FROM storage.buckets WHERE id = 'generated-reports';

-- 7. settings Spalte in projects?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'settings';
```

---

## 🧪 Testdaten einfügen

### Nachricht erstellen
```sql
INSERT INTO project_messages (
  project_id,
  user_id,
  content,
  message_type
) VALUES (
  '<PROJECT_ID>',
  '<USER_ID>',
  'Die Rohbauarbeiten sind abgeschlossen!',
  'message'
);
```

### Notiz erstellen (angeheftet)
```sql
INSERT INTO project_messages (
  project_id,
  user_id,
  content,
  message_type,
  is_pinned,
  pinned_by,
  pinned_at
) VALUES (
  '<PROJECT_ID>',
  '<USER_ID>',
  'WICHTIG: Fundament vor Frost schützen!',
  'note',
  true,
  '<USER_ID>',
  NOW()
);
```

### Report generieren
```sql
INSERT INTO generated_reports (
  project_id,
  template_id,
  title,
  report_type,
  format,
  status,
  generated_by
) VALUES (
  '<PROJECT_ID>',
  (SELECT id FROM report_templates WHERE report_type = 'status' AND is_system_template = true LIMIT 1),
  'Projektstatus KW 06/2026',
  'status',
  'pdf',
  'completed',
  '<USER_ID>'
);
```

### Scheduled Report erstellen
```sql
INSERT INTO scheduled_reports (
  project_id,
  template_id,
  schedule_type,
  schedule_config,
  recipients,
  created_by
) VALUES (
  '<PROJECT_ID>',
  (SELECT id FROM report_templates WHERE report_type = 'status' LIMIT 1),
  'weekly',
  '{"day_of_week": 1, "time": "08:00"}'::jsonb,
  ARRAY['email@example.com'],
  '<USER_ID>'
);
```

### Activity Log manuell erstellen
```sql
SELECT log_activity(
  '<PROJECT_ID>',
  'completed',
  'task',
  '<TASK_ID>',
  'Fundament gießen',
  '{"status": "in_progress"}'::jsonb,
  '{"status": "done"}'::jsonb,
  '{"completion_time": "2026-02-11T14:30:00Z"}'::jsonb
);
```

### Project Settings aktualisieren
```sql
SELECT update_project_settings(
  '<PROJECT_ID>',
  '{"notifications": {"email_on_task_assigned": true, "email_weekly_report": true}}'::jsonb
);
```

---

## 🔄 Frontend-Integration (TypeScript Beispiele)

### Nachricht senden
```typescript
const { data, error } = await supabase
  .from('project_messages')
  .insert({
    project_id: projectId,
    user_id: userId,
    content: messageText,
    message_type: 'message'
  });
```

### Nachricht anheften
```typescript
const { data, error } = await supabase
  .from('project_messages')
  .update({
    is_pinned: true,
    pinned_by: userId,
    pinned_at: new Date().toISOString()
  })
  .eq('id', messageId);
```

### Nachrichten laden (mit User-Info)
```typescript
const { data, error } = await supabase
  .from('project_messages')
  .select(`
    *,
    profiles:user_id(email, first_name, last_name)
  `)
  .eq('project_id', projectId)
  .eq('is_deleted', false)
  .order('created_at', { ascending: false });
```

### Communication Stats laden
```typescript
const { data, error } = await supabase
  .rpc('get_communication_stats', { p_project_id: projectId });

console.log(data); // { total_messages: 145, total_notes: 12, ... }
```

### Report generieren (simuliert)
```typescript
const { data, error } = await supabase
  .from('generated_reports')
  .insert({
    project_id: projectId,
    template_id: templateId,
    title: 'Projektstatus KW 06',
    report_type: 'status',
    format: 'pdf',
    status: 'pending',
    generated_by: userId
  });

// In reality: Trigger backend job to generate PDF
```

### Activity Logs laden
```typescript
const { data, error } = await supabase
  .from('activity_logs')
  .select(`
    *,
    profiles:user_id(email, first_name, last_name)
  `)
  .eq('project_id', projectId)
  .order('created_at', { ascending: false })
  .limit(50);
```

### Project Settings laden
```typescript
const { data, error } = await supabase
  .rpc('get_project_settings', { p_project_id: projectId });

console.log(data); // Full settings with defaults
```

### Project Settings speichern
```typescript
const { data, error } = await supabase
  .rpc('update_project_settings', {
    p_project_id: projectId,
    p_settings: {
      notifications: {
        email_on_task_assigned: true
      }
    }
  });
```

---

## 🧹 Maintenance Functions

### Alte Reports löschen (Cleanup)
```sql
-- Manuelle Ausführung
SELECT cleanup_expired_reports();
-- Returns: Anzahl gelöschter Reports

-- Automatisch via Cron (täglich)
-- Kann in Supabase Dashboard konfiguriert werden
```

### Alte Activity Logs löschen (90+ Tage)
```sql
-- Manuelle Ausführung
SELECT cleanup_old_activity_logs();
-- Returns: Anzahl gelöschter Logs
```

---

## 🚨 Troubleshooting

### Problem: Nachrichten nicht sichtbar
**Lösung:** RLS Policy überprüfen, User muss Projektmitglied sein
```sql
SELECT * FROM project_members WHERE project_id = '<PROJECT_ID>' AND user_id = '<USER_ID>';
```

### Problem: Report Generation schlägt fehl
**Lösung:** Status und Error Message prüfen
```sql
SELECT id, title, status, error_message 
FROM generated_reports 
WHERE status = 'failed' 
ORDER BY generated_at DESC;
```

### Problem: Activity Logs werden nicht erstellt
**Lösung:** Triggers überprüfen
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table IN ('tasks', 'project_members');
```

### Problem: Settings nicht gespeichert
**Lösung:** Function direkt testen
```sql
SELECT update_project_settings(
  '<PROJECT_ID>',
  '{"test": true}'::jsonb
);

-- Dann überprüfen
SELECT settings FROM projects WHERE id = '<PROJECT_ID>';
```

---

## 📝 Nächste Schritte

1. ✅ Migration ausführen
2. ✅ Frontend-Components updaten:
   - ProjectCommunication.tsx (Messages + Notes CRUD)
   - ProjectReports.tsx (Report Generation + History)
   - ProjectActivity.tsx (Activity Timeline from activity_logs)
   - ProjectSettings.tsx (Settings Form mit get/update functions)
3. ✅ Storage Upload implementieren (Attachments für Messages)
4. ✅ Report Generation Backend implementieren (PDF/Excel)
5. ✅ Notification System für Settings integrieren
6. ✅ Activity Log Trigger für weitere Tabellen (diary_entries, time_entries, etc.)

---

**Migration erstellt:** 11. Februar 2026  
**Datei:** `supabase/migrations/20260211_final_pages_crud.sql`  
**Tabellen:** 5 neue + 1 erweiterte  
**Functions:** 6 neue Helper Functions  
**Triggers:** 2 automatische Activity Log Triggers
