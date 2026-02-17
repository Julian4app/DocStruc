import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm, RegisterData } from '@docstruc/ui';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { colors } from '@docstruc/theme';
import { View, ActivityIndicator, Text } from 'react-native';
import { Dashboard } from './pages/Dashboard';
import { ProjectDetail } from './pages/ProjectDetail';
import { Accessors } from './pages/Accessors';
import { MyTeam } from './pages/MyTeam';
import { ManageProjects } from './pages/superuser/ManageProjects';
import { ProjectManagementDetail } from './pages/superuser/ProjectManagementDetail';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Datenschutz } from './pages/Datenschutz';
import { Impressum } from './pages/Impressum';
import { Feedback } from './pages/Feedback';
import { Help } from './pages/Help';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { ProjectDashboard } from './pages/project/ProjectDashboard';
import { ProjectTasks } from './pages/project/ProjectTasks';
import { ProjectGeneralInfo } from './pages/project/ProjectGeneralInfo';
import { ProjectDefects } from './pages/project/ProjectDefects';
import { ProjectSchedule } from './pages/project/ProjectSchedule';
import { ProjectObjektplan } from './pages/project/ProjectObjektplan';
import { ProjectDocumentation } from './pages/project/ProjectDocumentation';
import { ProjectFiles } from './pages/project/ProjectFiles';
import { ProjectDiary } from './pages/project/ProjectDiary';
import { ProjectCommunication } from './pages/project/ProjectCommunication';
import { ProjectParticipants } from './pages/project/ProjectParticipants';
import { ProjectReports } from './pages/project/ProjectReports';
import { ProjectActivity } from './pages/project/ProjectActivity';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ToastProvider } from './components/ToastProvider';
import { WebLayout } from './layouts/WebLayout';
import { PermissionGuard } from './components/PermissionGuard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginLockUntil, setLoginLockUntil] = useState<number | null>(null);

  useEffect(() => {
    console.log('App mounting, checking session...');
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setAuthError(error.message);
      } else {
        console.log('Session retrieved:', data.session ? 'Found' : 'None');
        setSession(data.session);
      }
    }).catch(err => {
      console.error('Unexpected error getting session:', err);
      setAuthError(err.message || 'Unknown error');
    }).finally(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    // Client-side rate limiting: max 5 attempts, then 60s lockout
    if (loginLockUntil && Date.now() < loginLockUntil) {
      const remainingSec = Math.ceil((loginLockUntil - Date.now()) / 1000);
      setAuthError(`Zu viele Login-Versuche. Bitte warten Sie ${remainingSec} Sekunden.`);
      return;
    }
    if (loginLockUntil && Date.now() >= loginLockUntil) {
      setLoginAttempts(0);
      setLoginLockUntil(null);
    }

    setLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLoginLockUntil(Date.now() + 60_000);
        setAuthError('Zu viele fehlgeschlagene Login-Versuche. Bitte warten Sie 60 Sekunden.');
      } else {
        setAuthError(error.message);
      }
    } else {
      setLoginAttempts(0);
      setLoginLockUntil(null);
    }
    setLoading(false);
  };

  const handleRegister = async (data: RegisterData) => {
    setLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    const { error } = await supabase.auth.signUp({ 
        email: data.email, 
        password: data.password,
        options: { 
          data: { 
            first_name: data.firstName, 
            last_name: data.lastName,
            phone: data.phone || null,
            company_name: data.companyName || null,
            position: data.position || null,
          } 
        }
    });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthSuccess('Ihre Registrierung war erfolgreich! Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie Ihr Konto.');
      setAuthError(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={
              !session ? (
                <LoginForm onLogin={handleLogin} onRegister={handleRegister} isLoading={loading} error={authError} successMessage={authSuccess} />
              ) : <Navigate to="/" />
            } />
            
            {/* Public invitation acceptance route */}
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            
            <Route element={session ? <WebLayout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accessors" element={<Accessors />} />
              <Route path="/my-team" element={<MyTeam />} />
              <Route path="/manage-projects" element={<ManageProjects />} />
              <Route path="/manage-projects/:id" element={<ProjectManagementDetail />} />
              <Route path="/project/:id" element={<ProjectDetail />}>
                <Route index element={<ProjectDashboard />} />
                <Route path="general-info" element={<PermissionGuard><ProjectGeneralInfo /></PermissionGuard>} />
                <Route path="tasks" element={<PermissionGuard><ProjectTasks /></PermissionGuard>} />
                <Route path="defects" element={<PermissionGuard><ProjectDefects /></PermissionGuard>} />
                <Route path="schedule" element={<PermissionGuard><ProjectSchedule /></PermissionGuard>} />
                <Route path="objektplan" element={<PermissionGuard moduleKey="documentation"><ProjectObjektplan /></PermissionGuard>} />
                <Route path="documentation" element={<PermissionGuard><ProjectDocumentation /></PermissionGuard>} />
                <Route path="files" element={<PermissionGuard><ProjectFiles /></PermissionGuard>} />
                <Route path="diary" element={<PermissionGuard><ProjectDiary /></PermissionGuard>} />
                <Route path="communication" element={<PermissionGuard><ProjectCommunication /></PermissionGuard>} />
                <Route path="participants" element={<PermissionGuard><ProjectParticipants /></PermissionGuard>} />
                <Route path="reports" element={<PermissionGuard><ProjectReports /></PermissionGuard>} />
                <Route path="activity" element={<PermissionGuard><ProjectActivity /></PermissionGuard>} />
              </Route>
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/help" element={<Help />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
