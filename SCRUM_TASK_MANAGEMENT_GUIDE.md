# Scrum Task Management - Complete Implementation Guide

## 📋 Übersicht

Vollständige Scrum/Kanban-Lösung für die Aufgaben-Seite mit:
- ✅ **Kanban Board** - Drag & Drop Spalten (Offen, In Bearbeitung, Erledigt, Blockiert)
- ✅ **Listen-Ansicht** - Klassische Tabellenansicht
- ✅ **Kalender-Ansicht** - Fälligkeitsdaten visualisiert
- ✅ **Task Management** - Create, Edit, Delete
- ✅ **Prioritäten** - Low, Medium, High, Critical
- ✅ **Zuweisung** - Assign zu Projektmitgliedern
- ✅ **Story Points** - Für Scrum Planning
- ✅ **Bilder** - Multiple Bilder pro Task
- ✅ **Dokumentation** - Text, Voice, Image, Video mit User/Time-Stamps

---

## 🚀 Migration ausführen

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260211_scrum_task_management.sql
```

---

## 📊 Erstellte Tabellen

### 1. **tasks** (erweitert)
Neue Spalten:
```sql
ALTER TABLE tasks ADD COLUMN story_points INTEGER;
ALTER TABLE tasks ADD COLUMN sprint_id UUID;
ALTER TABLE tasks ADD COLUMN labels TEXT[];
ALTER TABLE tasks ADD COLUMN attachments JSONB;
ALTER TABLE tasks ADD COLUMN checklist JSONB;
ALTER TABLE tasks ADD COLUMN estimated_hours NUMERIC(10, 2);
ALTER TABLE tasks ADD COLUMN actual_hours NUMERIC(10, 2);
ALTER TABLE tasks ADD COLUMN board_position INTEGER;
```

### 2. **task_documentation** - Dokumentation zu Tasks
```sql
CREATE TABLE task_documentation (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES profiles(id),
  
  content TEXT,
  documentation_type TEXT, -- 'text', 'voice', 'image', 'video'
  
  storage_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  duration_seconds INTEGER,
  thumbnail_path TEXT,
  
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Text-Dokumentation
- ✅ Voice-Aufnahmen (mit Dauer)
- ✅ Bilder & Videos
- ✅ User-Tracking (wer hat dokumentiert)
- ✅ Timestamp (wann dokumentiert)

### 3. **task_images** - Bilder zu Tasks
```sql
CREATE TABLE task_images (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  uploaded_by UUID REFERENCES profiles(id),
  
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  
  caption TEXT,
  description TEXT,
  display_order INTEGER,
  
  created_at TIMESTAMPTZ
);
```

### 4. **sprints** - Scrum Sprints
```sql
CREATE TABLE sprints (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'planned', -- 'planned', 'active', 'completed', 'cancelled'
  velocity INTEGER,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🗄️ Storage Buckets

```sql
-- Task Attachments (Bilder)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false);

-- Task Documentation (Voice/Video)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-documentation', 'task-documentation', false);
```

---

## 📈 Helper Functions

### 1. Task mit allen Details laden
```sql
SELECT get_task_details('<TASK_ID>');

-- Returns:
{
  "task": { ... task data ... },
  "images": [
    { "id": "...", "storage_path": "...", "file_name": "..." }
  ],
  "documentation": [
    {
      "id": "...",
      "content": "...",
      "documentation_type": "text",
      "created_at": "...",
      "user": {
        "email": "...",
        "first_name": "...",
        "last_name": "..."
      }
    }
  ],
  "assigned_user": { ... user data ... }
}
```

### 2. Sprint Statistiken
```sql
SELECT get_sprint_stats('<SPRINT_ID>');

-- Returns:
{
  "total_tasks": 25,
  "completed_tasks": 18,
  "in_progress_tasks": 5,
  "open_tasks": 2,
  "blocked_tasks": 0,
  "total_story_points": 55,
  "completed_story_points": 40,
  "completion_percentage": 72.73
}
```

### 3. Projekt Task Statistiken
```sql
SELECT get_project_task_stats('<PROJECT_ID>');

