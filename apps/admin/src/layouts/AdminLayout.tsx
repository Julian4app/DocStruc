import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ProfileDropdown } from '../components/ProfileDropdown';
import { 
  LayoutDashboard, 
  Users, 
  Contact, 
  CreditCard, 
  Tags,
  Menu,
  Bell,
  Search,
  ChevronRight,
  Settings,
  UserCircle
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
  const [profile, setProfile] = useState<{ first_name?: string, last_name?: string, email?: string } | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          setUserEmail(user.email || '');
          const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
          if (data) {
            setProfile(data);
            setUserName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
          }
      }
  };

  useEffect(() => {
      fetchProfile();
      // Subscribe to profile changes
      const channel = supabase.channel('current_user_profile')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles' 
        }, (payload) => {
             // Check if it's our user (simplified, ideally we check payload.new.id === user.id)
             // For now just re-fetch to be safe or use payload
             fetchProfile(); 
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
  }, []);

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

  const displayName = userName || 'User';

  const bottomMenu = [
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Profile', path: '/profile', icon: UserCircle },
  ];

  return (
    <View style={styles.container}>
      {/* Sidebar - Desktop */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <img 
            src="/logo.svg" 
            alt="DocStruc Logo" 
            style={{ width: 32, height: 32, borderRadius: 6 }}
          />
          <Text style={styles.logoText}>DocStruc<Text style={{ fontWeight: '300', color: '#94a3b8' }}>Admin</Text></Text> 
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
        
        {/* User Mini Profile */}
        <View style={styles.userProfile}>
            <View style={styles.avatar}>
               <Text style={{color:'#fff', fontWeight:'bold'}}>
                  {profile && profile.first_name ? `${profile.first_name[0]}${profile.last_name ? profile.last_name[0] : ''}` : 'U'}
               </Text>
            </View>
            <View>
                <Text style={styles.userName}>
                    {profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User' : 'Loading...'}
                </Text>
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
    backgroundColor: '#0f172a', // Slate 900
  },
  sidebar: {
    width: 280,
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
  userProfile: {
      padding: 16,
      backgroundColor: '#020617',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: '#1e293b',
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
    position: 'relative' as any,
    // borderBottomWidth: 1,
    // borderBottomColor: '#e2e8f0',
    // backdropFilter: 'blur(10px)', // Glassmorphism
    zIndex: 100
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
      gap: 16,
      position: 'relative' as any,
      zIndex: 200
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
