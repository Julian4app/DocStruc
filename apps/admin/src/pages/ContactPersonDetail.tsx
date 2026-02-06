import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { TagInput } from '../components/TagInput';

export default function ContactPersonDetail() {
  const { id } = useParams(); // if id 'new', then create mode
  const navigate = useNavigate();
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
      const { data, error } = await supabase.from('contact_persons').select('*').eq('id', id).single();
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
      
      alert('Contact saved successfully');
      navigate('/contacts');
    } catch (e) {
      console.error(e);
      alert('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Button onClick={() => navigate('/contacts')} variant="secondary">Back</Button>
         <Text style={styles.title}>{id === 'new' ? 'New Contact Person' : 'Edit Contact Person'}</Text>
      </View>

      <View style={styles.card}>
         <View style={styles.formGrid}>
             <View style={styles.row}>
                 <View style={[styles.field, { flex: 1 }]}>
                     <Text style={styles.label}>First Name *</Text>
                     <Input 
                        value={form.first_name} 
                        onChangeText={(t) => setForm({...form, first_name: t})} 
                        placeholder="First Name" 
                     />
                 </View>
                 <View style={[styles.field, { flex: 1 }]}>
                     <Text style={styles.label}>Surname *</Text>
                     <Input 
                        value={form.surname} 
                        onChangeText={(t) => setForm({...form, surname: t})} 
                        placeholder="Surname" 
                     />
                 </View>
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Company</Text>
                 <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12 }}>
                     <select 
                        value={form.company || ''} 
                        onChange={(e) => setForm({...form, company: e.target.value})}
                        style={{ width: '100%', height: 40, border: 'none', background: 'transparent', outline: 'none' }}
                     >
                         <option value="">Select Company...</option>
                         {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </select>
                 </View>
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Department</Text>
                 <Input 
                    value={form.department || ''} 
                    onChangeText={(t) => setForm({...form, department: t})} 
                    placeholder="Department (e.g. Sales, IT)" 
                 />
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Email</Text>
                 <Input 
                    value={form.email || ''} 
                    onChangeText={(t) => setForm({...form, email: t})} 
                    placeholder="email@example.com" 
                 />
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Tags</Text>
                 <TagInput 
                    value={form.tags || []} 
                    availableTags={availableTags}
                    onChange={(newTags: string[]) => setForm({...form, tags: newTags})}
                    onTagCreated={fetchTags}
                 />
             </View>

             <View style={[styles.row, { marginTop: 20, justifyContent: 'flex-end' }]}>
                 <Button onClick={handleSave} variant="primary" disabled={saving}>
                     {saving ? 'Saving...' : 'Save Contact'}
                 </Button>
             </View>
         </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    flex: 1,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center'
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
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  formGrid: {
    gap: 20
  },
  row: {
    flexDirection: 'row',
    gap: 24
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151'
  }
});
