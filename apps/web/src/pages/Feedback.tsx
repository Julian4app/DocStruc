import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput as RNTextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@docstruc/ui';
import { CustomSelect } from '../components/CustomSelect';
import { useToast } from '../components/ToastProvider';
import { LayoutContext } from '../layouts/LayoutContext';
import { colors } from '@docstruc/theme';
import { MessageSquare, Star, Send, ThumbsUp, AlertCircle, Mail } from 'lucide-react';

export function Feedback() {
  const { setTitle, setSubtitle } = useContext(LayoutContext);
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle('Feedback');
    setSubtitle('Teilen Sie uns Ihre Meinung mit');
    
    // Load user email
    const loadUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    };
    loadUserEmail();
    
    return () => {
      setTitle('DocStruc');
      setSubtitle('');
    };
  }, [setTitle, setSubtitle]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      showToast('Bitte geben Sie eine Nachricht ein', 'info');
      return;
    }

    if (!email.trim()) {
      showToast('Bitte geben Sie Ihre E-Mail-Adresse ein', 'info');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        rating,
        category,
        email,
        message,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      showToast('Vielen Dank für Ihr Feedback! Wir haben Ihre Nachricht erhalten.', 'success');
      setMessage('');
      setRating(0);
      setCategory('general');
    } catch (error: any) {
      showToast('Fehler: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <MessageSquare size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Wir freuen uns auf Ihr Feedback</Text>
          <Text style={styles.subtitle}>
            Helfen Sie uns, DocStruc zu verbessern. Ihre Meinung ist uns wichtig!
          </Text>
        </View>

        {/* Feedback Form */}
        <View style={styles.card}>
          {/* Rating */}
          <View style={styles.section}>
            <Text style={styles.label}>Wie zufrieden sind Sie mit DocStruc?</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 8,
                  }}
                >
                  <Star
                    size={32}
                    color={star <= rating ? '#fbbf24' : '#cbd5e1'}
                    fill={star <= rating ? '#fbbf24' : 'none'}
                  />
                </button>
              ))}
            </View>
            <Text style={styles.ratingLabel}>
              {rating === 0 && 'Bitte bewerten Sie'}
              {rating === 1 && 'Sehr unzufrieden'}
              {rating === 2 && 'Unzufrieden'}
              {rating === 3 && 'Neutral'}
              {rating === 4 && 'Zufrieden'}
              {rating === 5 && 'Sehr zufrieden'}
            </Text>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Kategorie</Text>
            <CustomSelect
              value={category}
              onChange={(val) => setCategory(val as string)}
              options={[
                { value: 'general', label: 'Allgemeines Feedback' },
                { value: 'feature', label: 'Feature-Wunsch' },
                { value: 'bug', label: 'Bug-Report' },
                { value: 'ui', label: 'Benutzeroberfläche' },
                { value: 'performance', label: 'Performance' },
                { value: 'other', label: 'Sonstiges' },
              ]}
              placeholder="Kategorie auswählen"
            />
          </View>

          {/* Email */}
          <View style={styles.section}>
            <Text style={styles.label}>E-Mail-Adresse</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="ihre.email@beispiel.de"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Wir verwenden Ihre E-Mail nur, um auf Ihr Feedback zu antworten.
            </Text>
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.label}>Ihre Nachricht</Text>
            <RNTextInput
              style={styles.textarea as any}
              value={message}
              onChangeText={setMessage}
              placeholder="Beschreiben Sie Ihr Anliegen..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={8}
            />
            <Text style={styles.hint}>
              Mindestens 10 Zeichen. Bitte seien Sie so detailliert wie möglich.
            </Text>
          </View>

          {/* Submit */}
          <View style={styles.buttonContainer}>
            <Button
              onClick={handleSubmit}
              variant="primary"
              disabled={loading || !message.trim()}
            >
              {loading ? 'Wird gesendet...' : 'Feedback senden'}
            </Button>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <ThumbsUp size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>Schnelle Antwort</Text>
            <Text style={styles.infoText}>
              Wir lesen jedes Feedback und antworten in der Regel innerhalb von 24 Stunden.
            </Text>
          </View>
          <View style={styles.infoCard}>
            <AlertCircle size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>Dringender Support?</Text>
            <Text style={styles.infoText}>
              Bei technischen Problemen wenden Sie sich bitte an unser Support-Team.
            </Text>
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
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center' as any,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center' as any,
    maxWidth: 500,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center' as any,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#FFFFFF',
    minHeight: 160,
    textAlignVertical: 'top',
    fontFamily: 'system-ui',
  },
  hint: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
  buttonContainer: {
    alignItems: 'flex-start',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    textAlign: 'center' as any,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    textAlign: 'center' as any,
  },
});
