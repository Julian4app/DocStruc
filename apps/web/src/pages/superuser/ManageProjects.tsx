import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLayout } from '../../layouts/LayoutContext';
import { Button, Input } from '@docstruc/ui';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { supabase } from '../../lib/supabase';
import { Project } from '@docstruc/logic';
import { ProjectCreateModal } from '../../components/ProjectCreateModal';
import { colors } from '@docstruc/theme';
import { Edit2, Trash2, MapPin } from 'lucide-react';

export function ManageProjects() {
    const { setTitle, setSubtitle, setActions } = useLayout();
    const { showToast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    
    useEffect(() => {
        setTitle('Projekte Manager');
        setSubtitle('Alle Projekte verwalten und bearbeiten.');
        return () => setSubtitle('');
    }, [setTitle, setSubtitle]);

    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Edit Mode
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    
    useEffect(() => {
        setActions(
            <Button onClick={() => setIsCreateOpen(true)}>+ Neues Projekt</Button>
        );
        return () => setActions(null);
    }, [setActions]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserId(data.user.id);
                fetchProjects();
            }
        });
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (error) console.error(error);
        else setProjects(data || []);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Möchten Sie dieses Projekt wirklich löschen?')) return;
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) showToast('Fehler beim Löschen: ' + error.message, 'error');
        else {
            showToast('Projekt gelöscht', 'success');
            fetchProjects();
        }
    };

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setEditForm({
            name: project.name,
            address: project.address,
            status: project.status
        });
    };

    const saveEdit = async () => {
        if (!editingProject) return;
        const { error } = await supabase.from('projects').update(editForm).eq('id', editingProject.id);
        if (error) showToast('Fehler beim Speichern: ' + error.message, 'error');
        else {
            showToast('Projekt aktualisiert', 'success');
            setEditingProject(null);
            fetchProjects();
        }
    };

    return (
        <>
            <ProjectCreateModal 
                isOpen={isCreateOpen} 
                onClose={() => setIsCreateOpen(false)} 
                onProjectCreated={() => { fetchProjects(); showToast('Projekt erstellt!', 'success'); }}
                userId={userId || ''}
            />

            <ModernModal visible={!!editingProject} onClose={() => setEditingProject(null)} title="Projekt bearbeiten">
                 <View style={{ gap: 16 }}>
                     <Input label="Name" value={editForm.name} onChangeText={(t: string) => setEditForm({...editForm, name: t})} />
                     <Input label="Adresse" value={editForm.address} onChangeText={(t: string) => setEditForm({...editForm, address: t})} />
                     <Input label="Status" value={editForm.status} onChangeText={(t: string) => setEditForm({...editForm, status: t})} />
                     <View style={styles.modalActions}>
                        <Button variant="outline" onClick={() => setEditingProject(null)} style={{ flex: 1 }}>Abbrechen</Button>
                        <Button onClick={saveEdit} style={{ flex: 1 }}>Speichern</Button>
                     </View>
                 </View>
            </ModernModal>

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <View style={styles.grid}>
                    {projects.map(p => (
                        <View key={p.id} style={styles.row}>
                            <View style={styles.projectInfo}>
                                <Text style={styles.projectName}>{p.name}</Text>
                                <View style={styles.metaRow}>
                                    <MapPin size={14} color={colors.textSecondary} />
                                    <Text style={styles.projectMeta}>{p.address || 'Keine Adresse'}</Text>
                                    <View style={styles.statusPill}>
                                        <Text style={styles.statusPillText}>{p.status}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.actionBtns}>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(p)}>
                                    <Edit2 size={16} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn]} onPress={() => handleDelete(p.id)}>
                                    <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    {projects.length === 0 && !loading && (
                        <Text style={styles.empty}>Keine Projekte vorhanden.</Text>
                    )}
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    grid: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    projectInfo: {
        flex: 1,
        gap: 4,
    },
    projectName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    projectMeta: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: '#f0f4ff',
        marginLeft: 8,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.primary,
    },
    actionBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        backgroundColor: '#fef2f2',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        color: colors.textSecondary,
        fontSize: 15,
    },
});