-- Returns:
{
  "total_tasks": 143,
  "by_status": {
    "open": 42,
    "in_progress": 35,
    "done": 58,
    "blocked": 8
  },
  "by_priority": {
    "low": 25,
    "medium": 60,
    "high": 45,
    "critical": 13
  },
  "assigned_count": 120,
  "unassigned_count": 23,
  "with_images": 67,
  "with_documentation": 89
}
```

---

## 🎯 Frontend Features

### **3 Ansichtsmodi:**

#### 1. **Kanban Board**
- 4 Spalten: Offen, In Bearbeitung, Erledigt, Blockiert
- Drag & Drop (für zukünftige Implementierung vorbereitet)
- Priorität als farbiger Dot
- Assignee Avatar
- Fälligkeitsdatum Badge

#### 2. **Listen-Ansicht**
- Tabellarische Übersicht
- Status Icon links
- Priorität & Status Badges rechts
- Sortierbar & filterbar

#### 3. **Kalender-Ansicht**
- Monatsansicht mit Navigation
- Task-Count pro Tag
- Heutiges Datum hervorgehoben
- Auflistung aller Tasks des Monats darunter

### **Task Creation Form:**
- ✅ Titel *
- ✅ Beschreibung
- ✅ Priorität (Low, Medium, High, Critical)
- ✅ Zuweisen an Mitglied
- ✅ Fälligkeitsdatum
- ✅ Story Points

### **Task Detail View:**

**View Mode:**
- Status-Badges
- Bearbeiten & Löschen Buttons
- Beschreibung
- Info-Grid (Zugewiesen, Fällig, Story Points)
- Status-Änderung (4 Buttons für Quick-Change)
- Bilder-Galerie mit Upload-Funktion
- Dokumentations-Liste mit Add-Funktion

**Edit Mode:**
- Inline-Bearbeitung aller Felder
- Speichern & Abbrechen

### **Dokumentation hinzufügen:**
- ✅ Text-Eingabe (Textarea)
- ✅ Voice-Recording (Button mit Recording-Indicator)
- ✅ Video-Upload (File Input)
- ✅ Bild-Upload (über eigene Sektion)

**Jede Dokumentation zeigt:**
- User Avatar & Name
- Datum & Uhrzeit (formatiert)
- Typ-Icon (Text, Voice, Image, Video)
- Inhalt/Dateiname

---

## 🔍 Nützliche Queries

### Tasks eines Projekts laden (mit allen Infos)
```sql
SELECT 
  t.*,
  p.email as assigned_email,
  p.first_name as assigned_first_name,
  p.last_name as assigned_last_name,
  (SELECT COUNT(*) FROM task_images WHERE task_id = t.id) as image_count,
  (SELECT COUNT(*) FROM task_documentation WHERE task_id = t.id) as doc_count
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE t.project_id = '<PROJECT_ID>'
ORDER BY t.board_position, t.created_at DESC;
```

### Dokumentation zu einem Task
```sql
SELECT 
  td.*,
  p.email as user_email,
  p.first_name as user_first_name,
  p.last_name as user_last_name
FROM task_documentation td
JOIN profiles p ON td.user_id = p.id
WHERE td.task_id = '<TASK_ID>'
ORDER BY td.created_at DESC;
```

### Bilder zu einem Task
```sql
SELECT 
  ti.*,
  p.email as uploaded_by_email
