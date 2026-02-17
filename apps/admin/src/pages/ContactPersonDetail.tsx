import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { TagInput } from '../components/TagInput';
import { Select } from '../components/Select';
import { useToast } from '../components/ToastContext';
import { ArrowLeft, Save, User, Building, Briefcase, Mail, Tag } from 'lucide-react';

export default function ContactPersonDetail() {
  const { id } = useParams(); // if id 'new', then create mode
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    first_name: '',
    surname: '',
    company: '',
    department: '',
    email: '',
    tags: [] as string[]
  });

  const [companies, setCompanies] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  useEffect(() => {
    fetchCompanies();
    fetchTags();
    if (id && id !== 'new') {
      fetchContact();
    }
  }, [id]);

  const fetchCompanies = async () => {
      const { data } = await supabase.from('companies').select('id, name');
      setCompanies(data || []);
  };

  const fetchTags = async () => {
    const { data } = await supabase.from('tags').select('id, title, color').order('title');
    setAvailableTags(data || []);
  };

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase.from('contact_persons').select('id, first_name, surname, company, department, email, phone, tags, notes, created_at, updated_at').eq('id', id).single();
      if (error) throw error;
      setForm({ ...data, tags: data.tags || [] });
    } catch (e) {
      console.error(e);
      alert('Error fetching contact');
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.first_name || !form.surname) {
      alert('First Name and Surname are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        first_name: form.first_name,
        surname: form.surname,
        company: form.company,
        department: form.department,
        email: form.email,
        tags: form.tags
      };

      if (id === 'new') {
        const { error } = await supabase.from('contact_persons').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contact_persons').update(payload).eq('id', id);
        if (error) throw error;
      }
      
      showToast('Contact saved successfully', 'success');
      navigate('/contacts');
    } catch (e) {
      console.error(e);
      showToast('Failed to save contact', 'error');
    } finally {
      setSaving(false);
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
         <TouchableOpacity onPress={() => navigate('/contacts')} style={styles.backButton}>
             <ArrowLeft size={20} color="#64748b" />
             <Text style={styles.backText}>Back to Contacts</Text>
         </TouchableOpacity>
         <View style={styles.headerRow}>
             <View>
                 <Text style={styles.title}>{id === 'new' ? 'Create New Contact' : 'Edit Contact Details'}</Text>
                 <Text style={styles.subtitle}>{id === 'new' ? 'Add a new person to your network' : `Update information for ${form.first_name || 'contact'}`}</Text>
             </View>
             <Button onClick={handleSave} variant="primary" disabled={saving} style={styles.saveButton}>
                 <Save size={18} />
                 <Text style={{ fontWeight: '600' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
             </Button>
         </View>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
         <View style={styles.sectionHeader}>
             <User size={20} color="#3b82f6" />
             <Text style={styles.sectionTitle}>Personal Information</Text>
         </View>
         
         <View style={styles.formGrid}>
             <View style={styles.row}>
                 <View style={{ flex: 1, gap: 8 }}>
                     <Text style={styles.label}>First Name *</Text>
                     <Input 
                        value={form.first_name} 
                        onChangeText={(t) => setForm({...form, first_name: t})} 
                        placeholder="e.g. John" 
                     />
                 </View>
                 <View style={{ flex: 1, gap: 8 }}>
                     <Text style={styles.label}>Surname *</Text>
                     <Input 
                        value={form.surname} 
                        onChangeText={(t) => setForm({...form, surname: t})} 
                        placeholder="e.g. Doe" 
                     />
                 </View>
             </View>

             <View style={styles.divider} />
             
             <View style={styles.sectionHeader}>
                 <Building size={20} color="#3b82f6" />
                 <Text style={styles.sectionTitle}>Professional Details</Text>
             </View>

             <View style={styles.field}>
                 <Select
                    label="Company"
                    value={form.company || ''}
                    onChange={(v) => setForm({...form, company: String(v)})}
                    options={[
                        { label: 'Select Company...', value: '' },
                        ...companies.map(c => ({ label: c.name, value: c.name }))
                    ]}
                 />
             </View>

             <View style={styles.row}>
                 <View style={{ flex: 1, gap: 8 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Briefcase size={14} color="#64748b" />
                        <Text style={styles.label}>Department</Text>
                     </View>
                     <Input 
                        value={form.department || ''} 
                        onChangeText={(t) => setForm({...form, department: t})} 
                        placeholder="e.g. Sales, IT" 
                     />
                 </View>
                 <View style={{ flex: 1, gap: 8 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Mail size={14} color="#64748b" />
                        <Text style={styles.label}>Email Address</Text>
                     </View>
                     <Input 
                        value={form.email || ''} 
                        onChangeText={(t) => setForm({...form, email: t})} 
                        placeholder="email@example.com" 
                     />
                 </View>
             </View>

             <View style={styles.divider} />
             
             <View style={styles.sectionHeader}>
                 <Tag size={20} color="#3b82f6" />
                 <Text style={styles.sectionTitle}>Tags & Categorization</Text>
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Tags</Text>
                 <TagInput 
                    value={form.tags || []} 
                    availableTags={availableTags}
                    onChange={(newTags: string[]) => setForm({...form, tags: newTags})}
                    onTagCreated={fetchTags}
                    placeholder="Add tags..."
                 />
             </View>
         </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    gap: 24,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center'
  },
  header: {
    gap: 16
  },
  backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
  },
  backText: {
      color: '#64748b',
      fontWeight: '600'
  },
  headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5
  },
  subtitle: {
      fontSize: 15,
      color: '#64748b',
      marginTop: 4
  },
  saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
  },
  
  // Card Styles
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 32,
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }
  },
  
  sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#0f172a'
  },
  
  formGrid: {
    gap: 24
  },
  row: {
    flexDirection: 'row',
    gap: 24
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  
  divider: {
      height: 1,
      backgroundColor: '#f1f5f9',
      marginVertical: 4
  },
  
  // Select
  selectWrapper: {
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      backgroundColor: 'white',
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 8
  },
  selectInput: {
      width: '100%',
      height: '100%',
      // border: 'none',
      // outline: 'none',
      backgroundColor: 'transparent',
      fontSize: 14,
      color: '#0f172a'
  }
});
