import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ImageBackground, TouchableOpacity } from 'react-native';
import { Button } from '@docstruc/ui';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { colors } from '@docstruc/theme';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

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
          setError(error.message);
      } else {
          try {
             // Optional: Check a 'profiles' table for role 'admin'
             // const { data: profile } = ...
          } catch(err) {} 
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
      {/* Background Decor */}
      <View style={styles.bgDecorCircle1} />
      <View style={styles.bgDecorCircle2} />

      <View style={styles.card}>
        <View style={styles.header}>
            <View style={styles.logoBadge}>
                <ShieldCheck size={32} color="#3b82f6" />
            </View>
            <Text style={styles.logo}>Nexus Admin</Text>
            <Text style={styles.subtitle}>Welcome back, confirm your credentials to access the dashboard.</Text>
        </View>

        <View style={styles.form}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon as any} />
                    <TextInput 
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="name@company.com"
                        placeholderTextColor="#cbd5e1"
                        autoCapitalize="none"
                    />
                </View>
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                    <Lock size={18} color="#94a3b8" style={styles.inputIcon as any} />
                    <TextInput 
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="••••••••"
                        placeholderTextColor="#cbd5e1"
                    />
                </View>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <TouchableOpacity 
                onPress={loading ? undefined : handleLogin}
                activeOpacity={0.8}
                style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            >
                <Text style={styles.loginBtnText}>{loading ? "Verifying..." : "Sign In"}</Text>
                {!loading && <ArrowRight size={20} color="white" />}
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Secure connection via Supabase Auth</Text>
            </View>
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
    backgroundColor: '#0f172a', // Slate 900
    height: '100vh' as any,
    overflow: 'hidden',
    position: 'relative'
  },
  bgDecorCircle1: {
      position: 'absolute',
      width: 600,
      height: 600,
      borderRadius: 300,
      backgroundColor: '#1e293b', // Slate 800
      top: -100,
      right: -100,
      opacity: 0.5
  },
  bgDecorCircle2: {
      position: 'absolute',
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: '#3b82f6', // Blue 500
      bottom: -150,
      left: -100,
      opacity: 0.1
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 10,
    zIndex: 10
  },
  header: {
      alignItems: 'center',
      marginBottom: 32
  },
  logoBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#eff6ff',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
  },
  logo: {
      fontSize: 28,
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: -0.5,
      marginBottom: 8
  },
  subtitle: {
      fontSize: 15,
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 22
  },
  form: {
      gap: 20
  },
  inputGroup: {
      gap: 8
  },
  label: {
      fontSize: 13,
      fontWeight: '600',
      color: '#334155'
  },
  inputWrapper: {
      position: 'relative'
  },
  input: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 12,
      paddingLeft: 42,
      paddingRight: 16,
      height: 46,
      fontSize: 15,
      color: '#0f172a'
  },
  inputIcon: {
      position: 'absolute',
      left: 14,
      top: 14,
      zIndex: 2
  },
  loginBtn: {
      height: 50,
      backgroundColor: '#3b82f6',
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 8,
      shadowColor: '#3b82f6',
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 }
  },
  loginBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: 'white'
  },
  errorBox: {
      backgroundColor: '#fef2f2',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#fecaca'
  },
  errorText: {
      color: '#ef4444',
      fontSize: 13,
      textAlign: 'center'
  },
  footer: {
      alignItems: 'center',
      marginTop: 24
  },
  footerText: {
      fontSize: 12,
      color: '#94a3b8'
  }
});

