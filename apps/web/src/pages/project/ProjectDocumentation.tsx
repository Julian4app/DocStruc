import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { ModernModal } from '../../components/ModernModal';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useContentVisibility } from '../../hooks/useContentVisibility';
import { DatePicker } from '../../components/DatePicker';
import { TaskDetailModal } from './TaskModals';
import { 
  FileText, Search, Filter, Download, Image as ImageIcon, Video, 
  Calendar, Clock, User, CheckSquare, AlertTriangle, ChevronDown, X 
} from 'lucide-react';

interface DocumentationEntry {
  id: string;
  task_id: string;
  task_title: string;
  task_type: 'task' | 'defect';
  content: string;
  documentation_type: 'text' | 'voice' | 'image' | 'video';
  created_at: string;
  user_name: string;
  storage_path?: string;
  file_name?: string;
  task_status?: string;
  task_assigned_to?: string;
  task_due_date?: string;
  task_priority?: string;
}

interface GroupedDocs {
  [date: string]: DocumentationEntry[];
}

export function ProjectDocumentation() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { defaultVisibility, filterVisibleItems } = useContentVisibility(id, 'documentation');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DocumentationEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DocumentationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [hasImageFilter, setHasImageFilter] = useState(false);
  const [hasVideoFilter, setHasVideoFilter] = useState(false);
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'task' | 'defect'>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskImages, setTaskImages] = useState<any[]>([]);
  const [taskDocumentation, setTaskDocumentation] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exportTimeframe, setExportTimeframe] = useState<'all' | 'custom'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) loadDocumentation();
  }, [id]);

  useEffect(() => {
    filterEntries();
  }, [entries, searchQuery, hasImageFilter, hasVideoFilter, taskTypeFilter]);

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskDetails(selectedTaskId);
    }
  }, [selectedTaskId]);

  const loadDocumentation = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Load all documentation entries for the project with task info and user info
      const { data, error } = await supabase
        .from('task_documentation')
        .select(`
          id,
          task_id,
          content,
          documentation_type,
          created_at,
          storage_path,
          file_name,
          user_id,
          tasks!inner(title, task_type, status, assigned_to, due_date, priority)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique user IDs to fetch user info
      const userIds = [...new Set((data || []).map((entry: any) => entry.user_id))];
      
      // Load user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (profilesError) console.error('Error loading profiles:', profilesError);

      // Create a map for quick profile lookup
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

      // Transform data
      const transformed: DocumentationEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        task_id: entry.task_id,
        task_title: entry.tasks.title,
        task_type: entry.tasks.task_type === 'defect' ? 'defect' : 'task',
        content: entry.content || '',
        documentation_type: entry.documentation_type,
        created_at: entry.created_at,
        user_name: profileMap.get(entry.user_id) || 'Unbekannt',
        storage_path: entry.storage_path,
        file_name: entry.file_name,
        task_status: entry.tasks.status,
        task_assigned_to: entry.tasks.assigned_to,
        task_due_date: entry.tasks.due_date,
        task_priority: entry.tasks.priority
      }));

      // Apply visibility filtering
      const visibleEntries = await filterVisibleItems(transformed);
      setEntries(visibleEntries);
    } catch (error: any) {
      console.error('Error loading documentation:', error);
      showToast('Fehler beim Laden der Dokumentation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskDetails = async (taskId: string) => {
    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      setSelectedTask(task);

      const { data: images } = await supabase
        .from('task_images')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      setTaskImages(images || []);

      const { data: docs } = await supabase
        .from('task_documentation')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      setTaskDocumentation(docs || []);

      const { data: members } = await supabase
        .from('project_members')
        .select('*, profiles(name)')
        .eq('project_id', id);
      setProjectMembers(members || []);
    } catch (error) {
      console.error('Error loading task details:', error);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.task_title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        entry.user_name.toLowerCase().includes(query)
      );
    }

    // Image filter
    if (hasImageFilter) {
      filtered = filtered.filter(entry => entry.documentation_type === 'image');
    }

    // Video filter
    if (hasVideoFilter) {
      filtered = filtered.filter(entry => entry.documentation_type === 'video');
    }

    // Task type filter
    if (taskTypeFilter !== 'all') {
      filtered = filtered.filter(entry => entry.task_type === taskTypeFilter);
    }

    setFilteredEntries(filtered);
  };

  const groupByDate = (docs: DocumentationEntry[]): GroupedDocs => {
    const grouped: GroupedDocs = {};
    docs.forEach(doc => {
      const date = new Date(doc.created_at).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(doc);
    });
    return grouped;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let docsToExport = entries;

      // Filter by custom timeframe if selected
      if (exportTimeframe === 'custom' && exportStartDate && exportEndDate) {
        const start = new Date(exportStartDate).getTime();
        const end = new Date(exportEndDate).getTime();
        docsToExport = entries.filter(entry => {
          const entryTime = new Date(entry.created_at).getTime();
          return entryTime >= start && entryTime <= end;
        });
      }

      if (docsToExport.length === 0) {
        showToast('Keine Dokumentation im ausgewählten Zeitraum', 'error');
        setExporting(false);
        return;
      }

      if (exportFormat === 'pdf') {
        await exportToPDF(docsToExport);
      } else {
        await exportToExcel(docsToExport);
      }

      showToast(`${docsToExport.length} Einträge exportiert`, 'success');
      setIsExportModalOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      showToast('Fehler beim Exportieren', 'error');
    } finally {
      setExporting(false);
    }
  };

  const stripHtmlTags = (html: string): string => {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    // Decode common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  };

  const exportToPDF = async (docs: DocumentationEntry[]) => {
    const grouped = groupByDate(docs);
    
    // Dynamically import jspdf
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const maxWidth = 170;
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Projekt-Dokumentation', margin, yPos);
    yPos += 10;
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Exportiert am ${new Date().toLocaleDateString('de-DE')}`, margin, yPos);
    yPos += 15;
    
    // Process each date section
    Object.keys(grouped).forEach((date, dateIndex) => {
      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
      
      // Date header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(date, margin, yPos);
      yPos += 3;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, 190, yPos);
      yPos += 10;
      
      // Entries
      grouped[date].forEach((entry, entryIndex) => {
        const estimatedHeight = 35 + (entry.content ? Math.ceil(entry.content.length / 80) * 5 : 0);
        
        if (yPos + estimatedHeight > pageHeight - margin) {
          doc.addPage();
          yPos = 20;
        }
        
        // Entry background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, yPos - 5, maxWidth, estimatedHeight, 3, 3, 'F');
        
        // Task title and type badge
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(entry.task_title, margin + 5, yPos);
        
        // Type badge
        const badgeX = 180;
        if (entry.task_type === 'defect') {
          doc.setFillColor(254, 226, 226);
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setFillColor(239, 246, 255);
          doc.setTextColor(59, 130, 246);
        }
        doc.roundedRect(badgeX - 25, yPos - 4, 25, 6, 2, 2, 'F');
        doc.setFontSize(8);
        doc.text(entry.task_type === 'defect' ? 'MANGEL' : 'AUFGABE', badgeX - 23, yPos);
        yPos += 8;
        
        // Meta info
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`⏰ ${formatTime(entry.created_at)}`, margin + 5, yPos);
        doc.text(`👤 ${entry.user_name}`, margin + 45, yPos);
        
        if (entry.documentation_type === 'image') {
          doc.setTextColor(22, 163, 74);
          doc.text('📸 Bild', margin + 100, yPos);
        } else if (entry.documentation_type === 'video') {
          doc.setTextColor(147, 51, 234);
          doc.text('🎥 Video', margin + 100, yPos);
        }
        yPos += 8;
        
        // Content
        if (entry.content) {
          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          const cleanContent = stripHtmlTags(entry.content);
          const lines = doc.splitTextToSize(cleanContent, maxWidth - 10);
          doc.text(lines, margin + 5, yPos);
          yPos += lines.length * 5;
        }
        
        yPos += 10;
      });
      
      yPos += 5;
    });
    
    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Seite ${i} von ${totalPages} • Gesamt: ${docs.length} Einträge`, margin, pageHeight - 10);
    }
    
    doc.save(`Dokumentation_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = async (docs: DocumentationEntry[]) => {
    // Create CSV content
    const headers = ['Datum', 'Uhrzeit', 'Aufgabe/Mangel', 'Typ', 'Autor', 'Inhalt', 'Medientyp', 'Dateiname'];
    const rows = docs.map(entry => [
      new Date(entry.created_at).toLocaleDateString('de-DE'),
      formatTime(entry.created_at),
      entry.task_title,
      entry.task_type === 'defect' ? 'Mangel' : 'Aufgabe',
      entry.user_name,
      entry.content || '-',
      entry.documentation_type === 'image' ? 'Bild' : entry.documentation_type === 'video' ? 'Video' : 'Text',
      entry.file_name || '-'
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    // Add BOM for proper Excel UTF-8 encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dokumentation_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setHasImageFilter(false);
    setHasVideoFilter(false);
    setTaskTypeFilter('all');
    setSearchQuery('');
  };

  const activeFilterCount = [hasImageFilter, hasVideoFilter, taskTypeFilter !== 'all'].filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const groupedDocs = groupByDate(filteredEntries);
  const dateKeys = Object.keys(groupedDocs);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Dokumentation</Text>
          <Text style={styles.pageSubtitle}>
            {entries.length} Einträge · Chronologische Timeline aller Dokumentationen
          </Text>
        </View>
        <Button onClick={() => setIsExportModalOpen(true)}>
          <Download size={18} /> Export
        </Button>
      </View>

      {/* Search & Filters */}
      <Card style={styles.filterCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Dokumentation durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 14,
                backgroundColor: 'transparent',
                color: '#0f172a'
              }}
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                backgroundColor: activeFilterCount > 0 ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: activeFilterCount > 0 ? colors.primary : '#64748b'
              }}
            >
              <Filter size={16} />
              Filter
              {activeFilterCount > 0 && (
                <span style={{
                  backgroundColor: colors.primary,
                  color: '#fff',
                  borderRadius: 10,
                  padding: '2px 6px',
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={14} />
            </button>
            
            {showFilterMenu && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999998 }}
                  onClick={() => setShowFilterMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  zIndex: 999999,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  padding: 16,
                  minWidth: 240
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                    Filter
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, marginTop: 8 }}>
                    Aufgaben/Mängel
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={taskTypeFilter === 'all'}
                      onChange={() => setTaskTypeFilter('all')}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14, color: '#334155' }}>Alle</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={taskTypeFilter === 'task'}
                      onChange={() => setTaskTypeFilter('task')}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <CheckSquare size={16} color="#3B82F6" />
                    <span style={{ fontSize: 14, color: '#334155' }}>Nur Aufgaben</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={taskTypeFilter === 'defect'}
                      onChange={() => setTaskTypeFilter('defect')}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <AlertTriangle size={16} color="#DC2626" />
                    <span style={{ fontSize: 14, color: '#334155' }}>Nur Mängel</span>
                  </label>
                  <div style={{ height: 1, backgroundColor: '#e2e8f0', margin: '12px 0' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                    Medientyp
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasImageFilter}
                      onChange={(e) => setHasImageFilter(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <ImageIcon size={16} color="#10B981" />
                    <span style={{ fontSize: 14, color: '#334155' }}>Mit Bildern</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasVideoFilter}
                      onChange={(e) => setHasVideoFilter(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <Video size={16} color="#8B5CF6" />
                    <span style={{ fontSize: 14, color: '#334155' }}>Mit Videos</span>
                  </label>
                  {activeFilterCount > 0 && (
                    <>
                      <div style={{ height: 1, backgroundColor: '#e2e8f0', margin: '12px 0' }} />
                      <button
                        onClick={() => { clearFilters(); setShowFilterMenu(false); }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: 6,
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Filter zurücksetzen
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </View>
      </Card>

      {/* Timeline */}
      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        {dateKeys.length === 0 ? (
          <Card style={styles.emptyCard}>
            <FileText size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>
              {searchQuery || activeFilterCount > 0
                ? 'Keine Einträge gefunden'
                : 'Noch keine Dokumentation vorhanden'}
            </Text>
            {(searchQuery || activeFilterCount > 0) && (
              <Button variant="outline" onClick={clearFilters} style={{ marginTop: 16 }}>
                Filter zurücksetzen
              </Button>
            )}
          </Card>
        ) : (
          dateKeys.map(date => (
            <View key={date} style={styles.dateSection}>
              <View style={styles.dateSectionHeader}>
                <Calendar size={18} color={colors.primary} />
                <Text style={styles.dateTitle}>{date}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{groupedDocs[date].length}</Text>
                </View>
              </View>
              
              {groupedDocs[date].map((entry, index) => (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => setSelectedTaskId(entry.task_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Card style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryTitleRow}>
                      <View style={[
                        styles.typeBadge,
                        { backgroundColor: entry.task_type === 'defect' ? '#FEE2E2' : '#EFF6FF' }
                      ]}>
                        {entry.task_type === 'defect' ? (
                          <AlertTriangle size={12} color="#DC2626" />
                        ) : (
                          <CheckSquare size={12} color="#3B82F6" />
                        )}
                        <Text style={[
                          styles.typeBadgeText,
                          { color: entry.task_type === 'defect' ? '#DC2626' : '#3B82F6' }
                        ]}>
                          {entry.task_type === 'defect' ? 'Mangel' : 'Aufgabe'}
                        </Text>
                      </View>
                      <Text style={styles.entryTitle}>{entry.task_title}</Text>
                    </View>
                    
                    <View style={styles.entryMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>{formatTime(entry.created_at)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <User size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>{entry.user_name}</Text>
                      </View>
                      {entry.documentation_type === 'image' && (
                        <View style={[styles.mediaBadge, { backgroundColor: '#DCFCE7' }]}>
                          <ImageIcon size={12} color="#16A34A" />
                          <Text style={[styles.mediaBadgeText, { color: '#16A34A' }]}>Bild</Text>
                        </View>
                      )}
                      {entry.documentation_type === 'video' && (
                        <View style={[styles.mediaBadge, { backgroundColor: '#F3E8FF' }]}>
                          <Video size={12} color="#9333EA" />
                          <Text style={[styles.mediaBadgeText, { color: '#9333EA' }]}>Video</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {entry.content && (
                    <Text style={styles.entryContent}>{entry.content}</Text>
                  )}
                  
                  {entry.file_name && (
                    <View style={styles.fileInfo}>
                      <FileText size={14} color="#64748b" />
                      <Text style={styles.fileName}>{entry.file_name}</Text>
                    </View>
                  )}
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Export Modal */}
      <ModernModal
        visible={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Dokumentation exportieren"
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalLabel}>Format</Text>
          <View style={styles.formatOptions}>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'pdf' && styles.formatOptionActive]}
              onPress={() => setExportFormat('pdf')}
            >
              <FileText size={20} color={exportFormat === 'pdf' ? colors.primary : '#64748b'} />
              <Text style={[
                styles.formatOptionText,
                exportFormat === 'pdf' && styles.formatOptionTextActive
              ]}>
                PDF / HTML
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatOption, exportFormat === 'excel' && styles.formatOptionActive]}
              onPress={() => setExportFormat('excel')}
            >
              <FileText size={20} color={exportFormat === 'excel' ? colors.primary : '#64748b'} />
              <Text style={[
                styles.formatOptionText,
                exportFormat === 'excel' && styles.formatOptionTextActive
              ]}>
                Excel / CSV
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Zeitraum</Text>
          <View style={styles.timeframeOptions}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={exportTimeframe === 'all'}
                onChange={() => setExportTimeframe('all')}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>
                Gesamtes Projekt ({entries.length} Einträge)
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={exportTimeframe === 'custom'}
                onChange={() => setExportTimeframe('custom')}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>Benutzerdefinierter Zeitraum</span>
            </label>
          </View>

          {exportTimeframe === 'custom' && (
            <View style={styles.dateRange}>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="Von"
                  value={exportStartDate}
                  onChange={setExportStartDate}
                  placeholder="TT.MM.JJJJ"
                />
              </View>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="Bis"
                  value={exportEndDate}
                  onChange={setExportEndDate}
                  placeholder="TT.MM.JJJJ"
                />
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)} style={{ flex: 1 }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleExport} 
              style={{ flex: 1 }}
              disabled={exporting || (exportTimeframe === 'custom' && (!exportStartDate || !exportEndDate))}
            >
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Download size={16} /> Exportieren</>}
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          visible={!!selectedTaskId}
          task={selectedTask}
          taskImages={taskImages}
          taskDocumentation={taskDocumentation}
          projectMembers={projectMembers}
          isEditMode={false}
          editFormData={{}}
          docFormData={{}}
          isRecording={false}
          canEditPerm={false}
          canDeletePerm={false}
          onChangeEditFormData={() => {}}
          onToggleEditMode={() => {}}
          onSaveEdit={() => {}}
          onDelete={() => {}}
          onStatusChange={() => {}}
          onImageUpload={() => {}}
          onChangeDocFormData={() => {}}
          onSaveDocumentation={() => {}}
          onCancelDocumentation={() => {}}
          onStartRecording={() => {}}
          onClose={() => {
            setSelectedTaskId(null);
            setSelectedTask(null);
          }}
          getUserName={(userId: string) => {
            const member = projectMembers.find(m => m.user_id === userId);
            return member?.profiles?.name || 'Unbekannt';
          }}
        />
      )}
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  filterCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeline: {
    flex: 1,
  },
  dateSection: {
    marginBottom: 32,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  dateBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  entryCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  entryHeader: {
    gap: 10,
  },
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  entryTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  entryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  mediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mediaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    marginTop: 12,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fileName: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  emptyCard: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalBody: {
    gap: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  formatOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  formatOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  formatOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  formatOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  formatOptionTextActive: {
    color: colors.primary,
  },
  timeframeOptions: {
    gap: 4,
  },
  dateRange: {
    flexDirection: 'row',
    gap: 12,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
