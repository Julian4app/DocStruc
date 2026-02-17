import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Button, Input } from '@docstruc/ui';
import { ModernModal } from './ModernModal';
import { SearchableSelect } from './SearchableSelect';
import { ImageUploader } from './ImageUploader';
import { CountrySelect } from './CountrySelect';
import { StatusSelect } from './StatusSelect';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '@docstruc/theme';

interface ProjectEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectUpdated: () => void;
    project: any;
}

export function ProjectEditModal({ isOpen, onClose, onProjectUpdated, project }: ProjectEditModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Form Data
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [street, setStreet] = useState('');
    const [zip, setZip] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('DE');
    const [status, setStatus] = useState('Angefragt');
    const [images, setImages] = useState<string[]>([]);

    // Selection Data
    const [employees, setEmployees] = useState<any[]>([]);
    const [owners, setOwners] = useState<any[]>([]);
    const [subcontractors, setSubcontractors] = useState<any[]>([]);

    // Selected IDs
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
    const [selectedSubcontractors, setSelectedSubcontractors] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && project) {
            // Load project data into form
            setTitle(project.name || '');
            setSubtitle(project.subtitle || '');
            setDescription(project.description || '');
            setStreet(project.street || '');
            setZip(project.zip || '');
            setCity(project.city || '');
            setCountry(project.country || 'DE');
            setStatus(project.status || 'Angefragt');
            setImages(project.images || []);
            
            // Load resources and existing relationships
            fetchResourcesAndLinks();
        }
    }, [isOpen, project]);

    const fetchResourcesAndLinks = async () => {
        // Fetch all available employees, owners, subcontractors
        const [empRes, ownRes, subRes] = await Promise.all([
            supabase.from('crm_contacts').select('id, type, first_name, last_name, email, phone, avatar_url, personal_number, detailed_address, notes, linked_user_id, created_at, updated_at').eq('type', 'employee'),
            supabase.from('crm_contacts').select('id, type, first_name, last_name, email, phone, avatar_url, personal_number, detailed_address, notes, linked_user_id, created_at, updated_at').eq('type', 'owner'),
            supabase.from('subcontractors').select('id, company_name, name, first_name, last_name, phone, notes, detailed_address, profile_picture_url, trade, street, zip, city, country, website, logo_url, created_at')
        ]);
        
        if (empRes.data) setEmployees(empRes.data);
        if (ownRes.data) setOwners(ownRes.data);
        if (subRes.data) setSubcontractors(subRes.data);

        // Fetch existing relationships
        if (project?.id) {
            const [linksRes, subLinksRes] = await Promise.all([
                supabase.from('project_crm_links').select('contact_id, role').eq('project_id', project.id),
                supabase.from('project_subcontractors').select('subcontractor_id').eq('project_id', project.id)
            ]);

            if (linksRes.data) {
                const empIds = linksRes.data.filter(l => l.role === 'employee').map(l => l.contact_id);
                const ownIds = linksRes.data.filter(l => l.role === 'owner').map(l => l.contact_id);
                setSelectedEmployees(empIds);
                setSelectedOwners(ownIds);
            }

            if (subLinksRes.data) {
                const subIds = subLinksRes.data.map(l => l.subcontractor_id);
                setSelectedSubcontractors(subIds);
            }
        }
    };

    const handleUpdate = async () => {
        if (!title || !street || !city) {
            showToast('Please fill in required fields (Title, Street, City)', 'error');
            return;
        }

        if (!project?.id) return;

        // Build complete address for Google Maps / Navigation
        const fullAddress = `${street}, ${zip} ${city}, ${country}`;

        setLoading(true);
        try {
            // 1. Update Project
            const { error } = await supabase.from('projects').update({
                name: title,
                subtitle: subtitle,
                description: description,
                address: fullAddress,
                street: street,
                zip: zip,
                city: city,
                country: country,
                status: status,
                images: images,
                picture_url: images[0] || '',
            }).eq('id', project.id);

            if (error) throw error;

            // 2. Update Employee & Owner Links
            // Delete existing links
            await supabase.from('project_crm_links').delete().eq('project_id', project.id);
            
            // Add new links
            const contactLinks = [
                ...selectedEmployees.map(id => ({ project_id: project.id, contact_id: id, role: 'employee' })),
                ...selectedOwners.map(id => ({ project_id: project.id, contact_id: id, role: 'owner' }))
            ];
            
            if (contactLinks.length > 0) {
                await supabase.from('project_crm_links').insert(contactLinks);
            }

            // 3. Update Subcontractor Links
            // Delete existing
            await supabase.from('project_subcontractors').delete().eq('project_id', project.id);
            
            // Add new
            if (selectedSubcontractors.length > 0) {
                const subInserts = selectedSubcontractors.map(sid => ({
                    project_id: project.id,
                    subcontractor_id: sid
                }));
                await supabase.from('project_subcontractors').insert(subInserts);
            }

            showToast('Project updated successfully', 'success');
            onProjectUpdated();
            onClose();
            
        } catch (error: any) {
            console.error(error);
            showToast('Error updating project: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModernModal visible={isOpen} onClose={onClose} title="Projekt bearbeiten">
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
                <View style={styles.form}>
                    <Input label="Projektname *" value={title} onChangeText={setTitle} />
                    <Input label="Untertitel" value={subtitle} onChangeText={setSubtitle} />
                    <Input label="Beschreibung" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
                    
                    <Text style={styles.sectionHeader}>Adresse (für Navigation & Maps)</Text>
                    <Input label="Straße *" value={street} onChangeText={setStreet} placeholder="z.B. Hauptstraße 123" />
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Input label="PLZ" value={zip} onChangeText={setZip} placeholder="z.B. 10115" />
                        </View>
                        <View style={{ flex: 2 }}>
                            <Input label="Stadt *" value={city} onChangeText={setCity} placeholder="z.B. Berlin" />
                        </View>
                    </View>
                    <CountrySelect 
                        label="Land" 
                        value={country} 
                        onChange={setCountry}
                    />
                    
                    <ImageUploader 
                        label="Projektbilder" 
                        value={images} 
                        onChange={setImages} 
                        bucketName="project-images"
                    />

                    <StatusSelect 
                        label="Projektstatus *"
                        value={status}
                        onChange={setStatus}
                    />

                    <Text style={styles.sectionHeader}>Zugeordnete Personen & Gewerke</Text>

                    <SearchableSelect 
                        label="Mitarbeiter"
                        placeholder="Mitarbeiter auswählen..."
                        multi
                        options={employees.map(e => ({ 
                            label: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email || 'Unknown', 
                            value: e.id, 
                            subtitle: e.department 
                        }))}
                        values={selectedEmployees}
                        onChange={setSelectedEmployees}
                    />

                    <SearchableSelect 
                        label="Bauherren"
                        placeholder="Bauherren auswählen..."
                        multi
                        options={owners.map(o => ({ 
                            label: `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.company_name || 'Unknown', 
                            value: o.id, 
                            subtitle: o.company_name 
                        }))}
                        values={selectedOwners}
                        onChange={setSelectedOwners}
                    />

                    <SearchableSelect 
                        label="Gewerke"
                        placeholder="Gewerke auswählen..."
                        multi
                        options={subcontractors.map(s => ({ 
                            label: s.name || s.company_name || 'Unknown Company', 
                            value: s.id, 
                            subtitle: s.trade 
                        }))}
                        values={selectedSubcontractors}
                        onChange={setSelectedSubcontractors}
                    />

                    <View style={styles.actions}>
                        <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>Abbrechen</Button>
                        <Button onClick={handleUpdate} disabled={loading} style={{ flex: 1 }}>
                            {loading ? 'Wird gespeichert...' : 'Speichern'}
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </ModernModal>
    );
}

const styles = StyleSheet.create({
    form: {
        gap: 14,
        position: 'relative' as any,
    },
    sectionHeader: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 8,
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        position: 'relative' as any,
        zIndex: 1,
    }
});
