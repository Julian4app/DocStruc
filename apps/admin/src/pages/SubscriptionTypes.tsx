import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';
import { Plus, Check, Trash2, CreditCard, Edit2 } from 'lucide-react';

export default function SubscriptionTypes() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit/Create Modal State
  const [editingType, setEditingType] = useState<any>(null); // null = closed, {} = new, {id...} = edit
  const [formData, setFormData] = useState({ 
      title: '', 
      price: '', 
      discount: '0', 
      description: '', 
      features: '' // Newline separated 
  });

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_types')
        .select('id, title, price, currency, discount, features, description, created_at')
        .order('price');
      
      if (error) throw error;
      setTypes(data || []);
    } catch (e) {
      console.error(e);
      // alert('Error loading subscription types');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
       try {
           const featuresArray = formData.features.split('\n').filter(f => f.trim() !== '');
           const payload = {
               title: formData.title,
               price: parseFloat(formData.price) || 0,
               discount: parseInt(formData.discount) || 0,
               description: formData.description,
               features: featuresArray
           };

           if (editingType.id) {
               // Update
               const { error } = await supabase.from('subscription_types').update(payload).eq('id', editingType.id);
               if (error) throw error;
               setTypes(types.map(t => t.id === editingType.id ? { ...t, ...payload } : t));
           } else {
               // Create
               const { data, error } = await supabase.from('subscription_types').insert([payload]).select().single();
               if (error) throw error;
               setTypes([...types, data]);
           }
           setEditingType(null);
       } catch (e) {
           console.error(e);
           alert('Error saving plan');
       }
  };

  const openModal = (type?: any) => {
      if (type) {
          setEditingType(type);
          setFormData({
              title: type.title,
              price: String(type.price),
              discount: String(type.discount || 0),
              description: type.description || '',
              features: Array.isArray(type.features) ? type.features.join('\n') : ''
          });
      } else {
          setEditingType({});
          setFormData({ title: '', price: '', discount: '0', description: '', features: '' });
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
            <Text style={styles.title}>Subscription Plans</Text>
            <Text style={styles.subtitle}>Manage available subscription tiers and pricing</Text>
          </View>
          <Button 
            onClick={() => openModal()}
            style={styles.createBtn}
          >
            <Plus size={20} color="white" />
            <Text style={{ color: 'white', fontWeight: '600' }}>Add Plan</Text>
          </Button>
        </View>      {/* Pricing Grid */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {types.length === 0 ? (
            <View style={styles.emptyState}>
                <CreditCard size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No subscription plans active.</Text>
            </View>
        ) : (
            <View style={styles.grid}>
                {types.map(t => (
                    <TouchableOpacity 
                        key={t.id} 
                        style={styles.card}
                        onPress={() => openModal(t)}
                    >
                        <View style={styles.cardContent}>
                            <View style={styles.planHeader}>
                                <Text style={styles.planName}>{t.title}</Text>
                                <View style={styles.priceRow}>
                                    <Text style={styles.currency}>$</Text>
                                    <Text style={styles.price}>{t.price}</Text>
                                    <Text style={styles.period}>/mo</Text>
                                </View>
                                {t.discount > 0 && <View style={styles.discountBadge}><Text style={styles.discountText}>{t.discount}% OFF</Text></View>}
                            </View>

                            <Text style={styles.description} numberOfLines={3}>{t.description || 'No description provided.'}</Text>
                            
                            <View style={styles.divider} />

                            <View style={styles.featuresList}>
                                {(Array.isArray(t.features) ? t.features : []).slice(0, 5).map((f: string, i: number) => (
                                    <View key={i} style={styles.featureItem}>
                                        <Check size={16} color="#10b981" />
                                        <Text style={styles.featureText} numberOfLines={1}>{f}</Text>
                                    </View>
                                ))}
                                {(Array.isArray(t.features) ? t.features : []).length > 5 && (
                                    <Text style={styles.moreFeatures}>+ {(t.features.length - 5)} more features</Text>
                                )}
                            </View>
                        </View>
                        
                        <View style={styles.cardFooter}>
                            <TouchableOpacity 
                                onPress={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}
                                style={styles.deleteBtn}
                            >
                                <Trash2 size={16} color="#ef4444" />
                                <Text style={styles.deleteText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        )}
      </ScrollView>

      {/* Edit/Create Modal */}
      {editingType && (
          <CustomModal
              visible={!!editingType}
              onClose={() => setEditingType(null)}
              title={editingType.id ? 'Edit Plan' : 'New Plan'}
          >
              <View style={{ gap: 4, paddingVertical: 8 }}>
                  <Input
                      label="Plan Title"
                      value={formData.title}
                      onChangeText={(text: string) => setFormData({ ...formData, title: text })}
                      placeholder="e.g. Pro Plan"
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ flex: 1 }}>
                          <Input
                              label="Monthly Price ($)"
                              value={formData.price}
                              onChangeText={(text: string) => setFormData({ ...formData, price: text })}
                              placeholder="0.00"
                              keyboardType="numeric"
                          />
                      </View>
                      <View style={{ flex: 1 }}>
                          <Input
                              label="Discount (%)"
                              value={formData.discount}
                              onChangeText={(text: string) => setFormData({ ...formData, discount: text })}
                              placeholder="0"
                              keyboardType="numeric"
                          />
                      </View>
                  </View>

                  <Input
                      label="Description"
                      value={formData.description}
                      onChangeText={(text: string) => setFormData({ ...formData, description: text })}
                      placeholder="Brief description of the plan..."
                      multiline
                      numberOfLines={3}
                      style={{ minHeight: 80, textAlignVertical: 'top' }}
                  />

                  <Input
                      label="Features"
                      value={formData.features}
                      onChangeText={(text: string) => setFormData({ ...formData, features: text })}
                      placeholder={"• Unlimited Users\n• 24/7 Support\n• Advanced Analytics"}
                      multiline
                      numberOfLines={6}
                      style={{ minHeight: 150, fontFamily: 'monospace', fontSize: 13, textAlignVertical: 'top' }}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                      <Button onClick={() => setEditingType(null)} variant="outline">
                          Cancel
                      </Button>
                      <Button onClick={handleSave} variant="primary">
                          {editingType.id ? 'Save Changes' : 'Create Plan'}
                      </Button>
                  </View>
              </View>
          </CustomModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    gap: 32,
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
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
  createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16
  },
  
  // Grid
  grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 24,
      alignItems: 'stretch'
  },
  card: {
      width: 320,
      backgroundColor: 'white',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#64748b',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden'
  },
  cardContent: {
      padding: 24,
      flex: 1
  },
  planHeader: {
      alignItems: 'center', // Center align for pricing card look
      marginBottom: 16
  },
  planName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f172a',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8
  },
  priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start'
  },
  currency: {
      fontSize: 20,
      fontWeight: '600',
      color: '#334155',
      marginTop: 4
  },
  price: {
      fontSize: 48,
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: -1
  },
  period: {
      fontSize: 16,
      color: '#64748b',
      alignSelf: 'flex-end',
      marginBottom: 8,
      marginLeft: 4
  },
  discountBadge: {
      backgroundColor: '#fee2e2',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginTop: 4
  },
  discountText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#ef4444'
  },
  description: {
      fontSize: 14,
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24
  },
  divider: {
      height: 1,
      backgroundColor: '#f1f5f9',
      width: '100%',
      marginBottom: 24
  },
  featuresList: {
      gap: 12
  },
  featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
  },
  featureText: {
      fontSize: 14,
      color: '#334155',
      flex: 1
  },
  moreFeatures: {
      fontSize: 12,
      color: '#94a3b8',
      fontStyle: 'italic',
      marginLeft: 26,
      marginTop: 4
  },
  
  cardFooter: {
      padding: 16,
      backgroundColor: '#f8fafc',
      borderTopWidth: 1,
      borderTopColor: '#f1f5f9',
      alignItems: 'center'
  },
  deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 8,
      opacity: 0.8
  },
  deleteText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#ef4444'
  },

  // Empty
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
      width: '100%'
  },
  emptyText: {
      color: '#94a3b8',
      marginTop: 16
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  }
});

