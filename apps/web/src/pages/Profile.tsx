import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { LayoutContext } from '../layouts/LayoutContext';
import { useToast } from '../components/ToastProvider';
import { colors } from '@docstruc/theme';
import { User, Mail, Phone, Building, Calendar, Shield, Save, Camera } from 'lucide-react';

export function Profile() {
    const { setTitle, setSubtitle } = useContext(LayoutContext);
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState({ 
        first_name: '', 
        last_name: '', 
        avatar_url: '',
        phone: '',
        company: '',
        position: ''
    });

    useEffect(() => {
        setTitle('Profil');
        setSubtitle('Verwalten Sie Ihre persönlichen Informationen und Einstellungen');
        
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                // Try to fetch profile from database
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    setProfile({
                        first_name: data.first_name || '',
                        last_name: data.last_name || '',
                        avatar_url: data.avatar_url || '',
                        phone: data.phone || '',
                        company: data.company || '',
                        position: data.position || ''
                    });
                } else {
                    // Fallback to metadata
                    setProfile({
                        first_name: user.user_metadata?.first_name || '',
                        last_name: user.user_metadata?.last_name || '',
                        avatar_url: user.user_metadata?.avatar_url || '',
                        phone: '',
                        company: '',
                        position: ''
                    });
                }
            }
        };
        getProfile();

        return () => {
            setTitle('DocStruc');
            setSubtitle('');
        };
    }, [setTitle, setSubtitle]);

    const handleSave = async () => {
        try {
            setLoading(true);
            
            const updates = {
                id: user.id,
                email: user.email,
                first_name: profile.first_name,
                last_name: profile.last_name,
                avatar_url: profile.avatar_url,
                phone: profile.phone,
                company: profile.company,
                position: profile.position,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates, {
                onConflict: 'id'
            });
            
            if (error) throw error;

            // Also update auth metadata
            await supabase.auth.updateUser({
                data: { 
                    first_name: profile.first_name, 
                    last_name: profile.last_name,
                    avatar_url: profile.avatar_url
                }
            });

            showToast('Profil erfolgreich aktualisiert!', 'success');
        } catch (error: any) {
            showToast('Fehler beim Speichern: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async () => {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                setLoading(true);
                
                // Upload to Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}-${Math.random()}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                setProfile({ ...profile, avatar_url: data.publicUrl });
                showToast('Profilbild erfolgreich hochgeladen!', 'success');
            } catch (error: any) {
                showToast('Fehler beim Hochladen: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        input.click();
    };

    const displayName = profile.first_name && profile.last_name 
        ? `${profile.first_name} ${profile.last_name}` 
        : 'Benutzer';
    const initials = displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const joinedDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Profile Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        {profile.avatar_url ? (
                            <img 
                                src={profile.avatar_url} 
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: 60,
                                    objectFit: 'cover' as any,
                                }} 
                                alt="Profile"
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                        )}
                        <TouchableOpacity 
                            style={styles.avatarEditBtn}
                            onPress={handleAvatarUpload}
                            activeOpacity={0.8}
                        >
                            <Camera size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>{displayName}</Text>
                    <View style={styles.headerMeta}>
                        <Mail size={14} color="#64748b" />
                        <Text style={styles.headerEmail}>{user?.email}</Text>
                    </View>
                    {joinedDate && (
                        <View style={styles.headerMeta}>
                            <Calendar size={14} color="#64748b" />
                            <Text style={styles.headerDate}>Mitglied seit {joinedDate}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Personal Information */}
            <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <User size={20} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Persönliche Informationen</Text>
                </View>
                
                <View style={styles.formRow}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Vorname *</Text>
                        <Input 
                            value={profile.first_name} 
                            onChangeText={(t) => setProfile({...profile, first_name: t})}
                            placeholder="Max" 
                        />
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Nachname *</Text>
                        <Input 
                            value={profile.last_name} 
                            onChangeText={(t) => setProfile({...profile, last_name: t})} 
                            placeholder="Mustermann"
                        />
                    </View>
                </View>

                <View style={styles.formRow}>
                    <View style={styles.col}>
                        <Text style={styles.label}>E-Mail-Adresse</Text>
                        <View style={styles.readonlyInput}>
                            <Mail size={16} color="#94a3b8" />
                            <Text style={styles.readonlyText}>{user?.email}</Text>
                        </View>
                        <Text style={styles.helperText}>E-Mail kann nicht geändert werden. Kontaktieren Sie den Support.</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Telefon</Text>
                        <Input 
                            value={profile.phone} 
                            onChangeText={(t) => setProfile({...profile, phone: t})} 
                            placeholder="+49 123 456789"
                        />
                    </View>
                </View>
            </View>

            {/* Company Information */}
            <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <Building size={20} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Unternehmensinformationen</Text>
                </View>
                
                <View style={styles.formRow}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Unternehmen</Text>
                        <Input 
                            value={profile.company} 
                            onChangeText={(t) => setProfile({...profile, company: t})}
                            placeholder="Muster GmbH" 
                        />
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Position</Text>
                        <Input 
                            value={profile.position} 
                            onChangeText={(t) => setProfile({...profile, position: t})} 
                            placeholder="Projektmanager"
                        />
                    </View>
                </View>
            </View>

            {/* Security */}
            <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <Shield size={20} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Sicherheit</Text>
                </View>
                <View style={styles.securitySection}>
                    <View style={styles.securityItem}>
                        <View>
                            <Text style={styles.securityTitle}>Passwort zurücksetzen</Text>
                            <Text style={styles.securityDesc}>
                                Wir senden Ihnen eine E-Mail mit einem Link zum Zurücksetzen Ihres Passworts.
                            </Text>
                        </View>
                        <Button 
                            onClick={() => {
                                supabase.auth.resetPasswordForEmail(user?.email);
                                showToast('Password-Reset-Link wurde an Ihre E-Mail gesendet!', 'success');
                            }} 
                            variant="secondary"
                        >
                            Passwort zurücksetzen
                        </Button>
                    </View>
                </View>
            </View>

            {/* Save Button */}
            <View style={styles.actionBar}>
                <Button 
                    onClick={handleSave} 
                    variant="primary"
                    disabled={loading}
                >
                    <View style={styles.btnContent}>
                        <Save size={18} color="#FFFFFF" />
                        <Text style={styles.btnText}>
                            {loading ? 'Wird gespeichert...' : 'Änderungen speichern'}
                        </Text>
                    </View>
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    contentContainer: {
        padding: 24,
        maxWidth: 1000,
        width: '100%',
        alignSelf: 'center',
    },
    headerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 32,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
    },
    avatarSection: {
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative' as any,
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    avatarEditBtn: {
        position: 'absolute' as any,
        bottom: 4,
        right: 4,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    headerInfo: {
        flex: 1,
        gap: 8,
    },
    headerName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 4,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerEmail: {
        fontSize: 14,
        color: '#64748b',
    },
    headerDate: {
        fontSize: 13,
        color: '#64748b',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0F172A',
    },
    formRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    col: {
        flex: 1,
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
        marginBottom: 4,
    },
    readonlyInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    readonlyText: {
        fontSize: 14,
        color: '#64748b',
        flex: 1,
    },
    helperText: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 4,
    },
    securitySection: {
        gap: 16,
    },
    securityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        gap: 16,
    },
    securityTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 4,
    },
    securityDesc: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    actionBar: {
        alignItems: 'flex-start',
        paddingVertical: 8,
    },
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});
