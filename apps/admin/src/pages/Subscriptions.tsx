import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';
import { Select } from '../components/Select';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, TrendingUp, DollarSign, Plus, Trash2, Edit2 } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const MiniKPI = ({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
    <View style={styles.miniKpi}>
        <View style={styles.kpiIcon}>
            <Icon size={20} color="#6366f1" />
        </View>
        <View>
            <Text style={styles.miniKpiValue}>{value}</Text>
            <Text style={styles.miniKpiLabel}>{label}</Text>
        </View>
    </View>
);

export default function Subscriptions() {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'types'>('subscriptions');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [data, setData] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Modal & Form (for Types)
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({ id: '', title: '', price: '', discount: '', description: '', features: '' });

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
        setLoading(true);
        
        if (activeTab === 'subscriptions') {
            const { data: subs, error } = await supabase
                .from('company_subscriptions')
                .select(`
                    *,
                    companies (id, name, logo_url),
                    subscription_types (title, price)
                `);
            if (error) throw error;
            setData(subs || []);
        } else {
            const { data: t, error } = await supabase.from('subscription_types').select('id, title, price, currency, discount, features, description, created_at').order('price');
            if (error) throw error;
            setTypes(t || []);
        }

    } catch (e) {
        console.error(e);
        showToast('Error loading data', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleSaveType = async () => {
      try {
          const featuresArray = typeForm.features.split('\n').filter(f => f.trim() !== '');
          const payload = {
              title: typeForm.title,
              price: parseFloat(typeForm.price) || 0,
              discount: parseInt(typeForm.discount) || 0,
              description: typeForm.description,
              features: featuresArray
          };
          
          let error;
          if (typeForm.id) {
              const res = await supabase.from('subscription_types').update(payload).eq('id', typeForm.id);
              error = res.error;
          } else {
              const res = await supabase.from('subscription_types').insert([payload]);
              error = res.error;
          }

          if (error) throw error;
          showToast('Plan saved successfully', 'success');
          setShowTypeModal(false);
          fetchData();
      } catch(e) {
          console.error(e);
          showToast('Failed to save plan', 'error');
      }
  };

  const handleDeleteType = async (id: string) => {
      if (!confirm('Delete this plan?')) return;
      try {
          const { error } = await supabase.from('subscription_types').delete().eq('id', id);
          if (error) throw error;
          setTypes(types.filter(t => t.id !== id));
          showToast('Plan deleted', 'success');
      } catch(e) {
             showToast('Cannot delete plan in use', 'error');
      }
  };

  const calculateMRR = () => {
      return data.reduce((acc, curr) => {
          const price = curr.subscription_types?.price || 0;
          return acc + (curr.payment_cycle === 'yearly' ? price / 12 : price);
      }, 0);
  };

  const filtered = data.filter(d => {
      if (filterType === 'all') return true;
      return d.payment_cycle === filterType; 
  });

  return (
    <View style={styles.pageContainer}>
        {/* Header Section */}
        <View style={styles.header}>
            <View>
                <Text style={styles.pageTitle}>Subscriptions</Text>
                <Text style={styles.pageSubtitle}>Manage your plans and recurring revenue.</Text>
            </View>
            <View style={styles.kpiRow}>
                <MiniKPI label="Total Subscribers" value={data.length.toString()} icon={RefreshCw} />
                <View style={styles.kpiDivider} />
                <MiniKPI label="Monthly Revenue" value={`$${calculateMRR().toFixed(0)}`} icon={DollarSign} />
                <View style={styles.kpiDivider} />
                <MiniKPI label="Active Plans" value={String(activeTab === 'subscriptions' ? '...' : types.length)} icon={TrendingUp} />
            </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'subscriptions' && styles.activeTab]}
                onPress={() => setActiveTab('subscriptions')}
            >
                <Text style={[styles.tabText, activeTab === 'subscriptions' && styles.activeTabText]}>Active Subscriptions</Text>
            </TouchableOpacity>
             <TouchableOpacity 
                style={[styles.tab, activeTab === 'types' && styles.activeTab]}
                onPress={() => setActiveTab('types')}
            >
                <Text style={[styles.tabText, activeTab === 'types' && styles.activeTabText]}>Subscription Plans</Text>
            </TouchableOpacity>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
            {activeTab === 'subscriptions' ? (
                <View style={{ width: 200 }}>
                    <Select 
                        value={filterType} 
                        onChange={(v) => setFilterType(String(v))}
                        options={[
                            { label: 'All Subscriptions', value: 'all' },
                            { label: 'Monthly Only', value: 'monthly' },
                            { label: 'Yearly Only', value: 'yearly' }
                        ]}
                    />
                </View>
            ) : (
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
                     <Button 
                        onClick={() => {
                            setTypeForm({ id: '', title: '', price: '', discount: '0', description: '', features: '' });
                            setShowTypeModal(true);
                        }} 
                        variant="primary"
                    >
                        <Plus size={16} /> New Plan
                    </Button>
                </View>
            )}
        </View>

        {/* Content */}
        {activeTab === 'subscriptions' ? (
            <View style={styles.tableCard}>
                <View style={styles.listHeader}>
                    <View style={[styles.col, styles.flex2]}>
                        <Text style={styles.headerText}>Company</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.headerText}>Plan</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.headerText}>Cycle</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.headerText}>Price</Text>
                    </View>
                    <View style={[styles.col, { alignItems: 'flex-end', paddingRight: 24 }]}>
                        <Text style={styles.headerText}>Next Billing</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#94a3b8' }}>Loading subscriptions...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.row}
                                onPress={() => item.companies?.id ? navigate(`/customers/${item.companies.id}`) : null}
                            >
                                <View style={[styles.col, styles.flex2, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{(item.companies?.name || '?').substring(0,2).toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.name}>{item.companies?.name || 'Unknown'}</Text>
                                </View>
                                
                                <View style={styles.col}>
                                    <View style={styles.planBadge}>
                                        <Text style={styles.planText}>{item.subscription_types?.title || 'Custom'}</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.col}>
                                    <Text style={styles.cellText}>{item.payment_cycle}</Text>
                                </View>

                                <View style={styles.col}>
                                    <Text style={[styles.cellText, { fontWeight: '600' }]}>${item.subscription_types?.price || 0}</Text>
                                </View>
                                
                                <View style={[styles.col, { alignItems: 'flex-end', paddingRight: 24 }]}>
                                    <Text style={styles.mutedText}>{item.next_billing_date || '-'}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        ) : (
             <View style={styles.grid}>
                 {types.map(type => (
                     <View key={type.id} style={styles.planCard}>
                         <View style={{ padding: 24, flex: 1 }}>
                             <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                 <Text style={styles.planTitle}>{type.title}</Text>
                                 <View style={styles.priceTag}>
                                     <Text style={styles.priceText}>${type.price}</Text>
                                     <Text style={styles.periodText}>/mo</Text>
                                 </View>
                             </View>
                             <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 20 }}>
                                 {type.features || 'No specific features listed.'}
                             </Text>
                         </View>
                         <View style={styles.cardActions}>
                             <TouchableOpacity 
                                onPress={() => {
                                    setTypeForm({ 
                                        id: type.id, 
                                        title: type.title, 
                                        price: String(type.price), 
                                        discount: String(type.discount || 0),
                                        description: type.description || '',
                                        features: Array.isArray(type.features) ? type.features.join('\n') : (type.features || '') 
                                    });
                                    setShowTypeModal(true);
                                }} 
                                style={styles.actionBtn}
                             >
                                 <Edit2 size={16} color="#64748b" />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => handleDeleteType(type.id)} style={styles.actionBtn}>
                                 <Trash2 size={16} color="#ef4444" />
                             </TouchableOpacity>
                         </View>
                     </View>
                 ))}
             </View>
        )}

        <CustomModal
            visible={showTypeModal}
            onClose={() => setShowTypeModal(false)}
            title={typeForm.id ? "Edit Plan" : "New Plan"}
        >
            <View style={{ gap: 16, padding: 8 }}>
                <Input placeholder="Plan Title" value={typeForm.title} onChangeText={t => setTypeForm({...typeForm, title: t})} />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Input placeholder="Price ($)" value={typeForm.price} onChangeText={t => setTypeForm({...typeForm, price: t})} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                         <Input placeholder="Discount (%)" value={typeForm.discount} onChangeText={t => setTypeForm({...typeForm, discount: t})} keyboardType="numeric" />
                    </View>
                </View>
                <Input placeholder="Description" value={typeForm.description} onChangeText={t => setTypeForm({...typeForm, description: t})} multiline style={{ height: 60, textAlignVertical: 'top' }} />
                <Input placeholder="Features (one per line)" value={typeForm.features} onChangeText={t => setTypeForm({...typeForm, features: t})} multiline style={{ height: 100, textAlignVertical: 'top' }} />
                <Button onClick={handleSaveType} variant="primary">Save Plan</Button>
            </View>
        </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { gap: 24, maxWidth: 1200, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: '#64748b' },
  kpiRow: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 24, alignItems: 'center' },
  kpiDivider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },
  miniKpi: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  kpiIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  miniKpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  miniKpiValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableCard: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
  listHeader: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  headerText: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc', alignItems: 'center', backgroundColor: 'white' },
  col: { flex: 1, justifyContent: 'center' },
  flex2: { flex: 2 },
  avatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  cellText: { fontSize: 14, color: '#334155' },
  mutedText: { fontSize: 13, color: '#94a3b8' },
  planBadge: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  planText: { color: '#0369a1', fontSize: 12, fontWeight: '600' },
  
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9' },
  activeTab: { backgroundColor: '#1e293b' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  activeTabText: { color: 'white' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  planCard: { width: 300, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity:0.05, shadowRadius:12, overflow: 'hidden' },
  planTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  priceTag: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceText: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  periodText: { fontSize: 13, color: '#64748b' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRightWidth: 1, borderRightColor: '#f1f5f9' }
});
