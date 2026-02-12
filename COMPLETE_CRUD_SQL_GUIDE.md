# SQL Migration Guide - Complete CRUD für alle Seiten

## 📋 Übersicht

Diese Migration aktiviert vollständige CRUD-Funktionalität für:
1. ✅ **Termine & Ablauf** (timeline_events)
2. ✅ **Zeiten & Dauer** (time_entries)
3. ✅ **Dokumentation** (documentation_items + documentation_media)
4. ✅ **Bautagebuch** (diary_entries + diary_photos)

---

## 🚀 Migration ausführen

```bash
# Hauptmigration ausführen
psql "$DATABASE_URL" -f supabase/migrations/20260211_complete_pages_crud.sql
```

---

## 📊 Erstellte Tabellen

### 1. **time_entries** (Zeiten & Dauer)
```sql
-- Vollständige Zeiterfassung mit Timer-Unterstützung
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  user_id UUID REFERENCES profiles(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  hourly_rate NUMERIC(10, 2),
  is_running BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Start/Stop Timer
- ✅ Manuelle Zeiterfassung
- ✅ Abrechenbar/Nicht-abrechenbar
- ✅ Stundensatz pro Entry
- ✅ Task-Zuordnung optional

### 2. **documentation_items** (Dokumentation)
```sql
CREATE TABLE documentation_items (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  category TEXT, -- general, progress, issue, solution, meeting, inspection, other
  has_photos BOOLEAN,
  has_videos BOOLEAN,
  has_documents BOOLEAN,
  created_by UUID REFERENCES profiles(id),
  tags TEXT[],
  is_archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Kategorisierung
- ✅ Rich-Text Content
- ✅ Media-Flags
- ✅ Tags
- ✅ Archivierung

### 3. **documentation_media** (Dokument-Anhänge)
```sql
CREATE TABLE documentation_media (
  id UUID PRIMARY KEY,
  documentation_item_id UUID REFERENCES documentation_items(id),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  media_type TEXT, -- photo, video, document, audio
  caption TEXT,
  thumbnail_path TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ
);
```

### 4. **diary_entries** (Bautagebuch)
```sql
CREATE TABLE diary_entries (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  entry_date DATE NOT NULL UNIQUE(project_id, entry_date),
  
  -- Wetter
  weather TEXT, -- sunny, cloudy, rainy, snowy, stormy, foggy
  temperature INTEGER,
  
  -- Personal
  workers_present INTEGER,
  workers_list TEXT,
  contractors TEXT,
  
  -- Arbeiten
  work_performed TEXT NOT NULL,
  progress_notes TEXT,
  
  -- Ereignisse
  special_events TEXT,
  visitors TEXT,
  inspections TEXT,
  
  -- Material & Equipment
  deliveries TEXT,
  materials_used TEXT,
  equipment_used TEXT,
  
  -- Probleme & Sicherheit
  incidents TEXT,
  safety_notes TEXT,
  delays TEXT,
  delay_reasons TEXT,
  
  -- Arbeitszeiten
  working_hours_start TIME,
  working_hours_end TIME,
  
  created_by UUID REFERENCES profiles(id),
  photos_attached BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Ein Eintrag pro Tag
- ✅ Wetter & Temperatur
- ✅ Anwesenheitsliste
- ✅ Arbeitsfortschritt
- ✅ Lieferungen & Material
- ✅ Vorfälle & Verzögerungen
- ✅ Foto-Anhänge

### 5. **diary_photos** (Bautagebuch-Fotos)
```sql
CREATE TABLE diary_photos (
  id UUID PRIMARY KEY,
  diary_entry_id UUID REFERENCES diary_entries(id),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  caption TEXT,
  location TEXT, -- Wo auf der Baustelle
  timestamp TIMESTAMPTZ,
  display_order INTEGER,
  created_at TIMESTAMPTZ
);
```

---

## 🗄️ Storage Buckets

```sql
-- Dokumentations-Medien
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentation-media', 'documentation-media', false);

-- Bautagebuch-Fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('diary-photos', 'diary-photos', false);
```

---

## 🔐 RLS Policies (Beispiele)

### Time Entries
```sql
-- Eigene Zeiteinträge anzeigen
CREATE POLICY "Users can view their own time entries"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid());

