import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from '@docstruc/ui';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { colors } from '@docstruc/theme';
import { View, ActivityIndicator, Text } from 'react-native';
import { Dashboard } from './pages/Dashboard';
import { ProjectDetail } from './pages/ProjectDetail';
import { Accessors } from './pages/Accessors';
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
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const handleRegister = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: { data: { first_name: 'Web', last_name: 'User' } }
    });
    if (error) setAuthError(error.message);
    else setAuthError(null); // Registration successful — auto-login or email verification
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.background }}>
                  <LoginForm onLogin={handleLogin} onRegister={handleRegister} isLoading={loading} error={authError} />
                </div>
              ) : <Navigate to="/" />
            } />
            
            {/* Public invitation acceptance route */}
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            
            <Route element={session ? <WebLayout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accessors" element={<Accessors />} />
              <Route path="/manage-projects" element={<ManageProjects />} />
              <Route path="/manage-projects/:id" element={<ProjectManagementDetail />} />
              <Route path="/project/:id" element={<ProjectDetail />}>
                <Route index element={<ProjectDashboard />} />
                <Route path="general-info" element={<ProjectGeneralInfo />} />
                <Route path="tasks" element={<ProjectTasks />} />
                <Route path="defects" element={<ProjectDefects />} />
                <Route path="schedule" element={<ProjectSchedule />} />
                <Route path="objektplan" element={<ProjectObjektplan />} />
                <Route path="documentation" element={<ProjectDocumentation />} />
                <Route path="files" element={<ProjectFiles />} />
                <Route path="diary" element={<ProjectDiary />} />
                <Route path="communication" element={<ProjectCommunication />} />
                <Route path="participants" element={<ProjectParticipants />} />
                <Route path="reports" element={<ProjectReports />} />
                <Route path="activity" element={<ProjectActivity />} />

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
