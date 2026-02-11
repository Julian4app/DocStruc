import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Building, Mail, Phone, MapPin, Globe } from 'lucide-react';

export default function Impressum() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Building size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Impressum</Text>
          <Text style={styles.subtitle}>
            Angaben gemäß § 5 Telemediengesetz (TMG)
          </Text>
        </View>

        {/* Company Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anbieter</Text>
          <View style={styles.infoBox}>
            <Text style={styles.companyName}>DocStruc GmbH</Text>
            <View style={styles.infoRow}>
              <MapPin size={16} color="#64748b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoText}>Musterstraße 123</Text>
                <Text style={styles.infoText}>12345 Musterstadt</Text>
                <Text style={styles.infoText}>Deutschland</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontakt</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Phone size={16} color="#64748b" />
              <Text style={styles.infoText}>+49 (0) 123 456789</Text>
            </View>
            <View style={styles.infoRow}>
              <Mail size={16} color="#64748b" />
              <Text style={styles.infoText}>info@docstruc.com</Text>
            </View>
            <View style={styles.infoRow}>
              <Globe size={16} color="#64748b" />
              <Text style={styles.infoText}>www.docstruc.com</Text>
            </View>
          </View>
        </View>

        {/* Legal Representatives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vertretungsberechtigte Geschäftsführer</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Max Mustermann</Text>
            <Text style={styles.infoText}>Erika Musterfrau</Text>
          </View>
        </View>

        {/* Register */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registereintrag</Text>
          <View style={styles.infoBox}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Registergericht:</Text>
              <Text style={styles.value}>Amtsgericht Musterstadt</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Registernummer:</Text>
              <Text style={styles.value}>HRB 12345</Text>
            </View>
          </View>
        </View>

        {/* Tax */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Umsatzsteuer-Identifikationsnummer</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:
            </Text>
            <Text style={styles.taxId}>DE123456789</Text>
          </View>
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Stand: 10. Februar 2026
          </Text>
          <Text style={styles.footerText}>
            Dieses Impressum gilt für alle Plattformen und Anwendungen der DocStruc GmbH.
          </Text>
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
    textAlign: 'center' as any,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  value: {
    fontSize: 15,
    color: '#0f172a',
  },
  taxId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  footerNote: {
    marginTop: 32,
    marginBottom: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center' as any,
    marginBottom: 4,
  },
});
