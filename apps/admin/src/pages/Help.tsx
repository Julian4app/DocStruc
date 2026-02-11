import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  Video, 
  MessageCircle,
  ChevronRight,
  FileText
} from 'lucide-react';

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const quickLinks = [
    { icon: BookOpen, title: 'Erste Schritte', color: '#3b82f6' },
    { icon: Video, title: 'Video Tutorials', color: '#8b5cf6' },
    { icon: MessageCircle, title: 'Support kontaktieren', color: '#10b981' },
    { icon: FileText, title: 'Dokumentation', color: '#f59e0b' },
  ];

  const faqs = [
    {
      question: 'Wie erstelle ich einen neuen Kunden?',
      answer: 'Klicken Sie auf der Kunden-Seite auf "Neuer Kunde" und geben Sie die erforderlichen Informationen ein.',
    },
    {
      question: 'Wie verwalte ich Abonnements?',
      answer: 'Navigieren Sie zur Abonnements-Seite, wo Sie alle aktiven und abgelaufenen Abonnements verwalten können.',
    },
    {
      question: 'Wie exportiere ich Kundendaten?',
      answer: 'In der Kundenübersicht finden Sie die Export-Funktion. Wählen Sie das gewünschte Format (CSV, Excel, PDF).',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <HelpCircle size={32} color="#fff" />
          </View>
          <Text style={styles.title}>Hilfe Center</Text>
          <Text style={styles.subtitle}>
            Durchsuchen Sie unsere Wissensdatenbank
          </Text>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search size={20} color="#94a3b8" />
            <RNTextInput
              style={styles.searchInput as any}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Suchen..."
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Häufig gestellte Fragen</Text>
          <View style={styles.faqList}>
            {faqs.map((faq, index) => (
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
    backgroundColor: '#3b82f6',
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
    minWidth: 200,
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
});
