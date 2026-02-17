import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { DatePicker } from '../../components/DatePicker';
import { ImageUploader } from '../../components/ImageUploader';
import { CountrySelect } from '../../components/CountrySelect';
import { StatusSelect } from '../../components/StatusSelect';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useLayout } from '../../layouts/LayoutContext';
import { 
  Settings, Archive, Trash2, Save, AlertTriangle, Building2, MapPin, 
  Calendar, Image, Users, FileText, Briefcase, ArrowLeft, Shield, UsersRound 
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  status: string;
  start_date?: string;
  target_end_date?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  images?: string[];
  picture_url?: string;
}

export function ProjectManagementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setTitle, setSubtitle } = useLayout();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  
  // Basic Information
  const [name, setName] = useState('');
  const [projectSubtitle, setProjectSubtitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Status & Dates
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [statusDate, setStatusDate] = useState('');
  
  // Address
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  
  // Media
  const [images, setImages] = useState<string[]>([]);
  
  // People (uses user_accessors + project_members for actual access control)
  const [allAccessors, setAllAccessors] = useState<any[]>([]);
  const [currentMembers, setCurrentMembers] = useState<any[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  // Roles for this project
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedProjectRoleIds, setSelectedProjectRoleIds] = useState<string[]>([]);
  
  // Teams for this project
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    setTitle('Projekt Management');
    setSubtitle('Vollständige Projektkonfiguration');
    return () => { setTitle(''); setSubtitle(''); };
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    if (id) {
      loadProject();
      loadResources();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        setProject(data);
        setName(data.name || '');
        setProjectSubtitle(data.subtitle || '');
        setDescription(data.description || '');
        setStatus(data.status || 'active');
        setStartDate(data.start_date || '');
        setTargetEndDate(data.target_end_date || '');
        setStatusDate(data.status_date || '');
        setStreet(data.street || '');
        setZip(data.zip || '');
        setCity(data.city || '');
        setCountry(data.country || 'DE');
        setImages(data.images || []);
        
        // Load linked people
        loadLinkedPeople();
      }
    } catch (error: any) {
      console.error('Error loading project:', error);
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      // Get current user (superuser) ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load all user_accessors (the actual users that can be added to projects)
      const { data: accessorsData, error: accessorsError } = await supabase
        .from('user_accessors')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true);

      if (accessorsError) throw accessorsError;
      setAllAccessors(accessorsData || []);
      
      // Load all roles that can be assigned to projects
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id, role_name, role_description')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (rolesError) throw rolesError;
      setAvailableRoles(rolesData || []);
      
      // Load all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, description')
        .eq('is_active', true);
      
      if (teamsError) throw teamsError;
      setAllTeams(teamsData || []);
    } catch (error: any) {
      console.error('Error loading resources:', error);
    }
  };

  const loadLinkedPeople = async () => {
    if (!id) return;
    
    try {
      // Load actual project_members (the real access-control table)
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          *,
          accessor:user_accessors(*),
          role:roles(id, role_name)
        `)
        .eq('project_id', id);

      if (membersError) throw membersError;
      
      setCurrentMembers(membersData || []);
      // Set selected member accessor IDs for the SearchableSelect
      const accessorIds = (membersData || [])
        .filter(m => m.accessor_id)
        .map(m => m.accessor_id);
      setSelectedMemberIds(accessorIds);
      
      // Load project_available_roles for this project
      const { data: projectRolesData, error: projectRolesError } = await supabase
        .from('project_available_roles')
        .select('role_id')
        .eq('project_id', id);
      
      if (projectRolesError) throw projectRolesError;
      
      const roleIds = (projectRolesData || []).map(pr => pr.role_id).filter(Boolean);
      setSelectedProjectRoleIds(roleIds as string[]);
      
      // Load team_project_access for this project
      const { data: projectTeamsData, error: projectTeamsError } = await supabase
        .from('team_project_access')
        .select('team_id')
        .eq('project_id', id);
      
      if (projectTeamsError) throw projectTeamsError;
      
      const teamIds = (projectTeamsData || []).map(pt => pt.team_id).filter(Boolean);
      setSelectedTeamIds(teamIds as string[]);
    } catch (error: any) {
      console.error('Error loading linked people:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Projektname erforderlich', 'error');
      return;
    }

    if (!street.trim() || !city.trim()) {
      showToast('Straße und Stadt erforderlich', 'error');
      return;
    }

    setSaving(true);
    try {
      // Build full address
      const fullAddress = `${street}, ${zip} ${city}, ${country}`;

      // Update project
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          subtitle: projectSubtitle.trim() || null,
          description: description.trim() || null,
          status,
          start_date: startDate || null,
          target_end_date: targetEndDate || null,
          status_date: statusDate || null,
          street: street.trim(),
          zip: zip.trim(),
          city: city.trim(),
          country: country,
          address: fullAddress,
          images: images,
          picture_url: images[0] || null,
        })
        .eq('id', id);

      if (projectError) throw projectError;

      // 1. Sync project_available_roles with selected roles
      const { data: existingProjectRoles } = await supabase
        .from('project_available_roles')
        .select('id, role_id')
        .eq('project_id', id);

      const existingRoleIds = (existingProjectRoles || []).map(pr => pr.role_id).filter(Boolean);
      
      // Find roles to add/remove
      const rolesToAdd = selectedProjectRoleIds.filter(rid => !existingRoleIds.includes(rid));
      const rolesToRemove = (existingProjectRoles || []).filter(pr => pr.role_id && !selectedProjectRoleIds.includes(pr.role_id));

      // Remove unselected project roles
      if (rolesToRemove.length > 0) {
        const removeRoleIds = rolesToRemove.map(pr => pr.id);
        await supabase.from('project_available_roles').delete().in('id', removeRoleIds);
      }

      // Add newly selected project roles
      if (rolesToAdd.length > 0) {
        const projectRolesToInsert = rolesToAdd.map(roleId => ({
          project_id: id,
          role_id: roleId
        }));
        await supabase.from('project_available_roles').insert(projectRolesToInsert);
      }

      // 1.5. Sync team_project_access with selected teams
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existingTeamAccess } = await supabase
        .from('team_project_access')
        .select('id, team_id')
        .eq('project_id', id);

      const existingTeamIds = (existingTeamAccess || []).map(ta => ta.team_id).filter(Boolean);
      
      // Find teams to add/remove
      const teamsToAdd = selectedTeamIds.filter(tid => !existingTeamIds.includes(tid));
      const teamsToRemove = (existingTeamAccess || []).filter(ta => ta.team_id && !selectedTeamIds.includes(ta.team_id));

      // Remove unselected team access
      if (teamsToRemove.length > 0) {
        const removeTeamIds = teamsToRemove.map(ta => ta.id);
        await supabase.from('team_project_access').delete().in('id', removeTeamIds);
      }

      // Add newly selected teams
      if (teamsToAdd.length > 0 && user) {
        const teamAccessToInsert = teamsToAdd.map(teamId => ({
          project_id: id,
          team_id: teamId,
          added_by: user.id
        }));
        await supabase.from('team_project_access').insert(teamAccessToInsert);
      }

      // 2. Sync project_members with selected accessors
      const { data: existingMembers } = await supabase
        .from('project_members')
        .select('id, accessor_id')
        .eq('project_id', id);

      console.log('Existing members:', existingMembers);
      console.log('Selected member IDs:', selectedMemberIds);

      const existingAccessorIds = (existingMembers || []).map(m => m.accessor_id).filter(Boolean);
      
      // Find members to add (in selected but not existing)
      const toAdd = selectedMemberIds.filter(aid => !existingAccessorIds.includes(aid));
      // Find members to remove (in existing but not selected)
      const toRemove = (existingMembers || []).filter(m => m.accessor_id && !selectedMemberIds.includes(m.accessor_id));

      console.log('Members to add:', toAdd);
      console.log('Members to remove:', toRemove);

      // Remove unselected members
      if (toRemove.length > 0) {
        const removeIds = toRemove.map(m => m.id);
        // Also delete their custom permissions first
        await supabase.from('project_member_permissions').delete().in('project_member_id', removeIds);
        await supabase.from('project_members').delete().in('id', removeIds);
      }

      // Add newly selected members
      if (toAdd.length > 0) {
        console.log('Adding members:', toAdd);
        for (const accessorId of toAdd) {
          const accessor = allAccessors.find(a => a.id === accessorId);
          if (!accessor) {
            console.warn('Accessor not found:', accessorId);
            continue;
          }

          console.log('Inserting member:', {
            project_id: id,
            user_id: accessor.registered_user_id || null,
            accessor_id: accessorId,
            member_type: accessor.accessor_type || 'other',
            role: 'member',
            status: accessor.registered_user_id ? 'invited' : 'open'
          });

          // If accessor has a registered user, send invitation
          if (accessor.registered_user_id) {
            const { data: inviteData, error: inviteError } = await supabase.rpc('send_project_invitation', {
              p_project_id: id,
              p_user_id: accessor.registered_user_id,
              p_role: 'viewer'
            });

            if (inviteError) {
              console.error('Error sending invitation:', inviteError);
              // Fall back to regular insert
              const { data: insertedMember, error: insertError } = await supabase
                .from('project_members')
                .insert({
                  project_id: id,
                  user_id: accessor.registered_user_id,
                  accessor_id: accessorId,
                  member_type: accessor.accessor_type || 'other',
                  role: 'viewer',
                  status: 'invited'
                })
                .select()
                .single();

              if (insertError) {
                console.error('Error inserting member:', insertError);
                throw insertError;
              }
              console.log('Successfully inserted member (fallback):', insertedMember);
            } else {
              console.log('Successfully sent invitation:', inviteData);
            }
          } else {
            // No registered user, just create member record
            const { data: insertedMember, error: insertError } = await supabase
              .from('project_members')
              .insert({
                project_id: id,
                user_id: null,
                accessor_id: accessorId,
                member_type: accessor.accessor_type || 'other',
                role: 'viewer',
                status: 'open'
              })
              .select()
              .single();

            if (insertError) {
              console.error('Error inserting member:', insertError);
              throw insertError;
            }
            console.log('Successfully inserted member:', insertedMember);
          }
        }
      }

      showToast('Einstellungen gespeichert', 'success');
      await loadProject();
    } catch (error: any) {
      console.error('Error saving project:', error);
      const errorMessage = error?.message || error?.error_description || error?.hint || 'Unbekannter Fehler';
      showToast(`Fehler beim Speichern: ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Projekt archivieren?')) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      showToast('Projekt archiviert', 'success');
      navigate('/manage-projects');
    } catch (error: any) {
      console.error('Error archiving project:', error);
      showToast('Fehler beim Archivieren', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Projekt ENDGÜLTIG löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Projekt gelöscht', 'success');
      navigate('/manage-projects');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      showToast('Fehler beim Löschen', 'error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Status options that need a date
  const statusesWithDate = ['on_hold', 'paused', 'planning'];
  const showStatusDate = statusesWithDate.includes(status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigate('/manage-projects')} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.pageTitle}>{project?.name || 'Projekt Management'}</Text>
            <Text style={styles.pageSubtitle}>Vollständige Projektkonfiguration und Verwaltung</Text>
          </View>
        </View>
        <Button onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Speichert...' : 'Speichern'}
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Basic Information */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Building2 size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Grundinformationen</Text>
          </View>
          <View style={styles.formGroup}>
            <Input 
              label="Projektname *" 
              value={name} 
              onChangeText={setName} 
              placeholder="z.B. Neubau Einfamilienhaus"
            />
            <Input 
              label="Untertitel" 
              value={projectSubtitle} 
              onChangeText={setProjectSubtitle} 
              placeholder="Kurzer Zusatz zum Projektnamen"
            />
            <Input 
              label="Beschreibung" 
              value={description} 
              onChangeText={setDescription} 
              placeholder="Ausführliche Projektbeschreibung..." 
              multiline 
              numberOfLines={4}
            />
          </View>
        </Card>

        {/* 2. Address */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Projektadresse</Text>
          </View>
          <Text style={styles.helperText}>
            Vollständige Adresse für Navigation, Google Maps und Dokumentation
          </Text>
          <View style={styles.formGroup}>
            <Input 
              label="Straße & Hausnummer *" 
              value={street} 
              onChangeText={setStreet} 
              placeholder="z.B. Hauptstraße 123"
            />
            <View style={styles.row}>
              <Input 
                label="PLZ" 
                value={zip} 
                onChangeText={setZip} 
                placeholder="10115" 
                style={{ flex: 1 }}
              />
              <Input 
                label="Stadt *" 
                value={city} 
                onChangeText={setCity} 
                placeholder="Berlin" 
                style={{ flex: 2 }}
              />
            </View>
            <CountrySelect 
              label="Land" 
              value={country} 
              onChange={setCountry}
            />
          </View>
        </Card>

        {/* 3. Images */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Image size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Projektbilder</Text>
          </View>
          <Text style={styles.helperText}>
            Projektbilder werden in der Projektübersicht und auf der Dashboard-Seite angezeigt
          </Text>
          <ImageUploader 
            label="" 
            value={images} 
            onChange={setImages} 
            bucketName="project-images"
          />
        </Card>

        {/* 4. Status & Dates */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Status & Zeitplanung</Text>
          </View>
          <View style={styles.formGroup}>
            <StatusSelect 
              label="Projektstatus *"
              value={status}
              onChange={setStatus}
            />
            
            {showStatusDate && (
              <>
                <Text style={styles.helperText}>
                  📅 Statusspezifisches Datum (z.B. "Pausiert bis" oder "Geplant bis")
                </Text>
                <DatePicker 
                  label={`${status === 'on_hold' ? 'Pausiert bis' : status === 'paused' ? 'Unterbrochen bis' : 'Geplant bis'}`}
                  value={statusDate} 
                  onChange={setStatusDate} 
                  placeholder="TT.MM.JJJJ"
                />
              </>
            )}
            
            <DatePicker 
              label="Startdatum" 
              value={startDate} 
              onChange={setStartDate} 
              placeholder="TT.MM.JJJJ"
            />
            <DatePicker 
              label="Ziel-Enddatum" 
              value={targetEndDate} 
              onChange={setTargetEndDate} 
              placeholder="TT.MM.JJJJ"
            />
          </View>
        </Card>

        {/* 5. Project Roles */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Projektrollen</Text>
          </View>
          <Text style={styles.helperText}>
            Definieren Sie welche Rollen für dieses Projekt verfügbar sein sollen. Diese Rollen können dann Mitgliedern auf der "Beteiligte" Seite zugewiesen werden.
          </Text>
          <View style={styles.formGroup}>
            <SearchableSelect
              label="Verfügbare Rollen für dieses Projekt"
              placeholder="Rollen auswählen..."
              options={availableRoles.map(r => ({
                label: r.role_name,
                value: r.id,
                subtitle: r.role_description || undefined
              }))}
              values={selectedProjectRoleIds}
              onChange={setSelectedProjectRoleIds}
              multi
            />
          </View>
          {availableRoles.length === 0 && (
            <Text style={{ fontSize: 13, color: '#F59E0B', marginTop: 8 }}>
              ⚠️ Keine Rollen verfügbar. Erstellen Sie zuerst Rollen auf der "Zugriffsberechtigte" Seite im "Rollen" Tab.
            </Text>
          )}
        </Card>

        {/* 5.5. Project Teams */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <UsersRound size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Teams</Text>
          </View>
          <Text style={styles.helperText}>
            Fügen Sie Teams zu diesem Projekt hinzu. Team-Admins können dann ihre eigenen Teammitglieder zum Projekt hinzufügen.
          </Text>
          <View style={styles.formGroup}>
            <SearchableSelect
              label="Teams mit Projektzugriff"
              placeholder="Teams auswählen..."
              options={allTeams.map(t => ({
                label: t.name,
                value: t.id,
                subtitle: t.description || undefined
              }))}
              values={selectedTeamIds}
              onChange={setSelectedTeamIds}
              multi
            />
          </View>
          {allTeams.length === 0 && (
            <Text style={{ fontSize: 13, color: '#F59E0B', marginTop: 8 }}>
              ⚠️ Keine Teams verfügbar. Erstellen Sie zuerst Teams auf der "Zugreifer" Seite im "Teams" Tab.
            </Text>
          )}
        </Card>

        {/* 6. People & Trades */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Beteiligte Personen</Text>
          </View>
          <Text style={styles.helperText}>
            Hier ausgewählte Personen erhalten Zugang zum Projekt und erscheinen in allen Bereichen (Beteiligte, Zuweisungen, etc.). Verwalten Sie die Benutzer unter "Zugriffsberechtigte".
          </Text>
          <View style={styles.formGroup}>
            <SearchableSelect
              label="Projektmitglieder"
              placeholder="Personen zum Projekt hinzufügen..."
              options={allAccessors.map(a => {
                const typeLabels: Record<string, string> = {
                  employee: 'Mitarbeiter',
                  owner: 'Bauherr',
                  subcontractor: 'Nachunternehmer',
                  other: 'Sonstige'
                };
                return {
                  label: `${a.accessor_first_name || ''} ${a.accessor_last_name || ''}`.trim() || a.accessor_email,
                  value: a.id,
                  subtitle: `${typeLabels[a.accessor_type] || a.accessor_type}${a.accessor_company ? ' · ' + a.accessor_company : ''}`
                };
              })}
              values={selectedMemberIds}
              onChange={setSelectedMemberIds}
              multi
            />
          </View>
          
          {/* Current Members Overview */}
          {currentMembers.length > 0 && (
            <View style={styles.currentMembersSection}>
              <Text style={styles.currentMembersTitle}>Aktuelle Mitglieder ({currentMembers.length})</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                Rollen und Einladungen verwalten Sie unter "Beteiligte" im Projekt.
              </Text>
              {currentMembers.map(member => {
                const accessor = member.accessor;
                const typeLabels: Record<string, string> = {
                  employee: 'Mitarbeiter',
                  owner: 'Bauherr',
                  subcontractor: 'Nachunternehmer',
                  other: 'Sonstige'
                };
                const typeColors: Record<string, string> = {
                  employee: '#3B82F6',
                  owner: '#10B981',
                  subcontractor: '#F59E0B',
                  other: '#6B7280'
                };
                const statusLabels: Record<string, string> = {
                  open: 'Offen',
                  invited: 'Eingeladen',
                  active: 'Aktiv',
                  inactive: 'Inaktiv'
                };
                const statusColors: Record<string, string> = {
                  open: '#94A3B8',
                  invited: '#F59E0B',
                  active: '#10B981',
                  inactive: '#EF4444'
                };
                const memberStatus = member.status || 'open';
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {accessor?.accessor_first_name || ''} {accessor?.accessor_last_name || ''}
                      </Text>
                      <Text style={styles.memberEmail}>{accessor?.accessor_email || 'Keine E-Mail'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[
                        styles.memberTypeBadge,
                        { backgroundColor: `${statusColors[memberStatus]}15` }
                      ]}>
                        <Text style={[
                          styles.memberTypeBadgeText,
                          { color: statusColors[memberStatus] }
                        ]}>
                          {statusLabels[memberStatus]}
                        </Text>
                      </View>
                      <View style={[
                        styles.memberTypeBadge, 
                        { backgroundColor: `${typeColors[member.member_type] || '#6B7280'}15` }
                      ]}>
                        <Text style={[
                          styles.memberTypeBadgeText,
                          { color: typeColors[member.member_type] || '#6B7280' }
                        ]}>
                          {typeLabels[member.member_type] || member.member_type}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* 6. Danger Zone */}
        <Card style={[styles.sectionCard, styles.dangerCard]}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color="#DC2626" />
            <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Gefahrenbereich</Text>
          </View>
          <Text style={styles.dangerText}>
            ⚠️ Diese Aktionen sind unwiderruflich und können nicht rückgängig gemacht werden.
          </Text>
          <View style={styles.dangerActions}>
            <Button 
              variant="outline" 
              onClick={handleArchive} 
              style={styles.dangerButton}
            >
              <Archive size={16} />
              Projekt archivieren
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete} 
              style={[styles.dangerButton, styles.deleteButton]}
            >
              <Trash2 size={16} />
              Projekt löschen
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  sectionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  helperText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  formGroup: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  dangerCard: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  dangerText: {
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerActions: {
    gap: 12,
  },
  dangerButton: {
    borderColor: '#DC2626',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  currentMembersSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  currentMembersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  memberEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  memberTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  memberTypeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
