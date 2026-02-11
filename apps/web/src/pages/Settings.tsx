import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { CustomSelect } from '../components/CustomSelect';
import { useToast } from '../components/ToastProvider';
import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { Settings as SettingsIcon, Bell, Globe, Moon, Shield, Mail } from 'lucide-react';

export function Settings() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    projectUpdates: true,
    weeklyReports: false,
    marketingEmails: false,
    language: 'de',
    timezone: 'Europe/Berlin',
    darkMode: false,
  });

  useEffect(() => {
    setTitle('Einstellungen');
    setSubtitle('Verwalten Sie Ihre Präferenzen und Kontoeinstellungen');
    
    // Load settings from database
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', user.id)
          .single();

        if (data?.settings) {
          setSettings({ ...settings, ...data.settings });
        }
      } catch (error) {
        // Ignore error if no settings found
      }
    };
    
    loadSettings();
    
    return () => {
      setTitle('DocStruc');
      setSubtitle('');
    };
  }, [setTitle, setSubtitle]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save to user_settings table
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: settings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      showToast('Einstellungen erfolgreich gespeichert!', 'success');
    } catch (error: any) {
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {/* Notification Settings */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bell size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Benachrichtigungen</Text>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>E-Mail Benachrichtigungen</Text>
                <Text style={styles.settingDesc}>Erhalten Sie Benachrichtigungen per E-Mail</Text>
              </View>
              <Switch
                value={settings.emailNotifications}
                onValueChange={(val) => setSettings({ ...settings, emailNotifications: val })}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Projekt Updates</Text>
                <Text style={styles.settingDesc}>Benachrichtigungen bei Projektänderungen</Text>
              </View>
              <Switch
                value={settings.projectUpdates}
                onValueChange={(val) => setSettings({ ...settings, projectUpdates: val })}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Wöchentliche Berichte</Text>
                <Text style={styles.settingDesc}>Zusammenfassung Ihrer Aktivitäten</Text>
              </View>
              <Switch
                value={settings.weeklyReports}
                onValueChange={(val) => setSettings({ ...settings, weeklyReports: val })}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Marketing E-Mails</Text>
                <Text style={styles.settingDesc}>Neuigkeiten und Angebote erhalten</Text>
              </View>
              <Switch
                value={settings.marketingEmails}
                onValueChange={(val) => setSettings({ ...settings, marketingEmails: val })}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
          </View>
        </View>

        {/* Language & Region */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Globe size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Sprache & Region</Text>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sprache</Text>
              <CustomSelect
                value={settings.language}
                onChange={(val) => setSettings({ ...settings, language: val as string })}
                options={[
                  { value: 'de', label: 'Deutsch' },
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                  { value: 'es', label: 'Español' },
                  { value: 'it', label: 'Italiano' },
                ]}
                placeholder="Sprache auswählen"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Zeitzone</Text>
              <CustomSelect
                value={settings.timezone}
                onChange={(val) => setSettings({ ...settings, timezone: val as string })}
                options={[
                  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
                  { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
                  { value: 'America/New_York', label: 'America/New York (GMT-5)' },
                  { value: 'America/Los_Angeles', label: 'America/Los Angeles (GMT-8)' },
                  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
                ]}
                placeholder="Zeitzone auswählen"
              />
            </View>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Moon size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Darstellung</Text>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDesc}>Dunkles Design aktivieren</Text>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={(val) => setSettings({ ...settings, darkMode: val })}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button onClick={handleSave} variant="primary" disabled={loading}>
          {loading ? 'Speichern...' : 'Einstellungen Speichern'}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 40,
  },
  grid: {
    gap: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  settingsList: {
    gap: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  footer: {
    marginTop: 32,
    alignItems: 'flex-start',
  },
});
