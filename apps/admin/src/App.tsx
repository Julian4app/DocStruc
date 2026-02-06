import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import ContactPersons from './pages/ContactPersons';
import ContactPersonDetail from './pages/ContactPersonDetail';
import SubscriptionTypes from './pages/SubscriptionTypes';
import SubscriptionTypeDetail from './pages/SubscriptionTypeDetail';
import Tags from './pages/Tags';
import TagDetail from './pages/TagDetail';
import PlaceholderPage from './pages/Placeholder'; // Import placeholder
import Subscriptions from './pages/Subscriptions';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import { AdminLayout } from './layouts/AdminLayout';
import { Button } from '@docstruc/ui';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
      // Simple loading state
      return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading Nexus...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function LayoutWrapper({ children, title, actions }: { children: React.ReactNode, title: string, actions?: React.ReactNode }) {
    return (
        <AdminLayout title={title} actions={actions}>
            {children}
        </AdminLayout>
    );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <LayoutWrapper title="Dashboard" actions={<Button onClick={() => {}} variant="secondary">Download Report</Button>}>
                <Dashboard />
            </LayoutWrapper>
          </ProtectedRoute>
        } />
        
        <Route path="/customers" element={
          <ProtectedRoute>
             <LayoutWrapper title="Customers" actions={<Button onClick={() => {}} variant="primary">New Customer</Button>}>
                <Customers />
             </LayoutWrapper>
          </ProtectedRoute>
        } />
        
        <Route path="/customers/:id" element={
          <ProtectedRoute>
             <LayoutWrapper title="Customer Details">
                <CustomerDetail />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/subscriptions" element={
          <ProtectedRoute>
             <LayoutWrapper title="Subscriptions">
                <Subscriptions />
             </LayoutWrapper>
          </ProtectedRoute>
        } />
        
        <Route path="/invoices" element={
          <ProtectedRoute>
             <LayoutWrapper title="Invoices">
                <PlaceholderPage title="Invoices" />
             </LayoutWrapper>
          </ProtectedRoute>
        } />
        
        <Route path="/contacts" element={
          <ProtectedRoute>
             <LayoutWrapper title="Contact Persons">
                <ContactPersons />
             </LayoutWrapper>
          </ProtectedRoute>
        } />
        
        <Route path="/contacts/:id" element={
          <ProtectedRoute>
             <LayoutWrapper title="Contact Details">
                <ContactPersonDetail />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/subscription-types" element={
          <ProtectedRoute>
             <LayoutWrapper title="Subscription Types">
                <SubscriptionTypes />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/subscription-types/:id" element={
          <ProtectedRoute>
             <LayoutWrapper title="Plan Details">
                <SubscriptionTypeDetail />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
             <LayoutWrapper title="Profile">
                <Profile />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute>
             <LayoutWrapper title="History">
                <PlaceholderPage title="System History" />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/tags" element={
          <ProtectedRoute>
             <LayoutWrapper title="System Tags">
                <Tags />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/tags/:id" element={
          <ProtectedRoute>
             <LayoutWrapper title="Tag Details">
                <TagDetail />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
             <LayoutWrapper title="Settings">
                <Settings />
             </LayoutWrapper>
          </ProtectedRoute>
        } />

         {/* Placeholders for other routes */}
         <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
