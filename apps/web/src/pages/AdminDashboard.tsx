import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { MainLayout } from '../components/MainLayout';
import { supabase } from '../lib/supabase';
import { Button, Card } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';

export function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Fetch profiles. Note: This requires the "Users can view profiles" policy 
    // we added in the FIX_DATABASE.sql script.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      alert('Error fetching users: ' + error.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const updateCompany = async (userId: string, companyName: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ company_name: companyName })
      .eq('id', userId);

    if (error) {
      alert('Failed to update company: ' + error.message);
    } else {
      alert('Company updated successfully');
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => 
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.first_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout title="Admin Dashboard">
      <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.subtitle}>Benutzerverwaltung & Firmenkunden</Text>
            <Button size="small" variant="outline" onClick={fetchUsers}>Refresh</Button>
        </View>

        <TextInput 
            style={styles.searchInput}
            placeholder="Benutzer suchen..."
            value={search}
            onChangeText={setSearch}
        />

        <ScrollView style={styles.list}>
          {filteredUsers.map(user => (
            <Card key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{user.email || 'No Email'}</Text>
                <Text style={styles.userName}>{user.first_name} {user.last_name}</Text>
                <Text style={styles.userId}>ID: {user.id}</Text>
              </View>

              <View style={styles.companySection}>
                <Text style={styles.label}>Firma:</Text>
                <TextInput 
                    style={styles.input}
                    defaultValue={user.company_name || ''}
                    placeholder="Firmenname eingeben"
                    onBlur={(e) => updateCompany(user.id, e.nativeEvent.text)} 
                />
              </View>
            </Card>
          ))}
          {filteredUsers.length === 0 && !loading && (
              <Text style={{ padding: 20 }}>Keine Benutzer gefunden. Stellen Sie sicher, dass die Datenbank-Policies korrekt gesetzt sind.</Text>
          )}
        </ScrollView>
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchInput: {
      backgroundColor: 'white',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.m,
  },
  list: {
    flex: 1,
  },
  userCard: {
    marginBottom: spacing.m,
    padding: spacing.m,
    flexDirection: 'row', // Responsive? Might want column on mobile
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16
  },
  userInfo: {
    flex: 1,
    minWidth: 200,
  },
  userEmail: {
    fontWeight: 'bold',
    fontSize: 16,
    color: colors.text,
  },
  userName: {
    color: colors.textSecondary,
  },
  userId: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  companySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 250,
  },
  label: {
      fontWeight: '600',
      color: colors.text,
  },
  input: {
      flex: 1,
      backgroundColor: '#f9f9f9',
      borderWidth: 1,
      borderColor: '#ddd',
      padding: 8,
      borderRadius: 4,
  }
});
