import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MainLayout } from '../../components/MainLayout';
import { ProjectCard, Button, CustomModal as Modal, Input } from '@docstruc/ui';
import { supabase } from '../../lib/supabase';
import { Project } from '@docstruc/logic';
import { ProjectCreateModal } from '../../components/ProjectCreateModal';

export function ManageProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Edit Mode
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    
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
        if (!confirm('Are you sure you want to delete this project?')) return;
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) alert('Error deleting project: ' + error.message);
        else fetchProjects();
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
        if (error) alert('Error updating: ' + error.message);
        else {
            setEditingProject(null);
            fetchProjects();
        }
    };

    return (
        <MainLayout title="Manage Projects">
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Button onClick={() => setIsCreateOpen(true)}>+ New Project</Button>
            </View>

            <ProjectCreateModal 
                isOpen={isCreateOpen} 
                onClose={() => setIsCreateOpen(false)} 
                onProjectCreated={fetchProjects}
                userId={userId || ''}
            />

            <Modal visible={!!editingProject} onClose={() => setEditingProject(null)} title="Edit Project">
                 <View style={{ gap: 12 }}>
                     <Input label="Name" value={editForm.name} onChangeText={t => setEditForm({...editForm, name: t})} />
                     <Input label="Address" value={editForm.address} onChangeText={t => setEditForm({...editForm, address: t})} />
                     <Input label="Status" value={editForm.status} onChangeText={t => setEditForm({...editForm, status: t})} />
                     <Button onClick={saveEdit}>Save Changes</Button>
                 </View>
            </Modal>

            <View style={styles.grid}>
                {projects.map(p => (
                    <View key={p.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.projectName}>{p.name}</Text>
                            <Text style={styles.projectMeta}>{p.address} • {p.status}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Button size="small" variant="secondary" onClick={() => handleEdit(p)}>Edit</Button>
                            <Button size="small" variant="outline" onClick={() => handleDelete(p.id)} style={{ borderColor: 'red' }} textStyle={{ color: 'red' }}>Delete</Button>
                        </View>
                    </View>
                ))}
            </View>
        </MainLayout>
    );
}

const styles = StyleSheet.create({
    grid: {
        gap: 12
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    projectName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4
    },
    projectMeta: {
        fontSize: 14,
        color: '#64748b'
    }
});
