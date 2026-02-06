import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, Modal } from '@docstruc/ui'; // Assuming Modal might exist or I'll build a simple list
import { colors } from '@docstruc/theme';

export default function ContactPersons() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_persons')
        .select('*')
        .order('surname');
      
      if (error) throw error;
      setContacts(data || []);
    } catch (e) {
      console.error(e);
      alert('Error loading contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const { error } = await supabase.from('contact_persons').delete().eq('id', id);
      if (error) throw error;
      setContacts(contacts.filter(c => c.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error deleting contact');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.first_name.toLowerCase().includes(search.toLowerCase()) ||
    c.surname.toLowerCase().includes(search.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
             <Input 
                value={search} 
                onChangeText={setSearch} 
                placeholder="Search contacts..." 
                style={{ maxWidth: 300, backgroundColor: 'white' }}
             />
        </View>
        <Button onClick={() => navigate('/contacts/new')} variant="primary">Add New Contact</Button>
      </View>

      <View style={styles.card}>
         <View style={styles.tableHeader}>
             <Text style={[styles.col, { flex: 2 }]}>Name</Text>
             <Text style={[styles.col, { flex: 2 }]}>Company</Text>
             <Text style={[styles.col, { flex: 2 }]}>Department</Text>
             <Text style={[styles.col, { flex: 2 }]}>Email</Text>
             <Text style={[styles.col, { flex: 1, textAlign: 'right' }]}>Actions</Text>
         </View>
         <ScrollView style={{ minHeight: 200 }}>
             {filteredContacts.length === 0 && <Text style={{ padding: 20, color: '#6B7280' }}>No contacts found.</Text>}
             {filteredContacts.map(c => (
                 <TouchableOpacity 
                    key={c.id} 
                    style={styles.row}
                    onPress={() => navigate(`/contacts/${c.id}`)}
                 >
                     <Text style={[styles.cell, { flex: 2, fontWeight: '500' }]}>{c.surname}, {c.first_name}</Text>
                     <Text style={[styles.cell, { flex: 2 }]}>{c.company || '-'}</Text>
                     <Text style={[styles.cell, { flex: 2 }]}>{c.department || '-'}</Text>
                     <Text style={[styles.cell, { flex: 2 }]}>{c.email || '-'}</Text>
                     <View style={[styles.cell, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                         <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
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
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    flex: 1
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  col: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14
  },
  row: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center'
  },
  cell: {
    fontSize: 14,
    color: '#1F2937'
  }
});
