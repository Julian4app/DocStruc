import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm, RegisterData } from '@docstruc/ui';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { colors } from '@docstruc/theme';
import { View, ActivityIndicator, Text } from 'react-native';

// ─── Lazy-loaded page components (code splitting) ──────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const Accessors = lazy(() => import('./pages/Accessors').then(m => ({ default: m.Accessors })));
const MyTeam = lazy(() => import('./pages/MyTeam').then(m => ({ default: m.MyTeam })));
const ManageProjects = lazy(() => import('./pages/superuser/ManageProjects').then(m => ({ default: m.ManageProjects })));
const ProjectManagementDetail = lazy(() => import('./pages/superuser/ProjectManagementDetail').then(m => ({ default: m.ProjectManagementDetail })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Datenschutz = lazy(() => import('./pages/Datenschutz').then(m => ({ default: m.Datenschutz })));
const Impressum = lazy(() => import('./pages/Impressum').then(m => ({ default: m.Impressum })));
const Feedback = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation').then(m => ({ default: m.AcceptInvitation })));
const ProjectDashboard = lazy(() => import('./pages/project/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
const ProjectTasks = lazy(() => import('./pages/project/ProjectTasks').then(m => ({ default: m.ProjectTasks })));
const ProjectGeneralInfo = lazy(() => import('./pages/project/ProjectGeneralInfo').then(m => ({ default: m.ProjectGeneralInfo })));
const ProjectDefects = lazy(() => import('./pages/project/ProjectDefects').then(m => ({ default: m.ProjectDefects })));
const ProjectSchedule = lazy(() => import('./pages/project/ProjectSchedule').then(m => ({ default: m.ProjectSchedule })));
const ProjectObjektplan = lazy(() => import('./pages/project/ProjectObjektplan').then(m => ({ default: m.ProjectObjektplan })));
const ProjectDocumentation = lazy(() => import('./pages/project/ProjectDocumentation').then(m => ({ default: m.ProjectDocumentation })));
const ProjectFiles = lazy(() => import('./pages/project/ProjectFiles').then(m => ({ default: m.ProjectFiles })));
const ProjectDiary = lazy(() => import('./pages/project/ProjectDiary').then(m => ({ default: m.ProjectDiary })));
const ProjectCommunication = lazy(() => import('./pages/project/ProjectCommunication').then(m => ({ default: m.ProjectCommunication })));
const ProjectParticipants = lazy(() => import('./pages/project/ProjectParticipants').then(m => ({ default: m.ProjectParticipants })));
const ProjectReports = lazy(() => import('./pages/project/ProjectReports').then(m => ({ default: m.ProjectReports })));
const ProjectActivity = lazy(() => import('./pages/project/ProjectActivity').then(m => ({ default: m.ProjectActivity })));

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ToastProvider } from './components/ToastProvider';
import { AuthProvider } from './contexts/AuthContext';
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
      <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: colors.background }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          }>
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
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