-- Projektbesitzer sehen alle
CREATE POLICY "Project owners can view all time entries"
  ON time_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
  ));

-- Mit Permission
CREATE POLICY "Members can view with permission"
  ON time_entries FOR SELECT
  USING (check_user_permission(auth.uid(), time_entries.project_id, 'time_tracking', 'view'));
```

### Documentation
```sql
-- Sehen mit Permission
CREATE POLICY "Members can view documentation"
  ON documentation_items FOR SELECT
  USING (check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'view'));

-- Erstellen mit Permission
CREATE POLICY "Members can create documentation"
  ON documentation_items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'create')
  );

-- Löschen: Nur Owner oder Creator
CREATE POLICY "Delete documentation"
  ON documentation_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid())
    OR created_by = auth.uid()
  );
```

---

## 📈 Helper Functions

### 1. Zeit-Statistiken
```sql
SELECT get_time_statistics('<PROJECT_ID>');

-- Returns:
{
  "total_hours": 125.5,
  "this_week": 40.0,
  "this_month": 85.0,
  "billable_hours": 100.0,
  "total_cost": 5000.00,
  "unique_users": 5
}
```

### 2. Dokumentations-Statistiken
```sql
SELECT get_documentation_statistics('<PROJECT_ID>');

-- Returns:
{
  "total_items": 45,
  "with_photos": 32,
  "with_videos": 12,
  "with_documents": 8,
  "by_category": {
    "progress": 15,
    "issue": 10,
    "meeting": 8,
    "general": 12
  }
}
```

### 3. Bautagebuch-Eintrag holen/erstellen
```sql
SELECT get_or_create_diary_entry('<PROJECT_ID>', '2026-02-11');
-- Returns: UUID des Eintrags (existierend oder neu erstellt)
```

---

## 🔍 Nützliche Queries

### Zeit-Einträge für ein Projekt
```sql
SELECT 
  te.*,
  p.email as user_email,
  t.title as task_title
FROM time_entries te
LEFT JOIN profiles p ON te.user_id = p.id
LEFT JOIN tasks t ON te.task_id = t.id
WHERE te.project_id = '<PROJECT_ID>'
ORDER BY te.date DESC, te.created_at DESC;
```

### Dokumentation mit Media-Count
```sql
SELECT 
  di.*,
  COUNT(dm.id) as media_count,
  STRING_AGG(DISTINCT dm.media_type, ', ') as media_types
FROM documentation_items di
LEFT JOIN documentation_media dm ON di.id = dm.documentation_item_id
WHERE di.project_id = '<PROJECT_ID>'
  AND NOT di.is_archived
GROUP BY di.id
ORDER BY di.created_at DESC;
```

### Bautagebuch der letzten 7 Tage
```sql
SELECT 
  de.*,
  COUNT(dp.id) as photo_count,
  p.email as created_by_email
FROM diary_entries de
LEFT JOIN diary_photos dp ON de.id = dp.diary_entry_id
LEFT JOIN profiles p ON de.created_by = p.id
WHERE de.project_id = '<PROJECT_ID>'
  AND de.entry_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY de.id, p.email
ORDER BY de.entry_date DESC;
```

### Laufende Timer
```sql
SELECT 
  te.*,
  t.title as task_title,
  p.email as user_email,
  EXTRACT(EPOCH FROM (NOW() - te.start_time)) / 60 as minutes_running
FROM time_entries te
LEFT JOIN tasks t ON te.task_id = t.id
LEFT JOIN profiles p ON te.user_id = p.id
WHERE te.project_id = '<PROJECT_ID>'
  AND te.is_running = true
ORDER BY te.start_time;
```

---

## ✅ Überprüfungen nach Migration

```sql
-- 1. Tabellen existieren?
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'time_entries',
  'documentation_items',
  'documentation_media',
  'diary_entries',
  'diary_photos'
);

