# Team-Management System - Implementierungsanleitung

## Übersicht

Das Team-Management-System erweitert die bestehende Architektur um eine hierarchische Teamstruktur für Subunternehmen. Es ermöglicht:

1. **Teams** repräsentieren Subunternehmen/Organisationen
2. **Team-Admins** können innerhalb ihres Teams Mitglieder verwalten
3. **Superuser** können Teams erstellen und Team-Admins ernennen
4. **Team-Mitglieder** sehen nur Aufgaben ihres eigenen Teams
5. **Team-basierte Projektmitgliedschaft** beim Hinzufügen zu Projekten

## Datenbank-Struktur

### Neue Tabellen

#### `teams`
- `id` - UUID, Primary Key
- `name` - TEXT, Team-Name
- `description` - TEXT, Beschreibung
- `company_info` - TEXT, Firmeninfo
- `contact_email` - TEXT
- `contact_phone` - TEXT
- `address` - TEXT
- `logo_url` - TEXT
- `created_by` - UUID → profiles(id)
- `is_active` - BOOLEAN
- `created_at`, `updated_at` - TIMESTAMPTZ

#### `team_invitations`
- `id` - UUID, Primary Key
- `team_id` - UUID → teams(id)
- `email` - TEXT
- `team_role` - TEXT ('member', 'team_admin')
- `invited_by` - UUID → profiles(id)
- `status` - TEXT ('pending', 'accepted', 'declined', 'expired')
- `token` - TEXT, UNIQUE
- `expires_at` - TIMESTAMPTZ
- `invited_at`, `accepted_at` - TIMESTAMPTZ

#### `team_project_access`
- `id` - UUID, Primary Key
- `project_id` - UUID → projects(id)
- `team_id` - UUID → teams(id)
- `added_by` - UUID → profiles(id)
- `added_at` - TIMESTAMPTZ

### Erweiterte Tabellen

#### `profiles`
Neue Spalten:
- `team_id` - UUID → teams(id)
- `team_role` - TEXT ('member', 'team_admin')
- `joined_team_at` - TIMESTAMPTZ

#### `project_members`
Neue Spalten:
- `member_team_id` - UUID → teams(id) (Snapshot)
- `added_by` - UUID → profiles(id)

## RLS-Policies

### Teams
- **SELECT**: Superusers sehen alle Teams, Team-Mitglieder nur ihr eigenes
- **INSERT**: Nur Superusers
- **UPDATE**: Superusers und Team-Admins (für ihr Team)
- **DELETE**: Nur Superusers

### Team-Einladungen
- **SELECT**: Superusers, Team-Admins (für ihr Team), eingeladene User
- **INSERT**: Superusers und Team-Admins
- **UPDATE**: Superusers, Team-Admins, eingeladene User

### Team-Projekt-Zugriff
- **SELECT**: Superusers, Team-Mitglieder, Projekt-Mitglieder
- **INSERT**: Superusers und Projekt-Owner
- **DELETE**: Superusers und Projekt-Owner

## Helper Functions

### `is_team_admin(user_id, team_id)`
Prüft, ob ein User Team-Admin eines bestimmten Teams ist.

### `can_manage_team_member(manager_id, target_user_id)`
Prüft, ob ein User einen anderen User verwalten kann (gleich Team + Team-Admin oder Superuser).

### `get_team_members(team_id)`
Gibt alle Mitglieder eines Teams zurück.

### `get_available_team_members_for_project(team_id, project_id)`
Gibt verfügbare Team-Mitglieder für ein Projekt zurück, inkl. Status ob bereits im Projekt.

### `add_team_member_to_project(user_id, project_id, role_id, custom_perms)`
Fügt ein Team-Mitglied zu einem Projekt hinzu. Darf nur von:
- Superusers
- Projekt-Owner
- Team-Admin (wenn Team Zugriff auf Projekt hat)

### `get_user_project_permissions(user_id, project_id)`
**Aktualisiert** - Berücksichtigt jetzt Team-Mitgliedschaft.

## TypeScript Integration

### Neue Typen
```typescript
// packages/api/src/types/team.ts
Team
TeamMember
TeamInvitation
TeamProjectAccess
ExtendedProfile
AvailableTeamMember
```

### Service
```typescript
// packages/api/src/services/teamService.ts
TeamService.getAllTeams()
TeamService.createTeam(team)
TeamService.updateTeam(teamId, updates)
TeamService.deleteTeam(teamId)
TeamService.getTeamMembers(teamId)
TeamService.addMemberToTeam(userId, teamId, role)
TeamService.removeMemberFromTeam(userId)
TeamService.updateMemberRole(userId, role)
TeamService.inviteToTeam(teamId, email, role)
TeamService.acceptTeamInvitation(invitationId)
TeamService.addTeamToProject(teamId, projectId)
TeamService.removeTeamFromProject(teamId, projectId)
TeamService.getProjectTeams(projectId)
TeamService.addTeamMemberToProject(userId, projectId, roleId, customPerms)
```

## React-Komponenten

### TeamManagement (Admin-App)
Vollständige Team-Verwaltung für Superusers:
- Teams erstellen/bearbeiten/löschen
- Team-Mitglieder anzeigen
- Mitglieder einladen
- Team-Rollen verwalten (Member ↔ Team-Admin)

Pfad: `/apps/admin/src/pages/TeamManagement.tsx`

## Workflow-Szenarien

### Szenario 1: Superuser erstellt Team
1. Superuser navigiert zu Team-Verwaltung
2. Erstellt neues Team (z.B. "Elektrik Schmidt GmbH")
3. Lädt Mitglieder per E-Mail ein
4. Ernennt einen Mitarbeiter zum Team-Admin

