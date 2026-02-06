import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../lib/supabase';
import { Button } from '@docstruc/ui';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuGroups = [
    {
      title: 'MENU',
      items: [
        { label: 'Dashboard', path: '/' },
        { label: 'Customers', path: '/customers' },
        { label: 'Contact Persons', path: '/contacts' },
        { label: 'Subscription Types', path: '/subscription-types' },
        { label: 'Tags', path: '/tags' },
      ]
    }
  ];

  const bottomMenu = [
    { label: 'Settings', path: '/settings' },
    { label: 'Profile', path: '/profile' },
    { label: 'Logout', path: '/logout', action: handleLogout },
  ];

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.logoText}>Nexus</Text> 
          {/* User requested name "Donezo" or "Nexus" from image? "Nexus" is on the image provided in prompt text (attachment seems to show layout like Nexus/Donezo themes) */}
        </View>

        <ScrollView style={styles.navScroll}>
          {menuGroups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.menuGroup}>
              {group.title && <Text style={styles.menuGroupTitle}>{group.title}</Text>}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
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
          ))}
        </ScrollView>
        
        <View style={styles.bottomNav}>
            {bottomMenu.map((item) => (
                <TouchableOpacity
                    key={item.label}
                    style={styles.navItem}
                    onPress={() => item.action ? item.action() : navigate(item.path)}
                >
                    <Text style={styles.navText}>{item.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Header Bar */}
        <View style={styles.header}>
            <View>
                 <Text style={styles.pageTitle}>{title}</Text>
                 {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
            </View>
            <View style={styles.actions}>
                {actions}
                <View style={styles.headerProfile}>
                     <View style={[styles.avatarPlaceholder, { width: 40, height: 40, backgroundColor: '#ddd' }]} />
                </View>
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
    fontFamily: 'Inter, sans-serif'
  },
  sidebar: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    paddingVertical: 24,
    paddingHorizontal: 20
  },
  sidebarHeader: {
    marginBottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary, // Or specific 'Nexus' purple
  },
  navScroll: {
    flex: 1,
  },
  menuGroup: {
    marginBottom: 30,
  },
  menuGroupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 10,
    paddingHorizontal: 10,
    letterSpacing: 0.5
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center'
  },
  navItemActive: {
    backgroundColor: colors.primary + '10', // Light opacity primary
    // borderRightWidth: 3,
    // borderRightColor: colors.primary
  },
  navText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500'
  },
  navTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  bottomNav: {
      marginTop: 'auto',
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      paddingTop: 16
  },
  sidebarFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#f3f4f6'
  },
  avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#E5E7EB',
      marginRight: 12
  },
  footerName: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#374151'
  },
  footerEmail: {
      fontSize: 12,
      color: '#9CA3AF'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 90,
    backgroundColor: '#FFFFFF', // Transparent or white? Image shows white/clean
    // borderBottomWidth: 1,
    // borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  pageSubtitle: {
      fontSize: 14,
      color: '#6B7280',
      marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  headerProfile: {
      marginLeft: 20
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 40,
    paddingTop: 10,
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center', // Center content if huge screen
  }
});
