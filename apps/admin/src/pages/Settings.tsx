import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { Button } from '@docstruc/ui';
import { Select } from '../components/Select';
import { Settings as SettingsIcon, Bell, Globe, Moon, Download } from 'lucide-react';

export default function Settings() {
    // Mock State
    const [language, setLanguage] = useState<string>('en');
    const [dateFormat, setDateFormat] = useState<string>('mm/dd/yyyy');
    const [notifications, setNotifications] = useState(true);
    const [marketing, setMarketing] = useState(false);

    const handleSave = () => {
        // Just mock visual feedback
        alert('Settings saved successfully!');
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                 <Text style={styles.pageTitle}>Settings</Text>
                 <Text style={styles.pageSubtitle}>Configure the admin panel behavior.</Text>
            </View>

            <View style={styles.grid}>
                {/* General Settings */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Globe size={20} color="#6366f1" />
                        <Text style={styles.cardTitle}>Localization</Text>
                    </View>
                    <View style={{ gap: 16 }}>
                        <Select 
                            label="Language" 
                            value={language}
                            onChange={(v) => setLanguage(String(v))}
                            options={[
                                { label: 'English (US)', value: 'en' },
                                { label: 'German (DE)', value: 'de' },
                                { label: 'French (FR)', value: 'fr' }
                            ]}
                        />
                         <Select 
                            label="Date Format" 
                            value={dateFormat}
                            onChange={(v) => setDateFormat(String(v))}
                            options={[
                                { label: 'MM/DD/YYYY', value: 'mm/dd/yyyy' },
                                { label: 'DD.MM.YYYY', value: 'dd.mm.yyyy' },
                                { label: 'YYYY-MM-DD', value: 'yyyy-mm-dd' }
                            ]}
                        />
                    </View>
                </View>

                {/* Notifications */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Bell size={20} color="#6366f1" />
                        <Text style={styles.cardTitle}>Notifications</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>Email Alerts</Text>
                            <Text style={styles.rowDesc}>Receive emails about new customers.</Text>
                        </View>
                         <Switch value={notifications} onValueChange={setNotifications} />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                         <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>Weekly Reports</Text>
                            <Text style={styles.rowDesc}>Receive weekly summary pdfs.</Text>
                        </View>
                         <Switch value={marketing} onValueChange={setMarketing} />
                    </View>
                </View>

                {/* Appearance */}
                 <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Moon size={20} color="#6366f1" />
                        <Text style={styles.cardTitle}>Appearance</Text>
                    </View>
                    <Text style={{ color: '#64748b', marginBottom: 16 }}>Theme customization coming soon.</Text>
                    <Button variant="secondary" onClick={() => {}} disabled>Switch to Dark Mode</Button>
                </View>

                {/* Data */}
                 <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Download size={20} color="#6366f1" />
                        <Text style={styles.cardTitle}>Data Export</Text>
                    </View>
                    <Text style={{ color: '#64748b', marginBottom: 16 }}>Download a full backup of your admin data.</Text>
                    <Button variant="outline" onClick={() => alert('Export started...')}>Export Data (CSV)</Button>
                </View>
            </View>
            
            <View style={{ marginBottom: 40, marginTop: 24, alignSelf: 'flex-start' }}>
                 <Button variant="primary" onClick={handleSave}>Save Preference</Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        maxWidth: 1000,
        width: '100%',
        alignSelf: 'center',
        paddingBottom: 40
    },
    header: { marginBottom: 24 },
    pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: '#64748b' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    card: {
        flex: 1,
        minWidth: 300,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    rowTitle: { fontSize: 14, fontWeight: '500', color: '#334155' },
    rowDesc: { fontSize: 13, color: '#94a3b8' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 }
});