FROM task_images ti
JOIN profiles p ON ti.uploaded_by = p.id
WHERE ti.task_id = '<TASK_ID>'
ORDER BY ti.display_order, ti.created_at;
```

### Tasks mit Fälligkeitsdatum im aktuellen Monat
```sql
SELECT t.*, p.email as assigned_email
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE t.project_id = '<PROJECT_ID>'
  AND EXTRACT(MONTH FROM t.due_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM t.due_date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY t.due_date;
```

### Kritische & blockierte Tasks
```sql
SELECT t.*, p.email as assigned_email
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE t.project_id = '<PROJECT_ID>'
  AND (t.priority = 'critical' OR t.status = 'blocked')
ORDER BY 
  CASE t.priority 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  t.created_at DESC;
```

---

## 🧪 Testdaten einfügen

### Task erstellen
```sql
INSERT INTO tasks (
  project_id,
  title,
  description,
  status,
  priority,
  due_date,
  story_points,
  assigned_to,
  creator_id,
  board_position
) VALUES (
  '<PROJECT_ID>',
  'Fundament betonieren',
  'Fundament nach Plan betonieren und 48h aushärten lassen',
  'open',
  'high',
  '2026-02-15',
  8,
  '<USER_ID>',
  '<CREATOR_ID>',
  0
);
```

### Dokumentation hinzufügen
```sql
INSERT INTO task_documentation (
  task_id,
  project_id,
  user_id,
  content,
  documentation_type
) VALUES (
  '<TASK_ID>',
  '<PROJECT_ID>',
  '<USER_ID>',
  'Fundament wurde heute Vormittag fertiggestellt. Alle Maße überprüft und dokumentiert.',
  'text'
);
```

### Bild zu Task hinzufügen
```sql
INSERT INTO task_images (
  task_id,
  project_id,
  uploaded_by,
  storage_path,
  file_name,
  file_size,
  mime_type,
  display_order
) VALUES (
  '<TASK_ID>',
  '<PROJECT_ID>',
  '<USER_ID>',
  '<PROJECT_ID>/<TASK_ID>/image123.jpg',
  'Fundament_Fertigstellung.jpg',
  2456789,
  'image/jpeg',
  0
);
```

---

## 🔄 Frontend-Integration (TypeScript)

### Task erstellen
```typescript
const { data, error } = await supabase
  .from('tasks')
  .insert({
    project_id: projectId,
    title: 'Neue Aufgabe',
    description: 'Beschreibung...',
    status: 'open',
    priority: 'medium',
    assigned_to: userId,
    due_date: '2026-02-20',
    story_points: 5,
    creator_id: currentUserId,
    board_position: taskCount
  });
```

### Task aktualisieren
```typescript
const { data, error } = await supabase
  .from('tasks')
  .update({
    title: 'Aktualisierter Titel',
    status: 'in_progress',
    priority: 'high'
  })
  .eq('id', taskId);
```

### Status ändern (Quick Action)
```typescript
const { data, error } = await supabase
  .from('tasks')
  .update({ 
    status: 'done',
    updated_at: new Date().toISOString()
  })
  .eq('id', taskId);
```

### Task löschen
```typescript
const { data, error } = await supabase
  .from('tasks')
  .delete()
  .eq('id', taskId);
```

### Dokumentation hinzufügen (Text)
```typescript
const { data: userData } = await supabase.auth.getUser();

const { data, error } = await supabase
  .from('task_documentation')
  .insert({
    task_id: taskId,
    project_id: projectId,
    user_id: userData.user?.id,
    content: 'Meine Dokumentation...',
    documentation_type: 'text'
  });
```

### Bild hochladen
```typescript
const file = event.target.files[0];
const fileExt = file.name.split('.').pop();
const fileName = `${Math.random()}.${fileExt}`;
const filePath = `${projectId}/${taskId}/${fileName}`;

// Upload to storage
const { error: uploadError } = await supabase.storage
  .from('task-attachments')
  .upload(filePath, file);

// Save to database
const { error: dbError } = await supabase
  .from('task_images')
  .insert({
    task_id: taskId,
    project_id: projectId,
    uploaded_by: userId,
    storage_path: filePath,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    display_order: imageCount
  });
```

### Task Details laden (mit allem)
```typescript
const { data, error } = await supabase
  .rpc('get_task_details', { p_task_id: taskId });

console.log(data.task); // Task data
console.log(data.images); // Array of images
console.log(data.documentation); // Array of documentation
console.log(data.assigned_user); // Assigned user profile
```

### Tasks mit Assignee laden
```typescript
const { data, error } = await supabase
  .from('tasks')
  .select(`
    *,
    profiles:assigned_to(id, email, first_name, last_name)
  `)
  .eq('project_id', projectId)
  .order('board_position', { ascending: true });
```

---

## ✅ Überprüfungen nach Migration

```sql
-- 1. Tabellen existieren?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('task_documentation', 'task_images', 'sprints');

-- 2. Neue Spalten in tasks?
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('story_points', 'board_position', 'labels');

-- 3. RLS aktiviert?
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('task_documentation', 'task_images');

-- 4. Functions existieren?
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_task_details', 'get_sprint_stats', 'get_project_task_stats');

-- 5. Storage Buckets?
SELECT id, name, public FROM storage.buckets 
WHERE id IN ('task-attachments', 'task-documentation');

-- 6. Triggers?
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'task_documentation_activity_log_trigger';
```

---

## 🎨 UI Components Übersicht

### **Kanban Board:**
- `kanbanContainer` - Horizontal scrollbar
- `kanbanColumn` - Einzelne Spalte (4x)
- `kanbanCard` - Task-Karte
- `kanbanCardHeader` - Title + Priority Dot
- `kanbanCardFooter` - Avatar + Due Date

### **List View:**
- `listContainer` - Scrollable list
- `listCard` - Single row
- `listCardLeft` - Icon + Content
- `listCardRight` - Priority + Status badges

### **Calendar View:**
- `calendarHeader` - Month navigation
- `calendarWeekdays` - So-Sa
- `calendarGrid` - Days of month
- `calendarDay` - Single day cell
- `calendarTaskIndicator` - Task count bubble
- `calendarTasksList` - Tasks below calendar

### **Task Detail Modal:**
- `detailHeader` - Badges + Actions
- `detailSection` - Content sections
- `detailInfoGrid` - Key-value info
- `statusChangeGrid` - 4 status buttons
- `imageGrid` - Image gallery
- `docList` - Documentation entries

---

## 🚨 Troubleshooting

### Problem: Bilder können nicht hochgeladen werden
**Lösung:** Storage Bucket überprüfen
```sql
SELECT * FROM storage.buckets WHERE id = 'task-attachments';
```

### Problem: Dokumentation wird nicht erstellt
**Lösung:** RLS Policies checken
```sql
SELECT * FROM task_documentation WHERE task_id = '<TASK_ID>';
-- Falls leer, Policy überprüfen
```

### Problem: Assignee wird nicht angezeigt
**Lösung:** Profile Daten prüfen
```sql
SELECT t.*, p.* 
FROM tasks t 
LEFT JOIN profiles p ON t.assigned_to = p.id 
WHERE t.id = '<TASK_ID>';
```

### Problem: Kalender zeigt keine Tasks
**Lösung:** due_date Format prüfen
```sql
SELECT id, title, due_date, 
  EXTRACT(MONTH FROM due_date) as month,
  EXTRACT(YEAR FROM due_date) as year
FROM tasks 
WHERE project_id = '<PROJECT_ID>' 
AND due_date IS NOT NULL;
```

---

## 📝 Nächste Schritte

1. ✅ Migration ausführen
2. ✅ Frontend deployed (ProjectTasks.tsx ist komplett)
3. ⚠️ Voice Recording implementieren (Web Audio API)
4. ⚠️ Video Preview implementieren
5. ⚠️ Drag & Drop für Kanban implementieren
6. ⚠️ Sprint Management UI erstellen
7. ⚠️ Notifications für Task-Zuweisungen

---

**Migration erstellt:** 11. Februar 2026  
**Datei:** `supabase/migrations/20260211_scrum_task_management.sql`  
**Frontend:** `apps/web/src/pages/project/ProjectTasks.tsx` (2800+ Zeilen)  
**Neue Tabellen:** 3  
**Storage Buckets:** 2  
**Helper Functions:** 3  
**Triggers:** 1 (Activity Log)
