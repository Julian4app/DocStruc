import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function MainLayout({ children, title, actions }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    { label: 'Projekte', path: '/' },
    { label: 'Admin', path: '/admin' },
    // Add more global items here if needed, e.g. Settings, Profile
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

        <View style={styles.footer}>
           <Button variant="outline" onClick={handleLogout} style={styles.logoutBtn}>Logout</Button>
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
    backgroundColor: '#F3F4F6',
  },

  sidebar: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logoText: {
    backgroundColor: colors.primary,
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: '900',
    marginRight: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  navContainer: {
    padding: 16,
    flex: 1,
  },
  navItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  navItemActive: {
    backgroundColor: '#EFF6FF',
  },
  navText: {
    fontSize: 16,
    color: '#4B5563',
  },
  navTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  logoutBtn: {
    width: '100%',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 70,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 32,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  }
});
