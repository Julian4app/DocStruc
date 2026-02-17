import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Button, ProjectCard, ScreenLayout, LoginForm } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Project } from '@docstruc/logic';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetchProjects();
    // Subscribe to changes if needed, or refresh on focus
    const unsubscribe = navigation.addListener('focus', fetchProjects);
    return unsubscribe;
  }, [navigation]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    else setProjects(data || []);
  };

  const createProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const newProject = {
      owner_id: user.id,
      name: 'Mobile Project ' + new Date().toLocaleTimeString(),
      status: 'planning',
      address: 'On the Go Street 5'
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (!error && data) {
      setProjects([data, ...projects]);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCard 
            project={item} 
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })} 
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Keine Projekte vorhanden</Text>
            <Button onClick={createProject}>Projekt erstellen</Button>
          </View>
        }
      />
      <View style={styles.fabContainer}>
         <Button onClick={createProject}>+ New</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.m,
    paddingBottom: 100, // Space for FAB/Footer
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.m
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  }
});
