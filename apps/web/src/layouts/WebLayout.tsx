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
  Settings,
  HelpCircle,
  Smartphone
} from 'lucide-react';

export function WebLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [title, setTitle] = useState('DocStruc');
  const [subtitle, setSubtitle] = useState('');
  const [actions, setActions] = useState<React.ReactNode>(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { checkUser(); }, []);

  const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');
      const { data } = await supabase
        .from('profiles')
        .select('is_superuser, first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single();
      if (data?.is_superuser) setIsSuperuser(true);
      if (data?.first_name) setUserName(`${data.first_name} ${data.last_name || ''}`.trim());
      if (data?.avatar_url) setUserAvatar(data.avatar_url);
      
      // Fetch notifications (example - adjust based on your schema)
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (notifs) setNotifications(notifs);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const menuGroups = [
    {
      title: 'MENU',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      ]
    }
  ];

  if (isSuperuser) {
      menuGroups.push({
          title: 'ADMINISTRATION',
          items: [
              { label: 'Projekte Manager', path: '/manage-projects', icon: Folder },
              { label: 'Zugreifer', path: '/accessors', icon: Users },
          ]
      });
  }

  const displayName = userName || (isSuperuser ? 'Super Admin' : 'User');

  return (
    <LayoutContext.Provider value={{ title, setTitle, subtitle, setSubtitle, actions, setActions }}>
    <View style={styles.shell}>

      {/* ─── Sidebar ─── */}
      <View style={styles.sidebar}>
        <View style={styles.logoContainer}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>D</Text>
          </View>
          <Text style={styles.logoText}>DocStruc</Text>
        </View>

        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          {menuGroups.map((group, gi) => (
            <View key={gi} style={styles.navGroup}>
              <Text style={styles.navGroupLabel}>{group.title}</Text>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.path}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => navigate(item.path)}
                    activeOpacity={0.7}
                  >
                    {isActive && <View style={styles.activeIndicator} />}
                    <Icon size={20} color={isActive ? colors.primary : '#94a3b8'} strokeWidth={isActive ? 2.5 : 2} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          
          <View style={styles.navGroup}>
            <Text style={styles.navGroupLabel}>GENERAL</Text>
            <TouchableOpacity style={styles.navItem} onPress={() => {}}>
              <Settings size={20} color="#94a3b8" strokeWidth={2} />
              <Text style={styles.navLabel}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => {}}>
              <HelpCircle size={20} color="#94a3b8" strokeWidth={2} />
              <Text style={styles.navLabel}>Help</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
              <LogOut size={20} color="#94a3b8" strokeWidth={2} />
              <Text style={styles.navLabel}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Promo Card */}
        <View style={styles.promoCard}>
          <View style={styles.promoBg1} />
          <View style={styles.promoBg2} />
          <View style={styles.promoIconCircle}>
            <Smartphone size={18} color="#fff" />
          </View>
          <Text style={styles.promoHeading}>{'Download our\nMobile App'}</Text>
          <Text style={styles.promoSub}>Get easy in another way</Text>
          <TouchableOpacity style={styles.promoBtn} activeOpacity={0.8}>
            <Text style={styles.promoBtnText}>Download</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Main ─── */}
      <View style={styles.main}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <Text style={styles.searchText}>Search...</Text>
            <View style={styles.searchShortcut}>
              <Text style={styles.searchShortcutText}>⌘ F</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <View style={{ position: 'relative' as any }}>
              <TouchableOpacity 
                style={styles.headerIconBtn}
                onPress={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} color="#475569" />
                {notifications.length > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>
              
              {showNotifications && (
                <View style={styles.notificationDropdown}>
                  <Text style={styles.notifHeader}>Notifications</Text>
                  {notifications.length === 0 ? (
                    <Text style={styles.noNotifs}>No new notifications</Text>
                  ) : (
                    notifications.map((notif, i) => (
                      <TouchableOpacity key={i} style={styles.notifItem}>
                        <Text style={styles.notifTitle}>{notif.title || 'Notification'}</Text>
                        <Text style={styles.notifText}>{notif.message || notif.description}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
            <View style={styles.headerDivider} />
            <TouchableOpacity style={styles.userArea} activeOpacity={0.7}>
              {userAvatar ? (
                <img 
                  src={userAvatar} 
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    objectFit: 'cover' as any,
                  }} 
                  alt="Profile"
                />
              ) : (
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{(userName || userEmail)[0]?.toUpperCase() || 'U'}</Text>
                </View>
              )}
              <View>
                <Text style={styles.userDisplayName}>{displayName}</Text>
                <Text style={styles.userEmailText}>{userEmail}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
          </View>
          <View style={styles.pageActions}>{actions}</View>
        </View>

        {/* Content */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <Outlet />
        </ScrollView>
      </View>
    </View>
    </LayoutContext.Provider>
  );
}

const SIDEBAR_W = 260;

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC', height: '100%' as any, overflow: 'hidden' as any },

  /* Sidebar */
  sidebar: { width: SIDEBAR_W, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#F1F5F9', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'column' as any },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36, paddingHorizontal: 8 },
  logoMark: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  logoText: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },

  navScroll: { flex: 1 },
  navGroup: { marginBottom: 28 },
  navGroupLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' as any, paddingHorizontal: 12, marginBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, position: 'relative' as any },
  navItemActive: { backgroundColor: '#F0F7FF' },
  activeIndicator: { position: 'absolute' as any, left: -20, top: 8, bottom: 8, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.primary },
  navLabel: { fontSize: 15, fontWeight: '500', color: '#94a3b8' },
  navLabelActive: { color: colors.primary, fontWeight: '700' },

  /* Promo */
  promoCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, paddingBottom: 18, marginTop: 12, position: 'relative' as any, overflow: 'hidden' as any },
  promoBg1: { position: 'absolute' as any, top: -30, right: -30, width: 100, height: 100, borderRadius: 50, borderWidth: 20, borderColor: 'rgba(255,255,255,0.06)' },
  promoBg2: { position: 'absolute' as any, top: 30, right: -50, width: 120, height: 120, borderRadius: 60, borderWidth: 20, borderColor: 'rgba(255,255,255,0.04)' },
  promoIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  promoHeading: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
  promoSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 16 },
  promoBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  promoBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  /* Main */
  main: { flex: 1, flexDirection: 'column' as any },

  /* Header */
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', width: 280, gap: 10 },
  searchText: { flex: 1, color: '#94a3b8', fontSize: 14 },
  searchShortcut: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  searchShortcutText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', position: 'relative' as any },
  notifDot: { position: 'absolute' as any, top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#F8FAFC' },
  notificationDropdown: {
    position: 'absolute' as any,
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    zIndex: 1000,
    maxHeight: 400,
  },
  notifHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  noNotifs: {
    padding: 32,
    textAlign: 'center' as any,
    color: '#94a3b8',
    fontSize: 14,
  },
  notifItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  notifText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  headerDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  userArea: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userDisplayName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  userEmailText: { fontSize: 12, color: '#94a3b8' },

  /* Page Header */
  pageHeader: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.8, marginBottom: 4 },
  pageSubtitle: { fontSize: 15, color: '#94a3b8', fontWeight: '400' },
  pageActions: { flexDirection: 'row', gap: 12 },

  /* Content */
  contentScroll: { flex: 1 },
  contentInner: { paddingHorizontal: 32, paddingBottom: 60 },
});
