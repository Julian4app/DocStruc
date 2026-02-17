import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';
import { Tag, Plus, Trash2, BarChart2, Hash, Layers } from 'lucide-react';

export default function Tags() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch defined tags
      const { data: tagData, error: tagError } = await supabase
        .from('tags')
        .select('id, title, color, description, created_at')
        .order('title');
      
      if (tagError) throw tagError;

      // 2. Fetch usages to count
      const { data: invData } = await supabase.from('invoices').select('tags');
      const { data: fileData } = await supabase.from('company_files').select('tags');

      // Calculate usage
      const counts: Record<string, number> = {};
      
      const processTags = (rows: any[] | null) => {
          if (!rows) return;
          rows.forEach(row => {
              if (Array.isArray(row.tags)) {
                  row.tags.forEach((t: string) => {
                      counts[t] = (counts[t] || 0) + 1;
                  });
              }
          });
      };

      processTags(invData);
      processTags(fileData);

      setUsageMap(counts);
      setTags(tagData || []);

    } catch (e) {
      console.error(e);
      // alert('Error loading tags');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete tag '${title}'? This will NOT remove it from existing records.`)) return;
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      setTags(tags.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error deleting tag');
    }
  };

  if (loading) return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0f172a" />
      </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
             <Text style={styles.title}>System Tags</Text>
             <Text style={styles.subtitle}>Define and manage tags for categorizing content.</Text>
        </View>
        <Button onClick={() => navigate('/tags/new')} variant="primary" style={styles.createButton}>
             <Plus size={18} color="white" />
             <Text style={{ color: 'white', fontWeight: '600' }}>Create Tag</Text>
        </Button>
      </View>

      {/* Stats Bar (Optional, inferred from content logic) */}
      <View style={styles.statsBar}>
          <View style={styles.statItem}>
              <Layers size={20} color="#3b82f6" />
              <View>
                  <Text style={styles.statValue}>{tags.length}</Text>
                  <Text style={styles.statLabel}>Total Tags</Text>
              </View>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.statItem}>
              <Hash size={20} color="#10b981" />
              <View>
                  <Text style={styles.statValue}>{Object.values(usageMap).reduce((a, b) => a + b, 0)}</Text>
                  <Text style={styles.statLabel}>Total Assignments</Text>
              </View>
          </View>
      </View>

      {/* Main Content */}
      <View style={styles.card}>
          <View style={styles.tableHeader}>
              <Text style={[styles.colHead, { flex: 2 }]}>Tag Name</Text>
              <Text style={[styles.colHead, { flex: 3 }]}>Description</Text>
              <Text style={[styles.colHead, { flex: 1 }]}>Usage</Text>
              <Text style={[styles.colHead, { width: 40 }]}></Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {tags.length === 0 && (
                  <View style={styles.emptyState}>
                      <Tag size={40} color="#cbd5e1" />
                      <Text style={styles.emptyText}>No tags defined yet.</Text>
                  </View>
              )}
              {tags.map(t => (
                  <TouchableOpacity 
                     key={t.id} 
                     style={styles.row}
                     onPress={() => navigate(`/tags/${t.id}`)}
                  >
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={[styles.colorDot, { backgroundColor: t.color || '#94a3b8' }]} />
                          <View style={[styles.tagBadge, { backgroundColor: (t.color || '#94a3b8') + '20' }]}>
                              <Text style={[styles.tagText, { color: t.color || '#475569' }]}>{t.title}</Text>
                          </View>
                      </View>
                      <Text style={[styles.cell, { flex: 3, color: '#64748b' }]} numberOfLines={1}>{t.description || '—'}</Text>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BarChart2 size={14} color="#94a3b8" />
                          <Text style={[styles.cell, { fontWeight: '600' }]}>{usageMap[t.title] || 0}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}
                        style={styles.deleteBtn}
                      >
                         <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    gap: 24,
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b'
  },
  createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20
  },
  
  // Stats
  statsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#64748b',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      alignSelf: 'flex-start',
      gap: 24
  },
  statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
  },
  statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#0f172a',
      lineHeight: 22
  },
  statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b'
  },
  dividerVertical: {
      width: 1,
      height: 32,
      backgroundColor: '#f1f5f9'
  },

  // Table / List
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    flex: 1
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center'
  },
  colHead: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  row: {
      flexDirection: 'row',
      padding: 16, // increased padding
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      alignItems: 'center',
      height: 64 // fixed height for consistency
  },
  cell: {
      fontSize: 14,
      color: '#334155'
  },
  
  // Tag Styles
  colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5
  },
  tagBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6
  },
  tagText: {
      fontSize: 13,
      fontWeight: '600'
  },
  
  deleteBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: '#fef2f2',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12
  },
  emptyText: {
      fontSize: 14,
      color: '#94a3b8'
  }
});