-- 2. Indexes vorhanden?
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('time_entries', 'documentation_items', 'diary_entries');

-- 3. RLS aktiviert?
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('time_entries', 'documentation_items', 'diary_entries');

-- 4. Storage Buckets?
SELECT id, name, public FROM storage.buckets 
WHERE id IN ('documentation-media', 'diary-photos');

-- 5. Functions?
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_time_statistics',
    'get_documentation_statistics',
    'get_or_create_diary_entry'
  );
```

---

## 🧪 Testdaten einfügen

### Time Entry
```sql
INSERT INTO time_entries (
  project_id,
  user_id,
  duration_minutes,
  date,
  description,
  is_billable,
  hourly_rate
) VALUES (
  '<PROJECT_ID>',
  '<USER_ID>',
  120, -- 2 Stunden
  CURRENT_DATE,
  'Mauerarbeiten Erdgeschoss',
  true,
  50.00
);
```

### Documentation Item
```sql
INSERT INTO documentation_items (
  project_id,
  title,
  description,
  content,
  category,
  created_by,
  tags
) VALUES (
  '<PROJECT_ID>',
  'Fortschrittsdokumentation KW 06',
  'Wöchentlicher Baufortschritt',
  'Rohbau im Erdgeschoss zu 80% fertiggestellt...',
  'progress',
  '<USER_ID>',
  ARRAY['rohbau', 'erdgeschoss', 'woche-06']
);
```

### Diary Entry
```sql
INSERT INTO diary_entries (
  project_id,
  entry_date,
  weather,
  temperature,
  workers_present,
  work_performed,
  deliveries,
  created_by
) VALUES (
  '<PROJECT_ID>',
  CURRENT_DATE,
  'sunny',
  8,
  12,
  'Mauerarbeiten fortgesetzt, Fensterrahmen eingebaut',
  'Ziegel (5000 Stk.), Mörtel (20 Säcke)',
  '<USER_ID>'
);
```

---

## 🔄 Frontend-Integration (TypeScript Beispiele)

### Time Entry erstellen
```typescript
const { data, error } = await supabase
  .from('time_entries')
  .insert({
    project_id: projectId,
    user_id: userId,
    duration_minutes: 120,
    date: new Date().toISOString().split('T')[0],
    description: 'Arbeitsbeschreibung',
    is_billable: true,
    hourly_rate: 50.00
  });
```

### Dokumentation mit Filter laden
```typescript
const { data, error } = await supabase
  .from('documentation_items')
  .select('*, documentation_media(count)')
  .eq('project_id', projectId)
  .eq('category', 'progress')
  .not('is_archived', 'eq', true)
  .order('created_at', { ascending: false });
```

### Bautagebuch-Eintrag aktualisieren
```typescript
const { data, error } = await supabase
  .from('diary_entries')
  .update({
    work_performed: 'Aktualisierte Arbeitsbeschreibung',
    workers_present: 15,
    special_events: 'Baustellenbegehung mit Architekt'
  })
  .eq('id', entryId);
```

---

## 🚨 Troubleshooting

### Problem: RLS blockiert Zugriff
**Lösung:** Als Projektowner einloggen oder Permissions überprüfen:
```sql
SELECT * FROM get_user_project_permissions('<USER_ID>', '<PROJECT_ID>');
```

### Problem: Storage Upload schlägt fehl
**Lösung:** Storage Policies überprüfen:
```sql
SELECT * FROM storage.objects WHERE bucket_id = 'documentation-media';
```

### Problem: Function existiert nicht
**Lösung:** Functions neu erstellen (siehe Migration Zeile 450+)

---

## 📝 Nächste Schritte

1. ✅ Migration ausführen
2. ✅ Frontend-Components updaten (siehe separate CRUD-Implementierungen)
3. ✅ Storage Buckets in Supabase Dashboard verifizieren
4. ✅ Permissions testen mit verschiedenen User-Rollen
5. ✅ Media-Upload implementieren

---

**Migration erstellt:** 11. Februar 2026  
**Datei:** `supabase/migrations/20260211_complete_pages_crud.sql`
