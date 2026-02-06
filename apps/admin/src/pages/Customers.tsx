import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';
import { useNavigate } from 'react-router-dom';

const MiniKPI = ({ label, value }: { label: string, value: string }) => (
    <View style={styles.miniKpi}>
        <Text style={styles.miniKpiLabel}>{label}</Text>
        <Text style={styles.miniKpiValue}>{value}</Text>
    </View>
);

const getStatusColor = (status: string) => {
    switch(status) {
        case 'Active': return { bg: '#D1FAE5', text: '#065F46' }; // Green
        case 'Inactive': return { bg: '#F3F4F6', text: '#374151' }; // Gray
        case 'Lead': return { bg: '#DBEAFE', text: '#1E40AF' }; // Blue
        default: return { bg: '#F3F4F6', text: '#374151' };
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
            .select('*')
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
    <View style={styles.container}>
        {/* Customer Stats Header */}
        <View style={styles.kpiRow}>
            <MiniKPI label="Total Customers" value={customers.length.toString()} />
            <MiniKPI label="New This Month" value="12" /> {/* Mock derived data */}
            <MiniKPI label="Leads" value={customers.filter(c => c.status === 'Lead').length.toString()} />
        </View>

        <View style={styles.controls}>
            <TextInput 
                style={styles.searchInput}
                placeholder="Search customers..."
                value={search}
                onChangeText={setSearch}
            />
            <Button onClick={handleAddCustomer} variant="primary">Add Customer</Button>
        </View>

        <View style={styles.listHeader}>
             <Text style={[styles.col, styles.flex2]}>Company Name</Text>
             <Text style={styles.col}>Status</Text>
             <Text style={styles.col}>Email</Text>
             <Text style={styles.col}>Accounts (Reg/Bought)</Text>
             <Text style={styles.col}>Created</Text>
        </View>

        {loading ? (
            <Text style={{ padding: 20 }}>Loading...</Text>
        ) : (
            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                    const statusStyle = getStatusColor(item.status || 'Active');
                    return (
                        <TouchableOpacity 
                            style={styles.row}
                            onPress={() => navigate(`/customers/${item.id}`)}
                        >
                            <Text style={[styles.col, styles.flex2, styles.name]}>{item.name}</Text>
                            <View style={styles.badge}>
                                <Text style={[styles.badgeText, { backgroundColor: statusStyle.bg, color: statusStyle.text }]}>
                                    {item.status || 'Active'}
                                </Text>
                            </View>
                            <Text style={styles.col}>{item.email || '-'}</Text>
                            <Text style={styles.col}>{item.employees_count || 0} / {item.bought_accounts || 0}</Text>
                            <Text style={styles.col}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    );
                }}
            />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    minHeight: 500
  },
  kpiRow: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 32,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
      paddingBottom: 24
  },
  miniKpi: {
      gap: 4
  },
  miniKpiLabel: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '600',
      textTransform: 'uppercase'
  },
  miniKpiValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#111827'
  },
  controls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24
  },
  searchInput: {
      height: 40,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 8,
      paddingHorizontal: 12,
      width: 300,
      backgroundColor: '#F9FAFB',
      outlineStyle: 'none'
  },
  listHeader: {
      flexDirection: 'row',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      marginBottom: 8
  },
  row: {
      flexDirection: 'row',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
      alignItems: 'center'
  },
  col: {
      flex: 1,
      fontSize: 14,
      color: '#6B7280'
  },
  flex2: { flex: 2 },
  name: {
      fontWeight: '600',
      color: '#111827'
  },
  badge: {
      flex: 1,
      alignItems: 'flex-start'
  },
  badgeText: {
      backgroundColor: '#D1FAE5',
      color: '#065F46',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 99,
      fontSize: 12,
      fontWeight: '500'
  }
});
