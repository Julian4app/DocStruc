import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ImageBackground } from 'react-native';
import { Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { colors } from '@docstruc/theme';

export default function Login() {
  const [email, setEmail] = useState('admin@ployify.com');
  const [password, setPassword] = useState('Test1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
          // If user doesn't exist, try to sign up (Auto-provision for this demo if needed, or just fail)
          // For this specific request, the user GAVE credentials, so we assume they work or we might need to create the user in the "background" if it fails.
          // But usually we just show error.
          setError(error.message);
      } else {
          // Check if user is actually an admin? For now assume yes if they have these creds.
          navigate('/');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
            <Text style={styles.logo}>Nexus Admin</Text>
            <Text style={styles.subtitle}>Sign in to manage your empire</Text>
        </View>

        <View style={styles.form}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput 
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="admin@example.com"
                    autoCapitalize="none"
                />
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput 
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Button 
                onClick={handleLogin} 
                variant="primary"
            >
                {loading ? "Signing in..." : "Sign In"}
            </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827', // Dark background for login
    height: '100vh',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    outlineStyle: 'none', // For web
  },
  error: {
      color: '#EF4444',
      fontSize: 14,
      textAlign: 'center'
  }
});
