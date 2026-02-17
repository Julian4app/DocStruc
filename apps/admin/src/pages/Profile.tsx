import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { User, Mail, Shield, Save } from 'lucide-react';

export default function Profile() {
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState({ first_name: '', last_name: '', avatar_url: '' });

    useEffect(() => {
        const getProfile = async () => {
             const { data: { user } } = await supabase.auth.getUser();
             setUser(user);
             if (user) {
                 // Try to fetch profile from public.profiles or meta
                 // We will use meta as fallback or if profiles table is empty/RLS restricted
                 const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                 if (data) {
                     setProfile(data);
                 } else {
                     // Fallback to metadata
                     setProfile({
                         first_name: user.user_metadata?.first_name || '',
                         last_name: user.user_metadata?.last_name || '',
                         avatar_url: user.user_metadata?.avatar_url || ''
                     });
                 }
             }
        };
        getProfile();
    }, []);

    const handleSave = async () => {
        try {
            setLoading(true);
            const updates = {
                id: user.id,
                first_name: profile.first_name,
                last_name: profile.last_name,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);
            
            // Also update auth meta
            await supabase.auth.updateUser({
                data: { first_name: profile.first_name, last_name: profile.last_name }
            });

            if (error) throw error;
            alert('Profile updated!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
             <View style={styles.header}>
                 <Text style={styles.pageTitle}>My Profile</Text>
                 <Text style={styles.pageSubtitle}>Manage your account settings and preferences.</Text>
             </View>

             <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <User size={20} color="#6366f1" />
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>
                
                <View style={styles.formRow}>
                    <View style={styles.col}>
                        <Text style={styles.label}>First Name</Text>
                        <Input 
                            value={profile.first_name} 
                            onChangeText={(t) => setProfile({...profile, first_name: t})}
                            placeholder="John" 
                        />
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Last Name</Text>
                        <Input 
                            value={profile.last_name} 
                            onChangeText={(t) => setProfile({...profile, last_name: t})} 
                            placeholder="Doe"
                        />
                    </View>
                </View>

                <View style={styles.formRow}>
                     <View style={styles.col}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.readonlyInput}>
                            <Mail size={16} color="#94a3b8" />
                            <Text style={styles.readonlyText}>{user?.email}</Text>
                        </View>
                        <Text style={styles.helperText}>Email cannot be changed contact support.</Text>
                    </View>
                </View>

                <View style={{ marginTop: 24, alignItems: 'flex-start' }}>
                    <Button onClick={handleSave} variant="primary">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </View>
             </View>

             <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <Shield size={20} color="#6366f1" />
                    <Text style={styles.sectionTitle}>Security</Text>
                </View>
                <View style={{ paddingVertical: 12 }}>
                    <Button onClick={() => supabase.auth.resetPasswordForEmail(user?.email)} variant="secondary">
                        Send Password Reset Email
                    </Button>
                </View>
             </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        paddingVertical: 24
    },
    header: {
        marginBottom: 24
    },
    pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: '#64748b' },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
    formRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
    col: { flex: 1, gap: 8 },
    label: { fontSize: 14, fontWeight: '500', color: '#334155' },
    readonlyInput: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    readonlyText: { fontSize: 14, color: '#64748b' },
    helperText: { fontSize: 12, color: '#94a3b8' }
});
