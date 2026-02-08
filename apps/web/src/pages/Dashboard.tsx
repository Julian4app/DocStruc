import React, { useEffect, useState, useCallback } from 'react';
import { ProjectCard, Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Project } from '@docstruc/logic';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import { useLayout } from '../layouts/LayoutContext';
import { useToast } from '../components/ToastProvider';
import { Folder, Plus } from 'lucide-react';
import { colors } from '@docstruc/theme';

export function Dashboard() {
  const navigate = useNavigate();
  const { setTitle, setSubtitle, setActions } = useLayout();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  useEffect(() => {
    setTitle('Meine Projekte');
    setSubtitle('Ihre zugewiesenen Projekte und Dokumente.');
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchProjects();
          checkSuperuser(session.user.id);
      }
    });
  }, [setTitle]);

  const handleCreateClick = useCallback(() => {
      if (!session?.user) {
          showToast('Keine Benutzersitzung gefunden.', 'error');
          return;
      }
      setIsCreateModalOpen(true);
  }, [session, showToast]);

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
    return () => setActions(null);
  }, [isSuperuser, setActions, handleCreateClick]);

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
          showToast('Datenbankfehler: Bitte FIX_DATABASE.sql im Supabase SQL Editor ausführen.', 'error');
      }
    } else {
      setProjects(data || []);
    }
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
                <View style={styles.emptyIconContainer}>
                    <Folder size={32} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>Keine Projekte gefunden</Text>
                {isSuperuser ? (
                    <>
                        <Text style={styles.emptySubText}>Starten Sie Ihr erstes Projekt, indem Sie oben rechts klicken.</Text>
                        <Button onClick={handleCreateClick} style={{ marginTop: 24 }}>
                            Erstes Projekt erstellen
                        </Button>
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  }
});