### Szenario 2: Team-Admin fügt Mitglied zu Projekt hinzu
1. Projekt-Owner fügt Team zum Projekt hinzu
2. Team-Admin sieht sein Team im Projekt
3. Team-Admin kann Team-Mitglieder zum Projekt hinzufügen
4. Team-Admin vergibt Rollen/Rechte (nur für sein Team)

### Szenario 3: Team-Mitglied sieht nur eigene Aufgaben
1. User ist Mitglied von "Team Elektrik"
2. Im Projekt sind auch "Team Sanitär" und "Team Maler"
3. User sieht in Tasks/Mängel-Listen nur Einträge seines Teams
4. Wird über RLS auf Datenbankebene gefiltert

### Szenario 4: Einladung akzeptieren
1. User erhält E-Mail mit Einladungslink
2. Klickt auf Link, wird zu Login/Registrierung geleitet
3. Nach Login wird Einladung akzeptiert
4. `profiles.team_id` wird gesetzt
5. User erscheint in Team-Mitgliederliste

## Anpassungen an bestehenden Seiten

### ProjectParticipants
**Zu erweitern:**
1. Dropdown "Team hinzufügen" für Projekt-Owner/Superuser
2. Team-Filter: Zeige Mitglieder nach Team gruppiert
3. Team-Admins können nur Mitglieder ihres Teams verwalten
4. Beim Hinzufügen eines Members: `member_team_id` setzen

**Beispiel-Code:**
```typescript
// Team hinzufügen zu Projekt
await TeamService.addTeamToProject(selectedTeamId, projectId);

// Team-Mitglieder abrufen
const teamMembers = await TeamService.getAvailableTeamMembers(teamId, projectId);

// Mitglied hinzufügen
await TeamService.addTeamMemberToProject(userId, projectId, roleId);
```

### ProjectTasks / ProjectDefects
**Zu erweitern:**
1. RLS-Policies müssen `member_team_id` berücksichtigen
2. WHERE-Clause: Nur Tasks/Defects von eigenem Team anzeigen
3. Superuser und Projekt-Owner sehen alles

**SQL-Beispiel:**
```sql
-- In RLS Policy für tasks
WHERE 
  project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  AND (
    -- Superuser sieht alles
    (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = TRUE
    -- Projekt-Owner sieht alles
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    -- Normale User sehen nur Tasks ihres Teams
    OR assigned_to IN (
      SELECT user_id FROM project_members pm
      WHERE pm.project_id = tasks.project_id
      AND pm.member_team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
    )
  )
```

## Migration bestehender Daten

**Optional:** Bestehende User ohne Team können einem Standard-Team zugeordnet werden:

```sql
-- Ist bereits in Migration enthalten als Kommentar
UPDATE profiles 
SET team_id = (SELECT id FROM teams WHERE name = 'Unabhängige Benutzer')
WHERE team_id IS NULL AND is_superuser = FALSE;
```

**Empfohlen:** Bestehende User behalten `team_id = NULL`, werden wie bisher behandelt. Neue Team-Struktur ist opt-in.

## Navigation / Routing

### Admin-App
```typescript
// In App.tsx oder Router
import { TeamManagement } from './pages/TeamManagement';

<Route path="/teams" element={<TeamManagement />} />
```

### Sidebar-Eintrag (Superuser-only)
```tsx
{isSuperuser && (
  <TouchableOpacity onPress={() => navigate('/teams')}>
    <Users size={20} />
    <Text>Teams</Text>
  </TouchableOpacity>
)}
```

## Testing

### Testfälle
1. **Team erstellen** (Superuser)
2. **Mitglied einladen** (Team-Admin)
3. **Team zu Projekt hinzufügen** (Projekt-Owner)
4. **Team-Mitglied zu Projekt hinzufügen** (Team-Admin)
5. **Aufgaben-Filterung** (Team-Mitglied sieht nur eigene)
6. **Rechte-Vergabe** (Team-Admin kann nur innerhalb seines Teams)
7. **Team löschen** (nur Superuser)

## Sicherheits-Checks

✅ Team-Admins können keine anderen Teams sehen (RLS)  
✅ Team-Admins können keine User anderer Teams verwalten (Function-Check)  
✅ Normale User können keine Teams erstellen (RLS Policy)  
✅ Team-Mitglieder sehen nur Daten ihres Teams (RLS + Filter)  
✅ Superuser behält alle Rechte (alle Policies prüfen is_superuser)  

## Nächste Schritte

1. **Migration ausführen:**
   ```bash
   npx supabase migration up
   ```

2. **TeamManagement-Seite einbinden** in Admin-App

3. **ProjectParticipants erweitern** mit Team-Auswahl

4. **RLS-Policies für Tasks/Defects** anpassen

5. **Frontend-Filtering** in Task/Defect-Listen basierend auf Team

6. **Testing** mit mehreren Teams durchführen

## Support & Erweiterungen

### Geplante Features
- Team-Dashboard mit Statistiken
- Team-Chat/Kommunikation
- Team-spezifische Dateien/Ordner
- Team-Performance-Tracking
- Inter-Team-Aufgaben (mit Freigabe)

### Anpassungen
Die Struktur ist modular aufgebaut und kann leicht erweitert werden:
- Weitere Team-Rollen (z.B. 'team_viewer')
- Team-Hierarchien (Subteams)
- Team-übergreifende Berechtigungen
- Team-Templates für Rollen/Rechte
