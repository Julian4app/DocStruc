import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';

export default function SubscriptionTypeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    price: '',
    discount: '',
    description: '',
    features: [] as string[]
  });
  
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    if (id && id !== 'new') {
      fetchType();
    }
  }, [id]);

  const fetchType = async () => {
    try {
      const { data, error } = await supabase.from('subscription_types').select('*').eq('id', id).single();
      if (error) throw error;
      setForm({
          ...data, 
          price: String(data.price), 
          discount: String(data.discount || 0),
          features: Array.isArray(data.features) ? data.features : []
      });
    } catch (e) {
      console.error(e);
      alert('Error fetching type');
      navigate('/subscription-types');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeature = () => {
      if (!newFeature.trim()) return;
      setForm({ ...form, features: [...form.features, newFeature.trim()] });
      setNewFeature('');
  };

  const handleRemoveFeature = (idx: number) => {
      const newFeatures = [...form.features];
      newFeatures.splice(idx, 1);
      setForm({ ...form, features: newFeatures });
  };

  const handleSave = async () => {
    if (!form.title || !form.price) {
      alert('Title and Price are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title,
        price: parseFloat(form.price),
        discount: parseFloat(form.discount) || 0,
        description: form.description,
        features: form.features // JSONB array
      };

      if (id === 'new') {
        const { error } = await supabase.from('subscription_types').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscription_types').update(payload).eq('id', id);
        if (error) throw error;
      }
      
      alert('Plan saved successfully');
      navigate('/subscription-types');
    } catch (e) {
      console.error(e);
      alert('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Button onClick={() => navigate('/subscription-types')} variant="secondary">Back</Button>
         <Text style={styles.title}>{id === 'new' ? 'New Plan' : 'Edit Plan'}</Text>
      </View>

      <View style={styles.card}>
         <View style={styles.formGrid}>
             <View style={styles.field}>
                 <Text style={styles.label}>Plan Title *</Text>
                 <Input 
                    value={form.title} 
                    onChangeText={(t) => setForm({...form, title: t})} 
                    placeholder="e.g. Pro Plan" 
                 />
             </View>

             <View style={styles.row}>
                 <View style={[styles.field, { flex: 1 }]}>
                     <Text style={styles.label}>Price (monthly) *</Text>
                     <Input 
                        value={form.price} 
                        onChangeText={(t) => setForm({...form, price: t})} 
                        placeholder="9.99"
                        keyboardType="numeric"
                     />
                 </View>
                 <View style={[styles.field, { flex: 1 }]}>
                     <Text style={styles.label}>Discount (%)</Text>
                     <Input 
                        value={form.discount} 
                        onChangeText={(t) => setForm({...form, discount: t})} 
                        placeholder="0"
                        keyboardType="numeric" 
                     />
                 </View>
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Description</Text>
                 <Input 
                    value={form.description || ''} 
                    onChangeText={(t) => setForm({...form, description: t})} 
                    placeholder="Short description of the plan..." 
                 />
             </View>

             <View style={styles.field}>
                 <Text style={styles.label}>Features Included</Text>
                 <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                     <Input 
                        value={newFeature} 
                        onChangeText={setNewFeature} 
                        placeholder="Add a feature..." 
                        style={{ flex: 1 }}
                     />
                     <Button onClick={handleAddFeature} variant="secondary">Add</Button>
                 </View>
                 <View style={styles.featureList}>
                     {form.features.map((f, i) => (
                         <View key={i} style={styles.featureItem}>
                             <Text style={{ flex: 1 }}>• {f}</Text>
                             <TouchableOpacity onPress={() => handleRemoveFeature(i)}>
                                 <Text style={{ color: '#EF4444', fontSize: 18 }}>×</Text>
                             </TouchableOpacity>
                         </View>
                     ))}
                     {form.features.length === 0 && <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No features added yet</Text>}
                 </View>
             </View>

             <View style={[styles.row, { marginTop: 20, justifyContent: 'flex-end' }]}>
                 <Button onClick={handleSave} variant="primary" disabled={saving}>
                     {saving ? 'Saving...' : 'Save Plan'}
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
  },
  featureList: {
      backgroundColor: '#F9FAFB',
      padding: 12,
      borderRadius: 8,
      gap: 8
  },
  featureItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB'
  }
});
