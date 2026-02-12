-- =====================================================
-- SQL MIGRATION ANWEISUNGEN
-- Für: Allgemeine Info + verbesserte Projekt-Features
-- =====================================================

/**
 * WICHTIG: Diese Migration muss NACH der Roles & Permissions Migration ausgeführt werden!
 * 
 * Voraussetzung:
 * - 20260211_roles_permissions_system.sql bereits ausgeführt
 * - check_user_permission() Funktion existiert
 * 
 * Ausführen mit:
 * psql "$DATABASE_URL" -f supabase/migrations/20260211_general_info_and_improvements.sql
 */

-- =====================================================
-- ZUSAMMENFASSUNG DER ÄNDERUNGEN
-- =====================================================

/*
1. NEUE TABELLEN:
   - project_info: Allgemeine Projektinformationen (Beschreibung, Koordinaten, etc.)
   - project_info_images: Bildergalerie für Projekte
   - timeline_events: Termine, Meilensteine, Deadlines, Appointments

2. ERWEITERTE TABELLEN:
   - tasks: +task_type, +priority, +completed_at, +tags
   - projects: +latitude, +longitude, +street, +city, +country, +project_number, +color, etc.

3. NEUE PERMISSION MODULES:
   - general_info (Display Order 2)

4. STORAGE BUCKETS:
   - project-info-images (für Bilder)
   - project-voice-messages (für Sprachnachrichten)

5. HELPER FUNCTIONS:
   - get_project_stats(project_id): Liefert Dashboard-Statistiken

6. RLS POLICIES:
   - Für alle neuen Tabellen
   - Permission-basierte Zugriffe
   - Storage Policies
*/

-- =====================================================
-- NACH DER MIGRATION: ÜBERPRÜFUNGEN
-- =====================================================

-- 1. Prüfen, ob neue Tabellen existieren:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('project_info', 'project_info_images', 'timeline_events');

-- 2. Prüfen, ob 'general_info' Modul hinzugefügt wurde:
SELECT * FROM permission_modules WHERE module_key = 'general_info';

-- 3. Prüfen, ob tasks Tabelle erweitert wurde:
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('task_type', 'priority', 'tags', 'completed_at');

-- 4. Prüfen, ob Storage Buckets existieren:
SELECT id, name, public FROM storage.buckets 
WHERE id IN ('project-info-images', 'project-voice-messages');

-- 5. Test der Helper Function:
-- Ersetze <YOUR_PROJECT_ID> mit echter UUID
SELECT get_project_stats('<YOUR_PROJECT_ID>');

-- =====================================================
-- BEISPIEL-DATEN ZUM TESTEN
-- =====================================================

-- Beispiel: Project Info für ein Projekt erstellen
-- Ersetze <YOUR_PROJECT_ID> mit echter UUID
INSERT INTO project_info (project_id, detailed_description, notes, formatted_address)
VALUES (
  '<YOUR_PROJECT_ID>',
  'Dies ist eine ausführliche Projektbeschreibung mit allen wichtigen Details zum Bauvorhaben.',
  'Interne Notizen für das Team.',
  'Musterstraße 123, 12345 Berlin, Deutschland'
);

-- Beispiel: Timeline Event erstellen
INSERT INTO timeline_events (project_id, title, description, event_type, start_date, end_date, status)
VALUES (
  '<YOUR_PROJECT_ID>',
  'Projektstart',
  'Offizieller Beginn der Bauarbeiten',
  'milestone',
  '2026-03-01 09:00:00+00',
  '2026-03-01 10:00:00+00',
  'scheduled'
);

-- Beispiel: Task mit neuem task_type und priority
INSERT INTO tasks (
  project_id, 
  creator_id, 
  title, 
  description, 
  task_type, 
  priority, 
  status
) VALUES (
  '<YOUR_PROJECT_ID>',
  '<YOUR_USER_ID>',
  'Fundament vorbereiten',
  'Aushub und Vorbereitung für Fundament',
  'task',
  'high',
  'open'
);

