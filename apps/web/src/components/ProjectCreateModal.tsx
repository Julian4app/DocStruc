import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Button, Input } from '@docstruc/ui';
import { ModernModal } from './ModernModal';
import { SearchableSelect } from './SearchableSelect';
import { ImageUploader } from './ImageUploader';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '@docstruc/theme';

interface ProjectCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: () => void;
    userId: string;
}

export function ProjectCreateModal({ isOpen, onClose, onProjectCreated, userId }: ProjectCreateModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Form Data
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
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
        if (isOpen) {
            fetchResources();
        }
    }, [isOpen]);

    const fetchResources = async () => {
        const [empRes, ownRes, subRes] = await Promise.all([
            supabase.from('crm_contacts').select('*').eq('type', 'employee'),
            supabase.from('crm_contacts').select('*').eq('type', 'owner'),
            supabase.from('subcontractors').select('*')
        ]);
        if (empRes.data) setEmployees(empRes.data);
        if (ownRes.data) setOwners(ownRes.data);
        if (subRes.data) setSubcontractors(subRes.data);
    };

    const handleCreate = async () => {
        if (!title || !address) {
            showToast('Please fill in required fields (Title, Address)', 'error');
            return;
        }

        setLoading(true);
        try {
            // 1. Create Project
            const { data: project, error } = await supabase.from('projects').insert({
                name: title,
                subtitle: subtitle,
                description: description,
                address: address,
                status: status, // Ensure DB constraint allows this string
                images: images,
                picture_url: images[0] || '', // Fallback for old apps
                owner_id: userId // The creator is the initial owner or generic admin owner
            }).select().single();

            if (error) throw error;
            const projectId = project.id;

            // 2. Add Employees & Owners (Links)
            const contactLinks = [
                ...selectedEmployees.map(id => ({ project_id: projectId, contact_id: id, role: 'employee' })),
                ...selectedOwners.map(id => ({ project_id: projectId, contact_id: id, role: 'owner' }))
            ];
            
            if (contactLinks.length > 0) {
                 await supabase.from('project_crm_links').insert(contactLinks);
            }

            // 3. Add Subcontractors (Existing table project_subcontractors)
            if (selectedSubcontractors.length > 0) {
                const subInserts = selectedSubcontractors.map(sid => ({
                    project_id: projectId,
                    subcontractor_id: sid
                }));
                await supabase.from('project_subcontractors').insert(subInserts);
            }

            showToast('Project created successfully', 'success');
            onProjectCreated();
            onClose();
            // Reset form
            setTitle(''); setSubtitle(''); setDescription(''); setAddress(''); setImages([]);
            setSelectedEmployees([]); setSelectedOwners([]); setSelectedSubcontractors([]);
            
        } catch (error: any) {
            console.error(error);
            showToast('Error creating project: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModernModal visible={isOpen} onClose={onClose} title="Neues Projekt anlegen">
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
                <View style={styles.form}>
                    <Input label="Projektname *" value={title} onChangeText={setTitle} />
                    <Input label="Untertitel" value={subtitle} onChangeText={setSubtitle} />
                    <Input label="Beschreibung" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
                    <Input label="Adresse (Detail) *" value={address} onChangeText={setAddress} />
                    
                    <ImageUploader 
                        label="Projektbilder" 
                        value={images} 
                        onChange={setImages} 
                        bucketName="project-images"
                    />

                    <SearchableSelect 
                        label="Mitarbeiter hinzufügen"
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
                        label="Bauherren hinzufügen"
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
                        label="Gewerke hinzufügen"
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
                        <Button onClick={handleCreate} disabled={loading} style={{ flex: 1 }}>
                            {loading ? 'Wird erstellt...' : 'Erstellen'}
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </ModernModal>
    );
}

const styles = StyleSheet.create({
    form: {
        gap: 16
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16
    }
});
