import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput as RNTextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';
import { MessageSquare, Star, ThumbsUp } from 'lucide-react';

export default function Feedback() {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      alert('Bitte geben Sie eine Nachricht ein');
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
        message,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setSubmitted(true);
      setMessage('');
      setRating(0);
      setCategory('general');

      setTimeout(() => setSubmitted(false), 5000);
    } catch (error: any) {
      alert('Fehler: ' + error.message);
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
            Helfen Sie uns, DocStruc zu verbessern.
          </Text>
        </View>

        {submitted && (
          <View style={styles.successBanner}>
            <ThumbsUp size={20} color="#059669" />
            <Text style={styles.successText}>
              Vielen Dank für Ihr Feedback!
            </Text>
          </View>
        )}

        {/* Feedback Form */}
        <View style={styles.card}>
          {/* Rating */}
          <View style={styles.section}>
            <Text style={styles.label}>Wie zufrieden sind Sie?</Text>
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
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Kategorie</Text>
            <View style={styles.selectWrapper}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={styles.select as any}
              >
                <option value="general">Allgemeines Feedback</option>
                <option value="feature">Feature-Wunsch</option>
                <option value="bug">Bug-Report</option>
                <option value="ui">Benutzeroberfläche</option>
                <option value="other">Sonstiges</option>
              </select>
            </View>
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
          </View>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={loading || !message.trim()}
          >
            {loading ? 'Wird gesendet...' : 'Feedback senden'}
          </Button>
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
    backgroundColor: '#3b82f6',
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
  },
  selectWrapper: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  select: {
    width: '100%',
    padding: 12,
    fontSize: 14,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#0f172a',
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
});
