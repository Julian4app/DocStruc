import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { View } from 'react-native';
import { colors } from '@docstruc/theme';
import { useAuth } from '../contexts/AuthContext';
import { LottieLoader } from './LottieLoader';

/**
 * Protects routes that require superuser access.
 * - If auth is still loading: shows spinner
 * - If user is not a superuser: redirects to home (/)
 * - If user is superuser: renders children
 *
 * This is a FRONTEND UX guard. Real security is enforced by backend RLS
 * (is_current_user_superuser() checks in policies).
 */
export function SuperuserGuard({ children }: { children: React.ReactNode }) {
  const { isSuperuser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%' as any }}>
        <LottieLoader size={120} />
      </View>
    );
  }

  if (!isSuperuser) {
    // Redirect non-superusers to home, preserving attempted URL for debugging
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
