import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';

import { useParams } from 'react-router-dom';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function MainLayout({ children, title, actions }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { id: projectId } = useParams<{ id: string }>(); // Check if we are in a project context
  
  const [isSuperuser, setIsSuperuser] = React.useState(false);

  React.useEffect(() => {
    checkSuperuser();
  }, []);

  const checkSuperuser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Check profiles table for is_superuser flag
      const { data } = await supabase
        .from('profiles')
        .select('is_superuser')
        .eq('id', user.id)
        .single();
      
      if (data?.is_superuser) setIsSuperuser(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    { label: 'Projekte', path: '/' },
  ];

  const adminItems = [
     { label: 'Projekte Manager', path: '/manage-projects' },
     { label: 'Zugreifer', path: '/accessors' },
  ];

  return (
    <View style={styles.container}>
      {/* Sidebar - Hidden on small screens? For now always visible as per "web" context */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.logoText}>DS</Text>
          <Text style={styles.brandText}>DocStruc</Text>
        </View>

        <View style={styles.navContainer}>
          {/* General Section */}
          <View style={{ marginBottom: 24 }}>
            {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                <TouchableOpacity
                    key={item.path}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => navigate(item.path)}
                >
                    <Text style={[styles.navText, isActive && styles.navTextActive]}>
                    {item.label}
                    </Text>
                </TouchableOpacity>
                );
            })}
          </View>

          {/* Administrative Section */}
          {isSuperuser && (
              <View>
                  <Text style={{ 
                      paddingHorizontal: 16, 
                      marginBottom: 8, 
                      fontSize: 12, 
                      textTransform: 'uppercase', 
                      color: 'rgba(255,255,255,0.5)',
                      fontWeight: '600'
                   }}>
                      Administrative
                  </Text>
                  {adminItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <TouchableOpacity
                            key={item.path}
                            style={[styles.navItem, isActive && styles.navItemActive]}
                            onPress={() => navigate(item.path)}
                        >
                            <Text style={[styles.navText, isActive && styles.navTextActive]}>
                            {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                  })}
              </View>
          )}

        </View>

        <View style={styles.footer}>
           <Button variant="outline" onClick={handleLogout} style={styles.logoutBtn} textStyle={{ color: 'rgba(255,255,255,0.8)' }}>Logout</Button>
        </View>
      </View>


      {/* Main Content */}
      <View style={styles.main}>
        {/* Header */}
        <View style={styles.header}>
            <Text style={styles.pageTitle}>{title || 'DocStruc'}</Text>
            <View style={styles.actions}>
                {actions}
            </View>
        </View>

        {/* Content Scroll */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    backgroundColor: colors.background,
  },

  sidebar: {
    width: 260,
    backgroundColor: colors.primary,
    borderRightWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 10,
    elevation: 5,
  },
  sidebarHeader: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoText: {
    backgroundColor: colors.accent,
    color: 'white',
    width: 36,
    height: 36,
    textAlign: 'center',
    lineHeight: 36,
    borderRadius: 8,
    fontWeight: '900',
    marginRight: 12,
    fontSize: 18,
    overflow: 'hidden'
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  navContainer: {
    padding: 16,
    flex: 1,
    gap: 4,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  navText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  logoutBtn: {
    width: '100%',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.background,
  },
  header: {
    height: 90,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -1,
  },
  actions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center',
  }
});
