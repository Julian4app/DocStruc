import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Card } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    criticalTasks: 0,
    openDefects: 0,
    upcomingDeadlines: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, [id]);

  const loadDashboardData = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      // Load tasks statistics
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('project_id', id);

      if (tasks) {
        setStats({
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'done').length,
          activeTasks: tasks.filter(t => t.status === 'in_progress').length,
          criticalTasks: tasks.filter(t => t.status === 'blocked').length,
          openDefects: 0, // TODO: Load from defects table
          upcomingDeadlines: 0 // TODO: Calculate upcoming deadlines
        });
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const progress = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Projekt Dashboard</Text>
      <Text style={styles.pageSubtitle}>Zentrale Projektsteuerung und Statusübersicht</Text>

      {/* Progress Overview */}
      <Card style={styles.progressCard}>
        <Text style={styles.cardTitle}>Gesamtfortschritt</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}% abgeschlossen</Text>
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
            <CheckCircle size={24} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{stats.completedTasks}</Text>
          <Text style={styles.statLabel}>Abgeschlossen</Text>
        </Card>

        <Card style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Clock size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{stats.activeTasks}</Text>
          <Text style={styles.statLabel}>Aktive Aufgaben</Text>
        </Card>

        <Card style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>{stats.criticalTasks}</Text>
          <Text style={styles.statLabel}>Kritische Tasks</Text>
        </Card>

        <Card style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#F3E8FF' }]}>
            <TrendingUp size={24} color="#A855F7" />
          </View>
          <Text style={styles.statValue}>{stats.totalTasks}</Text>
          <Text style={styles.statLabel}>Gesamt</Text>
        </Card>
      </View>

      {/* Active Tasks Section */}
      <Card style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Aktive Aufgaben</Text>
        {stats.activeTasks === 0 ? (
          <Text style={styles.emptyText}>Keine aktiven Aufgaben</Text>
        ) : (
          <Text style={styles.infoText}>
            {stats.activeTasks} Aufgabe{stats.activeTasks !== 1 ? 'n' : ''} in Bearbeitung
          </Text>
        )}
      </Card>

      {/* Critical Tasks Section */}
      {stats.criticalTasks > 0 && (
        <Card style={[styles.sectionCard, styles.criticalCard]}>
          <Text style={styles.cardTitle}>⚠️ Kritische Aufgaben</Text>
          <Text style={styles.criticalText}>
            {stats.criticalTasks} blockierte Aufgabe{stats.criticalTasks !== 1 ? 'n' : ''} benötigt Aufmerksamkeit
          </Text>
        </Card>
      )}

      {/* Open Defects Section */}
      <Card style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Offene Mängel</Text>
        <Text style={styles.infoText}>
          {stats.openDefects} offene Mängel
        </Text>
      </Card>

      {/* Upcoming Deadlines */}
      <Card style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Anstehende Termine</Text>
        <Text style={styles.infoText}>
          Keine anstehenden Termine in den nächsten 7 Tagen
        </Text>
      </Card>

      {/* Recent Activity */}
      <Card style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Letzte Aktivitäten</Text>
        <Text style={styles.emptyText}>Keine aktuellen Aktivitäten</Text>
      </Card>
    </ScrollView>
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
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  progressCard: {
    padding: 24,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  sectionCard: {
    padding: 24,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  criticalCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
  },
  infoText: {
    color: '#475569',
    fontSize: 14,
  },
  criticalText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});
