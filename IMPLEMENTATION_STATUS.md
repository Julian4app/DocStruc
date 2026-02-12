# Implementierungsübersicht: Projekt-Features & Permissions

## ✅ Abgeschlossene Implementierungen

### 1. **Allgemeine Info" Page**
- **Route**: `/project/:id/general-info`
- **Datei**: `apps/web/src/pages/project/ProjectGeneralInfo.tsx`
- **Features**:
  - ✅ Detaillierte Projektbeschreibung (Textfeld, editierbar)
  - ✅ Standort mit Google Maps Integration (Route öffnen)
  - ✅ Bildergalerie (Platzhalter für Upload)
  - ✅ Sprachnachrichten (Platzhalter für Aufnahme)
  - ✅ Notizen
  - ✅ Permission-basierte Bearbeitung
- **Datenbank**: Tabellen `project_info`, `project_info_images`, Storage Buckets

### 2. **Navigation Update**
- ✅ "Allgemeine Info" als zweiter Menüpunkt hinzugefügt
- ✅ Icon: `Info` von lucide-react
- ✅ Route in App.tsx registriert

### 3. **Dashboard Improvements**
- **Datei**: `apps/web/src/pages/project/ProjectDashboard.tsx`
- **Live-Features**:
  - ✅ Echtzeit-Statistiken (Tasks, Mängel, Events)
  - ✅ Letzte Aktivitäten (5 neueste Tasks/Mängel)
  - ✅ Anstehende Termine (nächste 7 Tage)
  - ✅ Kritische Mängel-Warnung
  - ✅ Klickbare Stat-Cards (Navigation zu Pages)
  - ✅ Permission-basierte Navigation

### 4. **Existierende funktionierende Pages**

#### Aufgaben (ProjectTasks.tsx)
- ✅ **CREATE**: Neue Aufgaben erstellen
- ✅ **READ**: Alle Aufgaben anzeigen
- ✅ **Filter**: Nach Status, Suche
- ⚠️ **UPDATE**: Basis vorhanden (Modal öffnet, aber Save fehlt)
- ⚠️ **DELETE**: Nicht implementiert

#### Mängel (ProjectDefects.tsx)
- ✅ **CREATE**: Neue Mängel erstellen mit Priorität
- ✅ **READ**: Alle Mängel anzeigen
- ✅ **Filter**: Nach Priorität (low, medium, high, critical)
- ⚠️ **UPDATE**: Detail-Modal vorhanden (aber Save fehlt)
- ⚠️ **DELETE**: Nicht implementiert

#### Termine & Ablauf (ProjectSchedule.tsx)
- ✅ **READ**: Termine anzeigen
- ⚠️ **CREATE**: Nicht vollständig implementiert
- ⚠️ **UPDATE**: Nicht implementiert  
- ⚠️ **DELETE**: Nicht implementiert

---

## 🔄 Benötigte Verbesserungen

### A. Aufgaben (ProjectTasks.tsx)
**Fehlende Features:**
1. ❌ **UPDATE**: Aufgabe bearbeiten (Status ändern, Titel/Beschreibung ändern)
2. ❌ **DELETE**: Aufgabe löschen
3. ❌ **Assign**: Mitarbeiter zuweisen
4. ❌ **Due Date**: Frist setzen

**Code-Änderungen nötig:**
- `handleUpdateTask()` Funktion implementieren
- `handleDeleteTask()` Funktion implementieren
- Edit-Modal mit Formular erstellen
- Permission checks für edit/delete

### B. Mängel (ProjectDefects.tsx)  
**Fehlende Features:**
1. ❌ **UPDATE**: Mangel bearbeiten (Status, Priorität, Beschreibung ändern)
2. ❌ **DELETE**: Mangel löschen
3. ❌ **Status-Änderung**: offen → in Bearbeitung → behoben

**Code-Änderungen nötig:**
- `handleUpdateDefect()` Funktion implementieren
- `handleDeleteDefect()` Funktion implementieren
- Edit-Modal erweitern mit Save-Funktion
- Status-Dropdown oder Buttons

### C. Termine & Ablauf (ProjectSchedule.tsx)
**Fehlende Features:**
1. ❌ **CREATE**: Vollständige Event-Erstellung
2. ❌ **UPDATE**: Event bearbeiten
3. ❌ **DELETE**: Event löschen
4. ❌ **Kalenderansicht**: Timeline-Visualisierung

**Code-Änderungen nötig:**
- Komplettes CRUD für `timeline_events` Tabelle
- Create-Modal mit allen Feldern (start_date, end_date, event_type, etc.)
- Edit-Modal
- Delete-Confirmation
- Kalender-Component (optional: react-big-calendar oder custom)

---

## 📊 Datenbank-Schema

### Neue Tabellen (bereits in Migration)
```sql
✅ project_info              -- Allgemeine Projektinformationen
✅ project_info_images        -- Bildergalerie für Projekte
✅ timeline_events            -- Termine, Meilensteine, Deadlines
```

### Verbesserte Tabellen
```sql
✅ tasks                      -- +task_type, +priority, +tags, +completed_at
✅ projects                   -- +latitude, +longitude, +street, +city, +project_number, +color
```

### Permission Module
```sql
✅ 'general_info'             -- Neues Modul für Allgemeine Info Page
   (display_order = 2)
```

---

## 🔐 Permission System

