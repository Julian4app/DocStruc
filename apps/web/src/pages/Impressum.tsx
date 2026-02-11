import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LayoutContext } from '../layouts/LayoutContext';
import { Building, Mail, Phone, MapPin, Globe } from 'lucide-react';

export function Impressum() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);

  useEffect(() => {
    setTitle('Impressum');
    setSubtitle('Angaben gemäß § 5 TMG');
    return () => {
      setTitle('DocStruc');
      setSubtitle('');
    };
  }, [setTitle, setSubtitle]);

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

        {/* Regulatory Authority */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aufsichtsbehörde</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Gewerbeaufsichtsamt Musterstadt
            </Text>
            <Text style={styles.infoText}>Behördenstraße 1</Text>
            <Text style={styles.infoText}>12345 Musterstadt</Text>
          </View>
        </View>

        {/* Dispute Resolution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streitschlichtung</Text>
          <Text style={styles.text}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
            https://ec.europa.eu/consumers/odr
          </Text>
          <Text style={styles.text}>
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </Text>
          <Text style={styles.text}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
            Verbraucherschlichtungsstelle teilzunehmen.
          </Text>
        </View>

        {/* Liability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Haftung für Inhalte</Text>
          <Text style={styles.text}>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den 
            allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch 
            nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach 
            Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </Text>
          <Text style={styles.text}>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen 
            Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt 
            der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden 
            Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </Text>
        </View>

        {/* Copyright */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urheberrecht</Text>
          <Text style={styles.text}>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem 
            deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung 
            außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen 
            Autors bzw. Erstellers.
          </Text>
          <Text style={styles.text}>
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. 
            Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte 
            Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem 
            auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei 
            Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </Text>
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
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 12,
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
