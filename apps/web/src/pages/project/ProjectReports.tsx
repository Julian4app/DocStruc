import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { FileText, Download, BarChart3, TrendingUp, FileSpreadsheet, Mail, Calendar } from 'lucide-react';

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: any;
  format: 'pdf' | 'excel' | 'csv';
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  totalDefects: number;
  teamMembers: number;
}

export function ProjectReports() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats>({ totalTasks: 0, completedTasks: 0, totalDefects: 0, teamMembers: 0 });

  const reportTemplates: ReportTemplate[] = [
    { id: 'status', title: 'Projektstatus-Report', description: 'Gesamtübersicht über den Projektstatus', icon: BarChart3, format: 'pdf' },
    { id: 'tasks', title: 'Aufgaben-Report', description: 'Detaillierte Liste aller Aufgaben', icon: FileText, format: 'excel' },
    { id: 'defects', title: 'Mängel-Report', description: 'Übersicht aller Mängel', icon: FileText, format: 'pdf' },
    { id: 'time', title: 'Zeitauswertung', description: 'Erfasste Arbeitszeiten', icon: TrendingUp, format: 'excel' },
    { id: 'diary', title: 'Bautagebuch-Export', description: 'Komplettes Bautagebuch', icon: Calendar, format: 'pdf' },
    { id: 'documentation', title: 'Projekt-Dokumentation', description: 'Alle Notizen und Dokumente', icon: FileText, format: 'pdf' },
    { id: 'participants', title: 'Teilnehmer-Liste', description: 'Alle Projektbeteiligten', icon: FileSpreadsheet, format: 'excel' },
    { id: 'timeline', title: 'Zeitplan & Meilensteine', description: 'Terminübersicht', icon: Calendar, format: 'pdf' }
  ];

  useEffect(() => {
    if (id) loadStats();
  }, [id]);

  const loadStats = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: tasksData } = await supabase.from('tasks').select('id, status, task_type').eq('project_id', id);
      const { data: membersData } = await supabase.from('project_members').select('id').eq('project_id', id);
      setStats({
        totalTasks: tasksData?.length || 0,
        completedTasks: tasksData?.filter(t => t.status === 'done').length || 0,
        totalDefects: tasksData?.filter(t => t.task_type === 'defect').length || 0,
        teamMembers: membersData?.length || 0
      });
    } catch (error: any) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (reportId: string) => {
    showToast(`Report "${reportTemplates.find(r => r.id === reportId)?.title}" wird generiert...`, 'info');
  };

  const handleScheduleReport = () => {
    showToast('Automatische Report-Versendung folgt', 'info');
  };

  const getFormatBadgeColor = (format: string) => {
    switch (format) {
      case 'pdf': return '#DC2626';
      case 'excel': return '#10B981';
      case 'csv': return '#3B82F6';
      default: return '#64748b';
    }
  };

  if (loading) {
    return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Berichte & Exporte</Text>
          <Text style={styles.pageSubtitle}>Reports, Auswertungen und Daten-Export</Text>
        </View>
        <Button onClick={handleScheduleReport}><Mail size={18} /> Automatisierung</Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Projekt-Kennzahlen</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Aufgaben</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedTasks}</Text>
              <Text style={styles.statLabel}>Erledigt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalDefects}</Text>
              <Text style={styles.statLabel}>Mängel</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.teamMembers}</Text>
              <Text style={styles.statLabel}>Team</Text>
            </View>
          </View>
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Projektfortschritt</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.progressText}>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</Text>
          </View>
        </Card>

        <View style={styles.reportsSection}>
          <Text style={styles.sectionTitle}>Verfügbare Reports</Text>
          <View style={styles.reportGrid}>
            {reportTemplates.map(report => {
              const IconComponent = report.icon;
              return (
                <Card key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportIconContainer}><IconComponent size={24} color={colors.primary} /></View>
                    <View style={[styles.formatBadge, { backgroundColor: getFormatBadgeColor(report.format) }]}>
                      <Text style={styles.formatBadgeText}>{report.format.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                  <TouchableOpacity style={styles.generateButton} onPress={() => handleGenerateReport(report.id)}>
                    <Download size={16} color="#ffffff" />
                    <Text style={styles.generateButtonText}>Generieren</Text>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b' },
  content: { flex: 1 },
  statsCard: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  statsTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statItem: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  progressSection: { gap: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  progressBar: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressText: { fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'right' },
  reportsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  reportCard: { width: '48%', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  reportIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  formatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  formatBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  reportTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  reportDescription: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 10 },
  generateButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' }
});

