import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Shield, Lock, Eye, Database, UserCheck, FileText } from 'lucide-react';

export default function Datenschutz() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Shield size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Datenschutzerklärung</Text>
          <Text style={styles.subtitle}>
            Zuletzt aktualisiert: 10. Februar 2026
          </Text>
        </View>

        {/* Section 1 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>1. Allgemeine Hinweise</Text>
          </View>
          <Text style={styles.text}>
            Der Schutz Ihrer persönlichen Daten ist uns ein besonderes Anliegen. Wir verarbeiten Ihre Daten 
            daher ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG 2003). In diesen 
            Datenschutzinformationen informieren wir Sie über die wichtigsten Aspekte der Datenverarbeitung 
            im Rahmen unserer Anwendung.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Database size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>2. Datenerfassung und -verarbeitung</Text>
          </View>
          <Text style={styles.text}>
            Wir erheben und verarbeiten folgende personenbezogene Daten:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Name und Kontaktinformationen (E-Mail-Adresse)</Text>
            <Text style={styles.listItem}>• Profilinformationen (Profilbild, optional)</Text>
            <Text style={styles.listItem}>• Nutzungsdaten (Projekt- und Aktivitätsinformationen)</Text>
            <Text style={styles.listItem}>• Technische Daten (IP-Adresse, Browser-Informationen)</Text>
          </View>
          <Text style={styles.text}>
            Die Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) 
            sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung und Verbesserung 
            unserer Dienste).
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lock size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>3. Datensicherheit</Text>
          </View>
          <Text style={styles.text}>
            Wir verwenden modernste Sicherheitsmaßnahmen zum Schutz Ihrer Daten:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• SSL/TLS-Verschlüsselung für alle Datenübertragungen</Text>
            <Text style={styles.listItem}>• Sichere Speicherung in ISO 27001 zertifizierten Rechenzentren</Text>
            <Text style={styles.listItem}>• Regelmäßige Sicherheitsaudits und Updates</Text>
            <Text style={styles.listItem}>• Zugriffskontrolle und Authentifizierung</Text>
            <Text style={styles.listItem}>• Regelmäßige Backups zur Datensicherung</Text>
          </View>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <UserCheck size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>4. Ihre Rechte</Text>
          </View>
          <Text style={styles.text}>
            Sie haben gemäß DSGVO folgende Rechte:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Auskunftsrecht (Art. 15 DSGVO):</Text> Sie können Auskunft über Ihre gespeicherten Daten verlangen</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Berichtigungsrecht (Art. 16 DSGVO):</Text> Sie können die Korrektur unrichtiger Daten verlangen</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Löschungsrecht (Art. 17 DSGVO):</Text> Sie können die Löschung Ihrer Daten verlangen</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Einschränkungsrecht (Art. 18 DSGVO):</Text> Sie können die Einschränkung der Verarbeitung verlangen</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Widerspruchsrecht (Art. 21 DSGVO):</Text> Sie können der Verarbeitung widersprechen</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Datenübertragbarkeit (Art. 20 DSGVO):</Text> Sie können Ihre Daten in einem strukturierten Format erhalten</Text>
          </View>
          <Text style={styles.text}>
            Zur Ausübung Ihrer Rechte können Sie sich jederzeit an unseren Datenschutzbeauftragten wenden.
          </Text>
        </View>

        {/* Contact */}
        <View style={[styles.section, styles.contactSection]}>
          <Text style={styles.sectionTitle}>Kontakt zum Datenschutzbeauftragten</Text>
          <Text style={styles.text}>
            Bei Fragen zum Datenschutz können Sie sich jederzeit an uns wenden:
          </Text>
          <View style={styles.contactBox}>
            <Text style={styles.contactText}>E-Mail: datenschutz@docstruc.com</Text>
            <Text style={styles.contactText}>Telefon: +49 (0) 123 456789</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center' as any,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 16,
  },
  list: {
    gap: 12,
    marginBottom: 16,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  bold: {
    fontWeight: '600',
    color: '#0f172a',
  },
  contactSection: {
    backgroundColor: '#F8FAFC',
  },
  contactBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactText: {
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 8,
  },
});
