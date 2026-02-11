import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  Video, 
  MessageCircle,
  ChevronRight,
  ExternalLink,
  FileText,
  Lightbulb
} from 'lucide-react';

export function Help() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    setTitle('Hilfe Center');
    setSubtitle('Finden Sie Antworten und Anleitungen');
    return () => {
      setTitle('DocStruc');
      setSubtitle('');
    };
  }, [setTitle, setSubtitle]);

  const quickLinks = [
    { icon: BookOpen, title: 'Erste Schritte', desc: 'Lernen Sie die Grundlagen', color: '#3b82f6' },
    { icon: Video, title: 'Video Tutorials', desc: 'Schritt-für-Schritt Anleitungen', color: '#8b5cf6' },
    { icon: MessageCircle, title: 'Support kontaktieren', desc: 'Persönliche Hilfe erhalten', color: '#10b981' },
    { icon: FileText, title: 'Dokumentation', desc: 'Vollständige Referenz', color: '#f59e0b' },
  ];

  const faqs = [
    {
      question: 'Wie erstelle ich ein neues Projekt?',
      answer: 'Um ein neues Projekt zu erstellen, klicken Sie auf der Dashboard-Seite auf den Button "Neues Projekt". Geben Sie die erforderlichen Informationen wie Projektname, Adresse und Beschreibung ein. Nach dem Speichern können Sie sofort mit der Strukturierung beginnen.',
    },
    {
      question: 'Wie füge ich Teammitglieder hinzu?',
      answer: 'Öffnen Sie ein Projekt und navigieren Sie zur Registerkarte "Mitglieder". Klicken Sie auf "Mitglied hinzufügen" und geben Sie die E-Mail-Adresse der Person ein. Sie können auch Berechtigungen festlegen (Anzeigen, Bearbeiten, Verwalten).',
    },
    {
      question: 'Wie exportiere ich Projektdaten?',
      answer: 'In jedem Projekt finden Sie im Menü die Option "Exportieren". Wählen Sie das gewünschte Format (PDF, Excel, CSV) und die zu exportierenden Daten aus. Der Export wird automatisch heruntergeladen.',
    },
    {
      question: 'Sind meine Daten sicher?',
      answer: 'Ja, wir nehmen Datensicherheit sehr ernst. Alle Daten werden verschlüsselt übertragen und in ISO 27001 zertifizierten Rechenzentren gespeichert. Wir führen regelmäßige Sicherheitsaudits durch und sind vollständig DSGVO-konform.',
    },
    {
      question: 'Kann ich DocStruc auf dem Smartphone nutzen?',
      answer: 'Ja, DocStruc ist vollständig responsive und funktioniert auf allen Geräten. Zusätzlich bieten wir native Apps für iOS und Android mit erweiterten Funktionen wie Offline-Zugriff und Push-Benachrichtigungen.',
    },
    {
      question: 'Wie funktioniert die Zusammenarbeit im Team?',
      answer: 'DocStruc ermöglicht Echtzeit-Zusammenarbeit. Mehrere Benutzer können gleichzeitig an einem Projekt arbeiten. Änderungen werden sofort synchronisiert und Sie sehen, wer gerade online ist. Über Kommentare und @-Mentions können Sie direkt kommunizieren.',
    },
    {
      question: 'Welche Zahlungsmethoden werden akzeptiert?',
      answer: 'Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express), SEPA-Lastschrift und PayPal. Für Firmenkunden bieten wir auch Rechnungszahlung an.',
    },
    {
      question: 'Kann ich mein Abonnement jederzeit kündigen?',
      answer: 'Ja, Sie können Ihr Abonnement jederzeit mit einem Klick kündigen. Es gibt keine Kündigungsfrist. Sie haben bis zum Ende des bezahlten Zeitraums vollen Zugriff auf alle Funktionen.',
    },
  ];

  const categories = [
    { title: 'Projektmanagement', icon: Lightbulb, articles: 12 },
    { title: 'Strukturverwaltung', icon: FileText, articles: 8 },
    { title: 'Teamarbeit', icon: MessageCircle, articles: 6 },
    { title: 'Sicherheit', icon: HelpCircle, articles: 5 },
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <HelpCircle size={32} color="#fff" />
          </View>
          <Text style={styles.title}>Wie können wir helfen?</Text>
          <Text style={styles.subtitle}>
            Durchsuchen Sie unsere Wissensdatenbank oder kontaktieren Sie unser Support-Team
          </Text>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search size={20} color="#94a3b8" />
            <RNTextInput
              style={styles.searchInput as any}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Suchen Sie nach Themen oder Fragen..."
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinksGrid}>
          {quickLinks.map((link, index) => {
            const Icon = link.icon;
            return (
              <TouchableOpacity key={index} style={styles.quickLinkCard} activeOpacity={0.7}>
                <View style={[styles.quickLinkIcon, { backgroundColor: link.color + '20' }]}>
                  <Icon size={24} color={link.color} />
                </View>
                <Text style={styles.quickLinkTitle}>{link.title}</Text>
                <Text style={styles.quickLinkDesc}>{link.desc}</Text>
                <ChevronRight size={18} color="#94a3b8" style={{ marginTop: 8 }} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategorien durchsuchen</Text>
          <View style={styles.categoriesGrid}>
            {categories.map((cat, index) => {
              const Icon = cat.icon;
              return (
                <TouchableOpacity key={index} style={styles.categoryCard} activeOpacity={0.7}>
                  <Icon size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryTitle}>{cat.title}</Text>
                    <Text style={styles.categoryCount}>{cat.articles} Artikel</Text>
                  </View>
                  <ChevronRight size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Häufig gestellte Fragen</Text>
          <View style={styles.faqList}>
            {filteredFaqs.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={styles.faqItem}
                activeOpacity={0.7}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <ChevronRight
                    size={20}
                    color="#94a3b8"
                    style={{
                      transform: [{ rotate: expandedFaq === index ? '90deg' : '0deg' }],
                    } as any}
                  />
                </View>
                {expandedFaq === index && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Support */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Haben Sie noch Fragen?</Text>
          <Text style={styles.supportText}>
            Unser Support-Team ist für Sie da und hilft Ihnen gerne weiter.
          </Text>
          <View style={styles.supportButtons}>
            <TouchableOpacity style={styles.supportButton} activeOpacity={0.7}>
              <MessageCircle size={18} color="#fff" />
              <Text style={styles.supportButtonText}>Chat starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.supportButton, styles.supportButtonSecondary]} activeOpacity={0.7}>
              <ExternalLink size={18} color={colors.primary} />
              <Text style={[styles.supportButtonText, { color: colors.primary }]}>
                E-Mail senden
              </Text>
            </TouchableOpacity>
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
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center' as any,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center' as any,
    maxWidth: 600,
    marginBottom: 32,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    height: 56,
    width: '100%',
    maxWidth: 600,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    outline: 'none',
    border: 'none',
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 48,
  },
  quickLinkCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  quickLinkIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quickLinkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center' as any,
  },
  quickLinkDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center' as any,
  },
  section: {
    marginBottom: 48,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 24,
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    cursor: 'pointer' as any,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  faqList: {
    gap: 12,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    cursor: 'pointer' as any,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  faqAnswer: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
    color: '#64748b',
  },
  supportCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 40,
  },
  supportTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center' as any,
  },
  supportText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center' as any,
    marginBottom: 24,
    maxWidth: 500,
  },
  supportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    cursor: 'pointer' as any,
  },
  supportButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
