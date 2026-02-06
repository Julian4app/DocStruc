import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';

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
        .select('*')
        .order('title');
      
      if (tagError) throw tagError;

      // 2. Fetch usages to count
      // We look in 'invoices' and 'company_files'.
      // Note: This fetches all tags from all rows. For large DBs, use RPC or specific count queries.
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
      alert('Error loading tags');
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

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={{ color: '#6B7280' }}>Manage system-wide tags.</Text>
        <Button onClick={() => navigate('/tags/new')} variant="primary">Create Tag</Button>
      </View>

      <View style={styles.list}>
          <View style={styles.rowHeader}>
              <Text style={[styles.col, { flex: 2 }]}>Title</Text>
              <Text style={[styles.col, { flex: 3 }]}>Description</Text>
              <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>Usage</Text>
              <Text style={[styles.col, { flex: 1, textAlign: 'right' }]}>Actions</Text>
          </View>
          <ScrollView>
              {tags.length === 0 && <Text style={{ padding: 20 }}>No tags defined.</Text>}
              {tags.map(t => (
                  <TouchableOpacity 
                     key={t.id} 
                     style={styles.row}
                     onPress={() => navigate(`/tags/${t.id}`)}
                  >
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.tagBadge, { backgroundColor: t.color || '#E5E7EB' }]}>
                              <Text style={[styles.tagText, { color: t.color ? '#fff' : '#374151' }]}>{t.title}</Text>
                          </View>
                      </View>
                      <Text style={[styles.cell, { flex: 3 }]} numberOfLines={1}>{t.description || '-'}</Text>
                      <Text style={[styles.cell, { flex: 1, textAlign: 'center', fontWeight: 'bold' }]}>
                          {usageMap[t.title] || 0}
                      </Text>
                      <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}>
                             <Text style={{ color: '#EF4444' }}>Delete</Text>
                          </TouchableOpacity>
                      </View>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  list: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    flex: 1
  },
  rowHeader: {
      flexDirection: 'row',
      padding: 16,
      backgroundColor: '#F9FAFB',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB'
  },
  row: {
      flexDirection: 'row',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      alignItems: 'center'
  },
  col: {
      fontWeight: '600',
      color: '#374151',
      fontSize: 14
  },
  cell: {
      fontSize: 14,
      color: '#1F2937'
  },
  tagBadge: {
      backgroundColor: '#E5E7EB',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12
  },
  tagText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#374151'
  }
});
