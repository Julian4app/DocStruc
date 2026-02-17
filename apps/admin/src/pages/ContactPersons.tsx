import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { Search, Plus, Trash2, Mail, Building, Users, ChevronRight, User } from 'lucide-react';

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
        .select('id, first_name, surname, company, department, email, phone, tags, created_at')
        .order('surname');
      
      if (error) throw error;
      setContacts(data || []);
    } catch (e) {
      console.error(e);
      // alert('Error loading contacts');
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
    (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const getInitials = (first: string, last: string) => {
      return (first?.[0] || '') + (last?.[0] || '');
  };

  if (loading) return (
      <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
      </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View>
             <Text style={styles.title}>Contact Persons</Text>
             <Text style={styles.subtitle}>Manage key contacts across all companies</Text>
        </View>
        <Button onClick={() => navigate('/contacts/new')} variant="primary" style={styles.addButton}>
            <Plus size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: '600' }}>Add Contact</Text>
        </Button>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
            <Search size={18} color="#94a3b8" style={styles.searchIcon} />
            <Input 
                value={search} 
                onChangeText={setSearch} 
                placeholder="Search by name, company or email..." 
                style={styles.searchInput}
            />
        </View>
        <View style={styles.statsBadge}>
            <Users size={14} color="#64748b" />
            <Text style={styles.statsText}>{filteredContacts.length} Contacts</Text>
        </View>
      </View>

      {/* Contacts List */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
         {filteredContacts.length === 0 ? (
             <View style={styles.emptyState}>
                 <Users size={48} color="#cbd5e1" />
                 <Text style={styles.emptyTitle}>No contacts found</Text>
                 <Text style={styles.emptyText}>Try adjusting your search criteria.</Text>
             </View>
         ) : (
             <View style={styles.grid}>
                 {filteredContacts.map(c => (
                     <TouchableOpacity 
                        key={c.id} 
                        style={styles.card}
                        onPress={() => navigate(`/contacts/${c.id}`)}
                     >
                         <View style={styles.cardHeader}>
                             <View style={styles.avatar}>
                                 <Text style={styles.avatarText}>{getInitials(c.first_name, c.surname)}</Text>
                             </View>
                             <View style={{ flex: 1 }}>
                                 <Text style={styles.name} numberOfLines={1}>{c.first_name} {c.surname}</Text>
                                 <Text style={styles.role} numberOfLines={1}>{c.department || 'No Department'}</Text>
                             </View>
                             <TouchableOpacity 
                                onPress={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                style={styles.deleteBtn}
                             >
                                 <Trash2 size={16} color="#ef4444" />
                             </TouchableOpacity>
                         </View>
                         
                         <View style={styles.divider} />
                         
                         <View style={styles.infoRow}>
                             <Building size={14} color="#94a3b8" />
                             <Text style={styles.infoText} numberOfLines={1}>{c.company || 'No Company'}</Text>
                         </View>
                         <View style={styles.infoRow}>
                             <Mail size={14} color="#94a3b8" />
                             <Text style={styles.infoText} numberOfLines={1}>{c.email || 'No Email'}</Text>
                         </View>

                         <View style={styles.hoverAction}>
                             <Text style={styles.viewText}>View Profile</Text>
                             <ChevronRight size={14} color="#3b82f6" />
                         </View>
                     </TouchableOpacity>
                 ))}
             </View>
         )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    gap: 24,
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto',
    height: '100%' // Ensure full height
  },
  loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8
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
  addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20
  },
  
  // Filter Bar
  filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16
  },
  searchContainer: {
      flex: 1,
      maxWidth: 400,
      position: 'relative'
  },
  searchInput: {
      paddingLeft: 40,
      backgroundColor: 'white',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 12,
      height: 44,
      shadowColor: '#64748b',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 } 
  },
  searchIcon: {
      position: 'absolute',
      left: 12,
      top: 13,
      zIndex: 10
  },
  statsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: '#f1f5f9',
      borderRadius: 20
  },
  statsText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#475569'
  },
  
  // Grid Layout for Cards
  content: {
      flex: 1,
  },
  grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20
  },
  
  // Contact Card
  card: {
      width: '31%', // roughly 3 columns
      minWidth: 280,
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      padding: 20,
      shadowColor: '#64748b',
      shadowOpacity: 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      // transition: 'transform 0.2s', // Web only, handled by hover usually
      elevation: 2
  },
  cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16
  },
  avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#eff6ff', // blue-50
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#dbeafe'
  },
  avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#3b82f6'
  },
  name: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f172a'
  },
  role: {
      fontSize: 13,
      color: '#64748b',
      marginTop: 2
  },
  deleteBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: '#fef2f2',
      alignSelf: 'flex-start'
  },
  divider: {
      height: 1,
      backgroundColor: '#f1f5f9',
      marginBottom: 16
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
  },
  infoText: {
      fontSize: 14,
      color: '#334155'
  },
  hoverAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 6
  },
  viewText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#3b82f6'
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    width: '100%'
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 4 },
});
