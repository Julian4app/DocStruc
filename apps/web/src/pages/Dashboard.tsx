import React, { useEffect, useState } from 'react';
import { ProjectCard, Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Project } from '@docstruc/logic';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import { useLayout } from '../layouts/LayoutContext';

export function Dashboard() {
  const navigate = useNavigate();
  const { setTitle, setActions } = useLayout();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  useEffect(() => {
    setTitle('Meine Projekte');
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchProjects();
          checkSuperuser(session.user.id);
      }
    });
  }, [setTitle]);

  useEffect(() => {
    if (isSuperuser) {
        setActions(
          <Button onClick={handleCreateClick} size="large">
              + Neues Projekt anlegen
          </Button>
        );
    } else {
        setActions(null);
    }
  }, [isSuperuser, setActions]);

  const checkSuperuser = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('is_superuser').eq('id', userId).single();
      setIsSuperuser(!!data?.is_superuser);
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects:', error);
      if (error.code === '42P17' || error.message.includes('infinite recursion')) {
          alert("DATABASE ERROR: Infinite recursion detected in policies.\n\nPlease run the 'FIX_DATABASE.sql' script in your Supabase SQL Editor to fix this.");
      }
    } else {
      setProjects(data || []);
    }
  };

  const handleCreateClick = () => {
      if (!session?.user) {
          alert("No user session found!");
          return;
      }
      setIsCreateModalOpen(true);
  };

  if (!session) return null;

  return (
    <>
        <ProjectCreateModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)} 
            onProjectCreated={fetchProjects}
            userId={session.user.id}
        />

        {projects.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Keine Projekte gefunden</Text>
                {isSuperuser ? (
                    <>
                        <Text style={styles.emptySubText}>Starten Sie Ihr erstes Projekt, indem Sie oben rechts klicken.</Text>
                        <Button onClick={handleCreateClick} variant="outline" style={{ marginTop: 20 }}>Erstes Projekt erstellen</Button>
                    </>
                ) : (
                    <Text style={styles.emptySubText}>Sie wurden noch keinem Projekt hinzugefügt.</Text>
                )}
            </View>
        ) : (

            <View style={styles.grid}>
                {projects.map((project) => (
                <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onPress={() => navigate(`/project/${project.id}`)}
                />
                ))}
            </View>
        )}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16,
    color: '#6B7280',
  }
});
