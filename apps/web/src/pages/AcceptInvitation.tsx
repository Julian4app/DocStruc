import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';

export const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    handleAcceptInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!token) {
      setError('Kein Einladungstoken gefunden');
      setLoading(false);
      return;
    }

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to login with return URL
        const returnUrl = `/accept-invitation?token=${token}`;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Accept the invitation
      const { data, error: rpcError } = await supabase.rpc('accept_project_invitation', {
        p_invitation_token: token
      });

      if (rpcError) throw rpcError;

      if (data?.success) {
        setSuccess(true);
        setProjectName(data.project_name);
        setProjectId(data.project_id);
        
        // Redirect to project after 2 seconds
        setTimeout(() => {
          navigate(`/projects/${data.project_id}`);
        }, 2000);
      } else {
        setError(data?.error || 'Fehler beim Akzeptieren der Einladung');
      }
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError(err.message || 'Fehler beim Akzeptieren der Einladung');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Einladung wird verarbeitet...</Text>
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <CheckCircle size={64} color="#10B981" />
          <Text style={styles.successTitle}>Einladung akzeptiert!</Text>
          <Text style={styles.successMessage}>
            Sie sind jetzt Mitglied von "{projectName}"
          </Text>
          <Text style={styles.redirectText}>
            Sie werden in Kürze zum Projekt weitergeleitet...
          </Text>
          <Button
            title="Jetzt zum Projekt"
            onPress={() => navigate(`/projects/${projectId}`)}
            style={styles.button}
          />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <XCircle size={64} color="#DC2626" />
          <Text style={styles.errorTitle}>Fehler</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <View style={styles.errorActions}>
            <Button
              title="Zur Startseite"
              onPress={() => navigate('/')}
              style={styles.button}
            />
            <Button
              title="Anmelden"
              onPress={() => navigate('/login')}
              variant="outline"
              style={styles.button}
            />
          </View>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    maxWidth: 500,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  successMessage: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  redirectText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    marginTop: 16,
  },
});
