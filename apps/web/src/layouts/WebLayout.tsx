import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutContext } from './LayoutContext';
import { colors } from '@docstruc/theme';
import { 
  LayoutDashboard, 
  Folder, 
  Users, 
  LogOut, 
  Search,
  Bell,
  CheckCircle
} from 'lucide-react';

export function WebLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Context State
  const [title, setTitle] = useState('DocStruc');
  const [subtitle, setSubtitle] = useState('');
  const [actions, setActions] = useState<React.ReactNode>(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');
      
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

  // Define Menu Structure
  const menuGroups = [
    {
      title: 'MENU',
      items: [
        { label: 'Projekte', path: '/', icon: LayoutDashboard },
        // Add placeholders if needed to match density, but functionality first
      ]
    }
  ];

  if (isSuperuser) {
      menuGroups.push({
          title: 'ADMINSTRATION',
          items: [
              { label: 'Projekte Manager', path: '/manage-projects', icon: Folder },
              { label: 'Zugreifer', path: '/accessors', icon: Users },
          ]
      });
  }

  return (
    <LayoutContext.Provider value={{ title, setTitle, subtitle, setSubtitle, actions, setActions }}>
    <View style={styles.container}>
      {/* Sidebar - Modern White Theme */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          {/* Logo */}
          <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary }}>D</Text>
              </View>
              <Text style={styles.logoText}>DocStruc</Text>
          </View>
        </View>

        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          {menuGroups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.menuGroup}>
              {group.title && <Text style={styles.menuGroupTitle}>{group.title}</Text>}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                        styles.navItem, 
                        isActive && styles.navItemActive
                    ]}
                    onPress={() => navigate(item.path)}
                    activeOpacity={0.7}
                  >
                    <Icon 
                        size={20} 
                        color={isActive ? colors.primary : '#94a3b8'} 
                        strokeWidth={2} 
                    />
                    <Text style={[
                        styles.navText, 
                        isActive && styles.navTextActive
                    ]}>
                      {item.label}
                    </Text>
                    {isActive && (
                         <View style={styles.activePill} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          
           {/* Static Bottom Group for Settings/Logout */}
           <View style={styles.menuGroup}>
              <Text style={styles.menuGroupTitle}>GENERAL</Text>
              {/* <TouchableOpacity style={styles.navItem} onPress={() => {}}>
                  <Settings size={20} color="#94a3b8" />
                  <Text style={styles.navText}>Settings</Text>
              </TouchableOpacity> */}
              <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
                  <LogOut size={20} color="#94a3b8" />
                  <Text style={styles.navText}>Logout</Text>
              </TouchableOpacity>
           </View>

          {/* Download Mobile App Card (Visual Match) */}
          <View style={styles.promoCardContainer}>
            <View style={styles.promoCard}>
                <View style={[styles.promoIcon, { marginBottom: 12 }]}>
                    <CheckCircle size={20} color="white" />
                </View>
                <Text style={styles.promoTitle}>Download <Text style={{fontWeight: '400'}}>our</Text></Text>
                <Text style={styles.promoTitle}>Mobile App</Text>
                <Text style={styles.promoText}>Get easy in another way</Text>
                
                <TouchableOpacity style={styles.downloadBtn}>
                    <Text style={styles.downloadBtnText}>Download</Text>
                </TouchableOpacity>

                <View style={styles.promoBgCurve1} />
                <View style={styles.promoBgCurve2} />
            </View>
          </View>

        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Modern Header Bar */}
        <View style={styles.header}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Search size={18} color="#94a3b8" />
                <Text style={styles.searchPlaceholder}>Search projects...</Text>
                <View style={styles.shortcutBadge}>
                    <Text style={styles.shortcutText}>⌘ K</Text>
                </View>
            </View>
            
            <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn}>
                    <View style={styles.iconBtnInner}>
                        <Bell size={20} color="#64748b" />
                        <View style={styles.notificationDot} />
                    </View>
                </TouchableOpacity>
                
                <View style={styles.userProfileBtn}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {userEmail[0]?.toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <View style={{ gap: 2 }}>
                        <Text style={styles.headerUserName}>{isSuperuser ? 'Super Admin' : 'User'}</Text>
                        <Text style={styles.headerUserEmail}>{userEmail}</Text>
                    </View>
                </View>
            </View>
        </View>

        {/* Content Area */}
        <View style={{ flex: 1, position: 'relative' }}>
             <View style={styles.pageHeaderContainer}>
                <View>
                    <Text style={styles.pageTitle}>{title}</Text>
                    {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
                </View>
                <View style={styles.pageActions}>
                    {actions}
                </View>
             </View>

            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                 <Outlet />
            </ScrollView>
        </View>
      </View>
    </View>
    </LayoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB', // Modern light gray
    height: '100%',
    overflow: 'hidden'
  },
  // Sidebar
  sidebar: {
    width: 250,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  sidebarHeader: {
    marginBottom: 40,
    paddingHorizontal: 12
  },
  logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
  },
  logoIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center'
  },
  logoText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#0f172a',
      letterSpacing: -0.5
  },
  
  navScroll: {
    flex: 1,
  },
  menuGroup: {
      marginBottom: 32
  },
  menuGroupTitle: {
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: '600',
      paddingHorizontal: 12,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 14,
    marginBottom: 4,
    position: 'relative'
  },
  navItemActive: {
     backgroundColor: 'transparent'
  },
  activePill: {
      position: 'absolute',
      left: -16, 
      top: 6,
      bottom: 6,
      width: 4,
      backgroundColor: colors.primary, // Using primary blue instead of green
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4
  },
  navText: {
    fontSize: 15, 
    color: '#94a3b8',
    fontWeight: '500'
  },
  navTextActive: {
    color: colors.primary,
    fontWeight: '700'
  },

  // Promo Card
  promoCardContainer: {
      marginTop: 'auto',
      paddingTop: 32,
      paddingHorizontal: 0
  },
  promoCard: {
      backgroundColor: colors.primary, // Using primary layout
      borderRadius: 24,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      height: 220,
      justifyContent: 'flex-end',
      paddingBottom: 24
  },
  promoIcon: {
      width: 32, 
      height: 32, 
      borderRadius: 16, 
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: 20,
      left: 20
  },
  promoTitle: {
      color: 'white',
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24
  },
  promoText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      marginTop: 4,
      marginBottom: 16
  },
  downloadBtn: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center'
  },
  downloadBtnText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 13
  },
  promoBgCurve1: {
      position: 'absolute',
      top: -20,
      right: -20,
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
  },
  promoBgCurve2: {
      position: 'absolute',
      top: 40,
      right: -40,
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
  },

  // Main Content
  main: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    zIndex: 10
  },
  searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 16,
      height: 48,
      borderRadius: 24,
      width: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 8,
      elevation: 1 
  },
  searchPlaceholder: {
      flex: 1,
      marginLeft: 12,
      color: '#94a3b8',
      fontSize: 14
  },
  shortcutBadge: {
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
  },
  shortcutText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#64748b'
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20
  },
  iconBtn: {
      padding: 4,
  },
  iconBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8
  },
  notificationDot: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fb7185',
      borderWidth: 1,
      borderColor: 'white'
  },
  userProfileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginLeft: 12
  },
  avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
  },
  avatarText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 18
  },
  headerUserName: {
      fontSize: 14, 
      fontWeight: '700',
      color: '#0f172a'
  },
  headerUserEmail: {
      fontSize: 12,
      color: '#94a3b8'
  },
  pageHeaderContainer: {
      paddingHorizontal: 40,
      marginBottom: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end'
  },
  pageTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: '#0f172a',
      marginBottom: 8,
      letterSpacing: -1
  },
  pageSubtitle: {
      fontSize: 15,
      color: '#94a3b8',
      fontWeight: '400'
  },
  pageActions: {
      flexDirection: 'row',
      gap: 12
  },
  contentScroll: {
      flex: 1,
  },
  contentContainer: {
      paddingHorizontal: 40,
      paddingBottom: 60
  }
});
