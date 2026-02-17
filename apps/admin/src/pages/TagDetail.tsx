import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';

export default function TagDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    color: '#6B7280'
  });

  // Usage Data
  const [invoiceUsages, setInvoiceUsages] = useState<any[]>([]);
  const [fileUsages, setFileUsages] = useState<any[]>([]);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchTag();
    }
  }, [id]);

  const fetchTag = async () => {
    try {
      const { data, error } = await supabase.from('tags').select('id, title, color, description, created_at').eq('id', id).single();
      if (error) throw error;
      setForm(data);
      if (data.title) {
          fetchUsages(data.title);
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching tag');
      navigate('/tags');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsages = async (title: string) => {
      // 1. Invoices
      const { data: inv } = await supabase
        .from('invoices')
        .select(`
            id, 
            status, 
            amount, 
            created_at,
            tags,
            companies ( id, name )
        `)
        .contains('tags', [title]); // Postgres array contains
      
      setInvoiceUsages(inv || []);

      // 2. Files
      const { data: files } = await supabase
        .from('company_files')
        .select(`
            id,
            file_name,
            file_url,
            created_at: uploaded_at,
            tags,
            companies ( id, name )
        `)
        .contains('tags', [title]);

      setFileUsages(files || []);
  };

  const handleSave = async () => {
    if (!form.title) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title,
        description: form.description,
        color: form.color
      };

      if (id === 'new') {
        const { error } = await supabase.from('tags').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tags').update(payload).eq('id', id);
        if (error) throw error;
      }
      
      alert('Tag saved successfully');
      navigate('/tags');
    } catch (e) {
      console.error(e);
      alert('Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  const totalUsage = invoiceUsages.length + fileUsages.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Button onClick={() => navigate('/tags')} variant="secondary">Back</Button>
         <Text style={styles.title}>{id === 'new' ? 'New Tag' : 'Edit Tag'}</Text>
      </View>

      <View style={styles.contentRow}>
          {/* LEFT: EDIT FORM */}
          <View style={styles.card}>
             <View style={styles.formGrid}>
                 <View style={styles.field}>
                     <Text style={styles.label}>Tag Title *</Text>
                     <Input 
                        value={form.title} 
                        onChangeText={(t) => setForm({...form, title: t})} 
                        placeholder="e.g. Urgent" 
                     />
                 </View>

                 <View style={styles.field}>
                     <Text style={styles.label}>Tag Color</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <input 
                            type="color" 
                            value={form.color} 
                            onChange={(e) => setForm({...form, color: e.target.value})}
                            style={{ width: 40, height: 40, border: 'none', background: 'none' }}
                        />
                        <Input 
                            value={form.color} 
                            onChangeText={(t) => setForm({...form, color: t})} 
                            placeholder="#6B7280"
                            style={{ width: 100 }}
                        />
                     </View>
                 </View>

                 <View style={styles.field}>
                     <Text style={styles.label}>Description</Text>
                     <Input 
                        value={form.description || ''} 
                        onChangeText={(t) => setForm({...form, description: t})} 
                        placeholder="Description..." 
                        multiline
                        style={{ height: 80 }}
                     />
                 </View>

                 <View style={{ marginTop: 20 }}>
                     <Button onClick={handleSave} variant="primary" disabled={saving}>
                         {saving ? 'Saving...' : 'Save Tag'}
                     </Button>
                 </View>
             </View>
          </View>

          {/* RIGHT: USAGE STATS (Only in Edit Mode) */}
          {id !== 'new' && (
              <ScrollView style={styles.usageColumn}>
                  <View style={styles.statsHeader}>
                      <Text style={styles.statsTitle}>Usage Statistics</Text>
                      <View style={styles.badge}>
                          <Text style={styles.badgeText}>{totalUsage} Total Uses</Text>
                      </View>
                  </View>

                  {/* INVOICES SECTION */}
                  <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Invoices ({invoiceUsages.length})</Text>
                      {invoiceUsages.length === 0 && <Text style={styles.emptyText}>Not used in invoices.</Text>}
                      {invoiceUsages.map(inv => (
                          <TouchableOpacity 
                            key={inv.id} 
                            style={styles.usageItem}
                            onPress={() => navigate(`/customers/${inv.companies?.id}`)}
                          >
                              <View>
                                  <Text style={styles.usageMain}>{inv.companies?.name || 'Unknown Company'}</Text>
                                  <Text style={styles.usageSub}>Invoice #${inv.id.slice(0,6)} • ${inv.amount}</Text>
                              </View>
                              <Text style={styles.usageDate}>{new Date(inv.created_at).toLocaleDateString()}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>

                  {/* FILES SECTION */}
                  <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Files ({fileUsages.length})</Text>
                      {fileUsages.length === 0 && <Text style={styles.emptyText}>Not used in files.</Text>}
                      {fileUsages.map(f => (
                          <TouchableOpacity 
                             key={f.id} 
                             style={styles.usageItem}
                             onPress={() => navigate(`/customers/${f.companies?.id}`)}
                          >
                              <View>
                                  <Text style={styles.usageMain}>{f.file_name}</Text>
                                  <Text style={styles.usageSub}>{f.companies?.name || 'Unknown'}</Text>
                              </View>
                              <a href={f.file_url} target="_blank" style={{ fontSize: 12, color: '#2563EB' }} onClick={e => e.stopPropagation()}>Open</a>
                          </TouchableOpacity>
                      ))}
                  </View>
              </ScrollView>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    flex: 1,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827'
  },
  contentRow: {
      flexDirection: 'row',
      gap: 32,
      flex: 1
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    flex: 1,
    // height: 'fit-content',
    maxWidth: 500
  },
  usageColumn: {
      flex: 1,
      backgroundColor: '#F9FAFB',
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: '#E5E7EB'
  },
  formGrid: {
    gap: 20
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151'
  },
  statsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingBottom: 16
  },
  statsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827'
  },
  badge: {
      backgroundColor: '#DBEAFE',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12
  },
  badgeText: {
      color: '#1E40AF',
      fontWeight: 'bold',
      fontSize: 12
  },
  section: {
      marginBottom: 24
  },
  sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6B7280',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1
  },
  emptyText: {
      color: '#9CA3AF',
      fontStyle: 'italic',
      fontSize: 13
  },
  usageItem: {
      backgroundColor: 'white',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB'
  },
  usageMain: {
      fontWeight: '500',
      color: '#111827',
      fontSize: 14
  },
  usageSub: {
      fontSize: 12,
      color: '#6B7280'
  },
  usageDate: {
      fontSize: 12,
      color: '#9CA3AF'
  }
});