-- Beispiel: Mangel (Defect) erstellen
INSERT INTO tasks (
  project_id, 
  creator_id, 
  title, 
  description, 
  task_type, 
  priority, 
  status
) VALUES (
  '<YOUR_PROJECT_ID>',
  '<YOUR_USER_ID>',
  'Riss in Außenwand',
  'Vertikaler Riss in der östlichen Außenwand, ca. 20cm lang',
  'defect',
  'critical',
  'open'
);

-- =====================================================
-- NÜTZLICHE QUERIES FÜR ENTWICKLUNG
-- =====================================================

-- Alle Permissions eines Users für ein Projekt
SELECT * FROM get_user_project_permissions('<USER_ID>', '<PROJECT_ID>');

-- Dashboard Stats abrufen
SELECT * FROM get_project_stats('<PROJECT_ID>');

-- Alle offenen Mängel mit kritischer Priorität
SELECT * FROM tasks 
WHERE project_id = '<PROJECT_ID>' 
  AND task_type = 'defect' 
  AND priority = 'critical' 
  AND status != 'done'
ORDER BY created_at DESC;

-- Anstehende Events (nächste 7 Tage)
SELECT * FROM timeline_events 
WHERE project_id = '<PROJECT_ID>'
  AND start_date >= NOW()
  AND start_date <= NOW() + INTERVAL '7 days'
  AND status != 'cancelled'
ORDER BY start_date ASC;

-- Projekt-Info mit Bildern
SELECT 
  pi.*,
  COUNT(pii.id) as image_count
FROM project_info pi
LEFT JOIN project_info_images pii ON pi.id = pii.project_info_id
WHERE pi.project_id = '<PROJECT_ID>'
GROUP BY pi.id;

-- =====================================================
-- ROLLBACK (Falls nötig)
-- =====================================================

-- WARNUNG: Dies löscht alle Daten in den neuen Tabellen!

-- Tabellen löschen
DROP TABLE IF EXISTS project_info_images CASCADE;
DROP TABLE IF EXISTS project_info CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;

-- Permission Module entfernen
DELETE FROM permission_modules WHERE module_key = 'general_info';

-- Display Order zurücksetzen
UPDATE permission_modules SET display_order = 2 WHERE module_key = 'tasks';
UPDATE permission_modules SET display_order = 3 WHERE module_key = 'defects';
UPDATE permission_modules SET display_order = 4 WHERE module_key = 'schedule';
-- ... etc.

-- Spalten aus tasks entfernen (VORSICHT!)
ALTER TABLE tasks DROP COLUMN IF EXISTS task_type;
ALTER TABLE tasks DROP COLUMN IF EXISTS priority;
ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS tags;

-- Spalten aus projects entfernen (VORSICHT!)
ALTER TABLE projects DROP COLUMN IF EXISTS latitude;
ALTER TABLE projects DROP COLUMN IF EXISTS longitude;
ALTER TABLE projects DROP COLUMN IF EXISTS street;
-- ... etc.

-- Storage Buckets löschen
DELETE FROM storage.buckets WHERE id IN ('project-info-images', 'project-voice-messages');

-- Helper Function löschen
DROP FUNCTION IF EXISTS get_project_stats(UUID);

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

/**
 * Problem: Migration schlägt mit "function check_user_permission does not exist" fehl
 * Lösung: Zuerst 20260211_roles_permissions_system.sql ausführen
 * 
 * Problem: Storage Policies werden nicht erstellt
 * Lösung: Manuell in Supabase Dashboard unter "Storage" → "Policies" hinzufügen
 * 
 * Problem: RLS Policies blockieren Zugriff
 * Lösung: Als Projektowner einloggen oder Policies überprüfen
 * 
 * Problem: general_info nicht in permission_modules
 * Lösung: INSERT INTO permission_modules manuell ausführen (siehe Zeile 28 der Migration)
 */

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Index-Nutzung überprüfen
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tasks', 'timeline_events', 'project_info')
ORDER BY idx_scan DESC;

-- Tabellen-Größen überprüfen
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tasks', 'timeline_events', 'project_info', 'project_info_images')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- ENDE DER SQL ANWEISUNGEN
-- =====================================================
