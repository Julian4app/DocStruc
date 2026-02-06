import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  Users, 
  Contact, 
  CreditCard, 
  Tags, 
  Settings, 
  UserCircle, 
  LogOut, 
  Menu,
  Bell,
  Search,
  ChevronRight
} from 'lucide-react';

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
      title: 'ANALYTICS & CRM',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Customers', path: '/customers', icon: Users },
        { label: 'Contact Persons', path: '/contacts', icon: Contact },
        { label: 'Subscriptions', path: '/subscriptions', icon: CreditCard }, // Reusing SubscriptionTypes generic path
        { label: 'Tags', path: '/tags', icon: Tags },
      ]
    }
  ];

  const bottomMenu = [
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Profile', path: '/profile', icon: UserCircle },
  ];

  return (
    <View style={styles.container}>
      {/* Sidebar - Desktop */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>N</Text>
          </View>
          <Text style={styles.logoText}>Nexus<Text style={{ fontWeight: '300', color: '#94a3b8' }}>Admin</Text></Text> 
        </View>

        <ScrollView style={styles.navScroll} contentContainerStyle={{ paddingVertical: 20 }}>
          {menuGroups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.menuGroup}>
              {group.title && <Text style={styles.menuGroupTitle}>{group.title}</Text>}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.path}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => navigate(item.path)}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isActive ? '#38bdf8' : '#94a3b8'} strokeWidth={isActive ? 2.5 : 2} />
                    <Text style={[styles.navText, isActive && styles.navTextActive]}>
                      {item.label}
                    </Text>
                    {isActive && <View style={styles.activeIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.bottomNav}>
            {bottomMenu.map((item) => {
                const Icon = item.icon;
                return (
                <TouchableOpacity
                    key={item.label}
                    style={styles.navItem}
                    onPress={() => navigate(item.path)}
                >
                    <Icon size={20} color="#94a3b8" />
                    <Text style={styles.navText}>{item.label}</Text>
                </TouchableOpacity>
            )})}
            <TouchableOpacity style={[styles.navItem, { marginTop: 8 }]} onPress={handleLogout}>
                <LogOut size={20} color="#ef4444" />
                <Text style={[styles.navText, { color: '#ef4444' }]}>Logout</Text>
            </TouchableOpacity>
        </View>
        
        {/* User Mini Profile */}
        <View style={styles.userProfile}>
            <View style={styles.avatar}>
               <Text style={{color:'#fff', fontWeight:'bold'}}>JD</Text>
            </View>
            <View>
                <Text style={styles.userName}>Julian Doe</Text>
                <Text style={styles.userRole}>Super Admin</Text>
            </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Header Bar */}
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                 <Text style={styles.pageBreadcrumb}>Pages / {title}</Text>
                 <Text style={styles.pageTitle}>{title}</Text>
            </View>
            
            {/* @ts-ignore */}
            <View style={styles.headerRight as any}>
                <View style={styles.searchBar}>
                    <Search size={16} color="#94a3b8" />
                    <Text style={{ color: '#cbd5e1', marginLeft: 8, fontSize: 13 }}>Search...</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn}>
                    <Bell size={20} color="#64748b" />
                    <View style={styles.notificationDot} />
                </TouchableOpacity>
                {actions && <View style={styles.actionDelimiter} />}
                {actions}
            </View>
        </View>

        {/* Content Scroll */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
             {children as any}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9', // Slate 100
    height: '100%',
    overflow: 'hidden'
  },
  // Sidebar
  sidebar: {
    width: 260,
    backgroundColor: '#0f172a', // Slate 900
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    display: 'flex',
    flexDirection: 'column'
  },
  sidebarHeader: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  logoBadge: {
      width: 32,
      height: 32,
      backgroundColor: '#38bdf8', // Sky 400
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
  },
  logoBadgeText: {
      color: 'white',
      fontWeight: '900',
      fontSize: 18
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.5
  },
  navScroll: {
    flex: 1,
  },
  menuGroup: {
      marginBottom: 24
  },
  menuGroupTitle: {
      color: '#475569',
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 24,
      marginBottom: 8,
      letterSpacing: 1
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 12,
    position: 'relative'
  },
  navItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)'
  },
  navText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500'
  },
  navTextActive: {
    color: '#38bdf8', // Sky 400
    fontWeight: '600'
  },
  activeIndicator: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: '#38bdf8',
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4
  },
  bottomNav: {
      borderTopWidth: 1,
      borderTopColor: '#1e293b',
      paddingVertical: 16
  },
  userProfile: {
      padding: 16,
      backgroundColor: '#020617',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
  },
  avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#334155',
      alignItems: 'center',
      justifyContent: 'center'
  },
  userName: {
      color: '#f8fafc',
      fontSize: 13,
      fontWeight: '600'
  },
  userRole: {
      color: '#64748b',
      fontSize: 11
  },

  // Main Content
  main: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative'
  },
  header: {
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    // borderBottomWidth: 1,
    // borderBottomColor: '#e2e8f0',
    // backdropFilter: 'blur(10px)', // Glassmorphism
    zIndex: 10
  },
  headerLeft: {
      gap: 4
  },
  pageBreadcrumb: {
      fontSize: 12,
      color: '#64748b'
  },
  pageTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: -0.5
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16
  },
  searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      width: 240,
      height: 40
  },
  iconBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#e2e8f0'
  },
  notificationDot: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fb7185',
      borderWidth: 1,
      borderColor: 'white'
  },
  actionDelimiter: {
      width: 1,
      height: 24,
      backgroundColor: '#e2e8f0',
      marginHorizontal: 8
  },
  headerActions: {
      position: 'absolute',
      right: 32,
      top: 80 + 24 // Below header? No, just passed as prop logic needs adjustment
  },
  
  contentScroll: {
      flex: 1,
  },
  contentContainer: {
      padding: 32,
      paddingBottom: 60
  }
});
