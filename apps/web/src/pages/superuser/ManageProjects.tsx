import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLayout } from '../../layouts/LayoutContext';
import { Button, Input } from '@docstruc/ui';
import { ModernModal } from '../../components/ModernModal';
import { useToast } from '../../components/ToastProvider';
import { supabase } from '../../lib/supabase';
import { Project } from '@docstruc/logic';
import { ProjectCreateModal } from '../../components/ProjectCreateModal';
import { ProjectEditModal } from '../../components/ProjectEditModal';
import { STATUS_OPTIONS } from '../../components/StatusSelect';
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

    const getStatusColor = (statusValue: string) => {
        const status = STATUS_OPTIONS.find(s => s.value === statusValue);
        return status || STATUS_OPTIONS[0];
    };

    return (
        <>
            <ProjectCreateModal 
                isOpen={isCreateOpen} 
                onClose={() => setIsCreateOpen(false)} 
                onProjectCreated={() => { fetchProjects(); showToast('Projekt erstellt!', 'success'); }}
                userId={userId || ''}
            />

            <ProjectEditModal 
                isOpen={!!editingProject}
                onClose={() => setEditingProject(null)}
                onProjectUpdated={() => { fetchProjects(); showToast('Projekt aktualisiert!', 'success'); }}
                project={editingProject}
            />

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <View style={styles.grid}>
                    {projects.map(p => {
                        const statusColor = getStatusColor(p.status);
                        return (
                        <View key={p.id} style={styles.row}>
                            <View style={styles.projectInfo}>
                                <Text style={styles.projectName}>{p.name}</Text>
                                <View style={styles.metaRow}>
                                    <MapPin size={14} color={colors.textSecondary} />
                                    <Text style={styles.projectMeta}>{p.address || 'Keine Adresse'}</Text>
                                    <View style={[styles.statusPill, { backgroundColor: statusColor.bgColor }]}>
                                        <Text style={[styles.statusPillText, { color: statusColor.color }]}>{statusColor.label}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.actionBtns}>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingProject(p)}>
                                    <Edit2 size={16} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn]} onPress={() => handleDelete(p.id)}>
                                    <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        );
                    })}
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
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    projectInfo: {
        flex: 1,
        gap: 6,
    },
    projectName: {
        fontSize: 16,
        fontWeight: '700',
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
        color: '#94a3b8',
        fontWeight: '400',
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        marginLeft: 8,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary,
        letterSpacing: 0.3,
    },
    actionBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '500',
    },
});
