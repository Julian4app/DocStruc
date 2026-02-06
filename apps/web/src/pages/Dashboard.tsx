import React, { useEffect, useState } from 'react';
import { ProjectCard, Button } from '@docstruc/ui';
import { MainLayout } from '../components/MainLayout';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Project } from '@docstruc/logic';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProjects();
    });
  }, []);

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

  const createProject = async () => {
    console.log("Create Project clicked");
    if (!session?.user) {
        alert("No user session found!");
        return;
    }
    
    const newProject = {
      owner_id: session.user.id,
      name: 'Neues Projekt ' + new Date().toLocaleTimeString(),
      status: 'planning',
      address: 'Musterstraße 1, 1010 Wien'
    };

    console.log("Inserting project...", newProject);
    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (error) {
       console.error("Supabase Error:", error);
       if (error.code === '42501') {
           alert("Ressource Violated: This is likely due to the RLS policy issue. Please run 'FIX_DATABASE.sql' in Supabase SQL Editor.");
       } else if (error.code === '23503') { 
           alert("Profile Missing: Your user profile is missing in the database. Please run 'FIX_DATABASE.sql' again to fix this.");
       } else {
           alert('Error (' + error.code + '): ' + error.message + '\nCheck console for details.');
       }
    } else {
      console.log("Project created:", data);
      setProjects([data, ...projects]);
    }
  };

  if (!session) return null;

  return (
    <MainLayout 
        title="Meine Projekte"
        actions={
            <Button onClick={createProject} size="large">
                + Neues Projekt anlegen
            </Button>
        }
    >
        {projects.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Keine Projekte gefunden</Text>
                <Text style={styles.emptySubText}>Starten Sie Ihr erstes Projekt, indem Sie oben rechts klicken.</Text>
                <Button onClick={createProject} variant="outline" style={{ marginTop: 20 }}>Erstes Projekt erstellen</Button>
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
    </MainLayout>
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