### Module Keys (in Reihenfolge)
1. `dashboard` (Display Order 1)
2. `general_info` (Display Order 2) ← **NEU**
3. `tasks` (Display Order 3)
4. `defects` (Display Order 4)
5. `schedule` (Display Order 5)
6. `time_tracking` (Display Order 6)
7. `documentation` (Display Order 7)
8. `files` (Display Order 8)
9. `diary` (Display Order 9)
10. `communication` (Display Order 10)
11. `participants` (Display Order 11)
12. `reports` (Display Order 12)
13. `activity` (Display Order 13)
14. `settings` (Display Order 14)

### Permission Checks (bereits implementiert)
- ✅ `usePermissions(projectId)` Hook
- ✅ `canView(moduleKey)`, `canCreate()`, `canEdit()`, `canDelete()`
- ✅ `isProjectOwner` (volle Rechte)
- ✅ RLS Policies in Datenbank

---

## 🚀 SQL Migration Summary

**Datei**: `supabase/migrations/20260211_general_info_and_improvements.sql`

### Was die Migration macht:
1. ✅ Fügt 'general_info' Modul hinzu
2. ✅ Erstellt `project_info` Tabelle
3. ✅ Erstellt `project_info_images` Tabelle
4. ✅ Erstellt `timeline_events` Tabelle
5. ✅ Erweitert `tasks` Tabelle (task_type, priority, tags, completed_at)
6. ✅ Erweitert `projects` Tabelle (Koordinaten, Adressfelder, Metadaten)
7. ✅ Erstellt Storage Buckets (`project-info-images`, `project-voice-messages`)
8. ✅ Setzt RLS Policies für alle neuen Tabellen
9. ✅ Erstellt Indexes für Performance
10. ✅ Erstellt `get_project_stats()` Helper Function

### Ausführen:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260211_general_info_and_improvements.sql
```

---

## 📝 Nächste Schritte (Empfohlen)

### Priorität 1: Funktionalität vervollständigen
1. **Aufgaben UPDATE/DELETE implementieren**
   - Edit-Modal mit Status-Änderung
   - Delete mit Confirmation
   - Assigned-to Dropdown
   - Due-Date Picker

2. **Mängel UPDATE/DELETE implementieren**
   - Status-Workflow (offen → bearbeitung → behoben)
   - Priority-Änderung
   - Delete mit Confirmation

3. **Termine vollständig implementieren**
   - Create-Event Modal (alle Felder)
   - Edit-Event Modal
   - Delete-Event
   - Timeline-Visualisierung

### Priorität 2: User Experience
4. **Bilder-Upload implementieren**
   - Drag & Drop in ProjectGeneralInfo
   - Supabase Storage Integration
   - Thumbnail-Generierung

5. **Sprachaufnahme implementieren**
   - Browser MediaRecorder API
   - Upload zu Supabase Storage
   - Audio-Player Component

6. **Kalender-View**
   - Integration von Timeline-Visualisierung
   - Drag & Drop für Events
   - Monats-/Wochen-/Tages-Ansicht

### Priorität 3: Advanced Features
7. **Batch-Operations**
   - Multi-Select für Tasks/Defects
   - Bulk-Delete, Bulk-Status-Change

8. **Export-Funktionen**
   - PDF-Export für Berichte
   - Excel-Export für Listen

9. **Notifications**
   - Push-Benachrichtigungen
   - E-Mail-Benachrichtigungen bei Fälligkeiten

---

## 🐛 Bekannte Einschränkungen

1. **Aufgaben/Mängel**: Detail-Modals zeigen Daten, aber Save-Funktionalität fehlt
2. **Termine**: Nur Lese-Ansicht, keine vollständige Bearbeitung
3. **Bilder**: Nur Platzhalter, kein Upload implementiert
4. **Sprachnachrichten**: Nur Platzhalter, keine Aufnahme implementiert
5. **Permissions**: Frontend-Checks vorhanden, aber nicht alle Buttons versteckt/disabled

---

## 💡 Hinweise für Entwicklung

### Permission Checks verwenden:
```tsx
const permissions = usePermissions(projectId);

if (permissions.canEdit('tasks')) {
  // Edit-Button anzeigen
}

if (permissions.canDelete('defects')) {
  // Delete-Button anzeigen
}
```

### CRUD Pattern:
```tsx
// CREATE
const handleCreate = async () => {
  const { error } = await supabase.from('tasks').insert({ ... });
  if (!error) loadTasks();
};

// UPDATE
const handleUpdate = async (id: string, updates: Partial<Task>) => {
  const { error } = await supabase.from('tasks').update(updates).eq('id', id);
  if (!error) loadTasks();
};

// DELETE
const handleDelete = async (id: string) => {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (!error) loadTasks();
};
```

---

## ✅ Checkliste für User

**Datenbank:**
- [ ] Migration ausführen: `20260211_roles_permissions_system.sql` (bereits ausgeführt?)
- [ ] Migration ausführen: `20260211_general_info_and_improvements.sql` (NEU)
- [ ] Storage Buckets überprüfen in Supabase Dashboard

**Frontend:**
- [x] "Allgemeine Info" Page erstellt
- [x] Navigation aktualisiert
- [x] Dashboard verbessert
- [ ] Aufgaben UPDATE/DELETE ergänzen
- [ ] Mängel UPDATE/DELETE ergänzen  
- [ ] Termine CRUD vollständig implementieren

**Testing:**
- [ ] Neue Page testen: `/project/[id]/general-info`
- [ ] Dashboard-Statistiken überprüfen
- [ ] Permission-System testen (verschiedene Rollen)
- [ ] CRUD-Operationen für alle Seiten testen

