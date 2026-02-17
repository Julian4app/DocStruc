import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, MoreHorizontal, User, Mail, Calendar, Hash } from 'lucide-react';

const MiniKPI = ({ label, value }: { label: string, value: string }) => (
    <View style={styles.miniKpi}>
        <Text style={styles.miniKpiValue}>{value}</Text>
        <Text style={styles.miniKpiLabel}>{label}</Text>
    </View>
);

const getStatusColor = (status: string) => {
    switch(status) {
        case 'Active': return { bg: '#ecfdf5', text: '#059669', dot: '#10b981' }; 
        case 'Inactive': return { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
        case 'Lead': return { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' };
        default: return { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
    }
};

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('id, name, status, employees_count, logo_url, email, created_at')
            .order('name');
        
        if (error) throw error;
        setCustomers(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
      try {
          const { data, error } = await supabase
            .from('companies')
            .insert([{ name: 'New Customer', status: 'Lead' }])
            .select()
            .single();
          
          if (error) throw error;
          if (data) navigate(`/customers/${data.id}`);
      } catch (e: any) {
          console.error('Error creating customer:', e);
          const msg = e?.message || JSON.stringify(e);
          alert(`Could not create customer: ${msg}`);
      }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.pageContainer}>
        {/* Header Section */}
        <View style={styles.header}>
            <View>
                <Text style={styles.pageTitle}>Customers</Text>
                <Text style={styles.pageSubtitle}>Manage your client relationships and accounts.</Text>
            </View>
            <View style={styles.kpiRow}>
                <MiniKPI label="Total Customers" value={customers.length.toString()} />
                <View style={styles.kpiDivider} />
                <MiniKPI label="New This Month" value="12" />
                <View style={styles.kpiDivider} />
                <MiniKPI label="Leads" value={customers.filter(c => c.status === 'Lead').length.toString()} />
            </View>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
            <View style={styles.searchContainer}>
                <Search size={16} color="#94a3b8" />
                <TextInput 
                    style={styles.searchInput}
                    placeholder="Search companies..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={styles.filterBtn}>
                    <Filter size={16} color="#64748b" />
                    <Text style={styles.filterBtnText}>Filters</Text>
                </TouchableOpacity>
                <Button onClick={handleAddCustomer} variant="primary" style={{ height: 40, paddingHorizontal: 16 }}>
                    <Plus size={16} color="white" style={{marginRight: 8}} /> Add Customer
                </Button>
            </View>
        </View>

        {/* Table/List */}
        <View style={styles.tableCard}>
            <View style={styles.listHeader}>
                <View style={[styles.col, styles.flex2, { flexDirection: 'row', gap: 8 }]}>
                    <Text style={styles.headerText}>Company</Text>
                </View>
                <View style={styles.col}>
                    <Text style={styles.headerText}>Status</Text>
                </View>
                <View style={styles.col}>
                    <Text style={styles.headerText}>Email</Text>
                </View>
                <View style={styles.col}>
                    <Text style={styles.headerText}>Accounts</Text>
                </View>
                <View style={styles.col}>
                    <Text style={styles.headerText}>Created</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: '#94a3b8' }}>Loading customers...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item }) => {
                        const statusStyle = getStatusColor(item.status || 'Active');
                        return (
                            <TouchableOpacity 
                                style={[styles.row, { backgroundColor: statusStyle.bg }]}
                                onPress={() => navigate(`/customers/${item.id}`)}
                            >
                                <View style={[styles.col, styles.flex2]}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{item.name.substring(0,2).toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.name}>{item.name}</Text>
                                </View>
                                
                                <View style={styles.col}>
                                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                        <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                                        <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                            {item.status || 'Active'}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.col}>
                                    <Text style={styles.cellText}>{item.email || '-'}</Text>
                                </View>
                                
                                <View style={styles.col}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                        <User size={14} color="#94a3b8" />
                                        <Text style={styles.cellText}>{item.employees_count || 0} / {item.bought_accounts || 0}</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.col}>
                                    <Text style={styles.mutedText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                </View>
                                
                                <View style={{ width: 40, alignItems: 'flex-end' }}>
                                    <MoreHorizontal size={16} color="#94a3b8" />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    gap: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8
  },
  pageTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#0f172a',
      marginBottom: 4
  },
  pageSubtitle: {
      fontSize: 14,
      color: '#64748b'
  },
  kpiRow: {
      flexDirection: 'row',
      backgroundColor: 'white',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      gap: 24,
      alignItems: 'center'
  },
  kpiDivider: {
      width: 1,
      height: 24,
      backgroundColor: '#f1f5f9'
  },
  miniKpi: {
      gap: 2
  },
  miniKpiLabel: {
      fontSize: 11,
      color: '#64748b',
      fontWeight: '600',
      textTransform: 'uppercase'
  },
  miniKpiValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#0f172a'
  },
  
  toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
  },
  searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 40,
      width: 320,
      gap: 8
  },
  searchInput: {
      flex: 1,
      fontSize: 14,
      color: '#0f172a',
      outlineStyle: 'none'
  },
  filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      paddingHorizontal: 16,
      height: 40
  },
  filterBtnText: {
      fontSize: 14,
      fontWeight: '500', 
      color: '#64748b'
  },
  
  tableCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      overflow: 'hidden',
      shadowColor: '#64748b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12
  },
  listHeader: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      backgroundColor: '#f8fafc'
  },
  headerText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: 0.5
  },
  row: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f8fafc',
      alignItems: 'center',
      backgroundColor: 'white'
  },
  col: {
      flex: 1,
      justifyContent: 'center'
  },
  flex2: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center'
  },
  avatarText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#64748b'
  },
  name: {
      fontWeight: '600',
      color: '#0f172a',
      fontSize: 14
  },
  cellText: {
      fontSize: 14,
      color: '#334155'
  },
  mutedText: {
      fontSize: 13,
      color: '#94a3b8'
  },
  statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
      alignSelf: 'flex-start'
  },
  statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3
  },
  statusText: {
      fontSize: 12,
      fontWeight: '600'
  }
});
