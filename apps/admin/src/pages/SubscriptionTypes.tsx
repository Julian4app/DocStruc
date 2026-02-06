import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';

export default function SubscriptionTypes() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_types')
        .select('*')
        .order('price');
      
      if (error) throw error;
      setTypes(data || []);
    } catch (e) {
      console.error(e);
      alert('Error loading subscription types');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This might affect existing subscriptions.')) return;
    try {
      const { error } = await supabase.from('subscription_types').delete().eq('id', id);
      if (error) throw error;
      setTypes(types.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error deleting type');
    }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={{ color: '#6B7280' }}>Manage the subscription plans available to customers.</Text>
        <Button onClick={() => navigate('/subscription-types/new')} variant="primary">Add New Plan</Button>
      </View>

      <View style={styles.grid}>
          {types.length === 0 && <Text>No subscription types found.</Text>}
          {types.map(t => (
              <TouchableOpacity 
                 key={t.id} 
                 style={styles.card}
                 onPress={() => navigate(`/subscription-types/${t.id}`)}
              >
                  <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{t.title}</Text>
                      <Text style={styles.price}>${t.price}<Text style={styles.currency}>/mo</Text></Text>
                  </View>
                  
                  {t.discount > 0 && (
                      <View style={styles.badge}>
                          <Text style={styles.badgeText}>{t.discount}% OFF</Text>
                      </View>
                  )}

                  <Text style={styles.description} numberOfLines={2}>{t.description || 'No description'}</Text>

                  <View style={styles.features}>
                      {(Array.isArray(t.features) ? t.features : []).slice(0, 3).map((f: string, i: number) => (
                          <Text key={i} style={styles.featureItem}>• {f}</Text>
                      ))}
                      {(Array.isArray(t.features) ? t.features : []).length > 3 && <Text style={{ fontSize: 12, color: '#9CA3AF' }}>+ more</Text>}
                  </View>

                  <View style={styles.footer}>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(t.id); }}>
                          <Text style={{ color: '#EF4444', fontWeight: '500' }}>Delete</Text>
                      </TouchableOpacity>
                  </View>
              </TouchableOpacity>
          ))}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    width: 300,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8
  },
  cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      flex: 1
  },
  price: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827'
  },
  currency: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: 'normal'
  },
  badge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginBottom: 12
  },
  badgeText: {
      color: '#D97706',
      fontSize: 12,
      fontWeight: 'bold'
  },
  description: {
      color: '#6B7280',
      fontSize: 14,
      marginBottom: 16,
      height: 40
  },
  features: {
      gap: 4,
      flex: 1,
      marginBottom: 24
  },
  featureItem: {
      fontSize: 13,
      color: '#374151'
  },
  footer: {
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
      paddingTop: 16,
      flexDirection: 'row',
      justifyContent: 'flex-end'
  }
});
