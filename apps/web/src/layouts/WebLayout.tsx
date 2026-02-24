import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LayoutContext } from './LayoutContext';
import { ProfileDropdown } from '../components/ProfileDropdown';
import { NotificationCenterWrapper } from '../components/NotificationCenterWrapper';
import { CustomModal } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { 
  LayoutDashboard, 
  Folder, 
  Users, 
  Search,
  Bell,
  Smartphone,
  UsersRound
} from 'lucide-react';

export function WebLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, profile, isSuperuser, isTeamAdmin } = useAuth();
  
  const [title, setTitle] = useState('DocStruc');
  const [subtitle, setSubtitle] = useState('');
  const [actions, setActions] = useState<React.ReactNode>(null);
  const [sidebarMenu, setSidebarMenu] = useState<{ label: string; path: string; icon?: any }[] | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // ── Layout recovery: force layout recalculation when tab becomes visible ──
  // Some browsers collapse layout dimensions for hidden tabs.
  // react-native-web's flexbox layout may not recover automatically.
  const [, forceRender] = useState(0);
  const shellRef = useRef<any>(null);

  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }

      // Tab became visible again
      const hiddenMs = hiddenAt != null ? Date.now() - hiddenAt : 0;
      hiddenAt = null;

      // Force a re-render so React recalculates the layout tree.
      forceRender(c => c + 1);

      // Force browser reflow — react-native-web may cache 0-dimensions for
      // elements in hidden tabs.
      requestAnimationFrame(() => {
        const rootEl = document.getElementById('root');
        if (rootEl) {
          rootEl.style.minHeight = '100.01%';
          void rootEl.offsetHeight; // synchronous reflow
          rootEl.style.minHeight = '100%';
        }
      });

      // Fire a custom event so any mounted page can refetch its data.
      // Only trigger a data-refetch if the tab was hidden for > 30 seconds.
      if (hiddenMs > 30_000) {
        window.dispatchEvent(new CustomEvent('app:tabvisible', { detail: { hiddenMs } }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notificationRef = React.useRef<any>(null);

  // Derive display values from cached auth profile
  const userEmail = profile?.email || '';
  const userName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '';
  const userAvatar = profile?.avatar_url || '';

  // Only fetch notifications — profile comes from AuthContext
  useEffect(() => {
    if (!userId) return;
    const loadNotifications = async () => {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (notifs) setNotifications(notifs);
    };
    loadNotifications();
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

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

  if (isTeamAdmin && !isSuperuser) {
      menuGroups.push({
          title: 'TEAM',
          items: [
              { label: 'Mein Team', path: '/my-team', icon: UsersRound },
          ]
      });
  }

  const displayName = userName || (isSuperuser ? 'Super Admin' : 'User');

  return (
    <LayoutContext.Provider value={{ title, setTitle, subtitle, setSubtitle, actions, setActions, sidebarMenu, setSidebarMenu }}>
    <View style={styles.shell}>

      {/* ─── Sidebar ─── */}
      <View style={styles.sidebar}>
        <View style={styles.logoContainer}>
          <img 
            src="/logo.svg" 
            alt="DocStruc Logo" 
            style={{ width: 36, height: 36, borderRadius: 8 }}
          />
          <Text style={styles.logoText}>DocStruc</Text>
        </View>

        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          {sidebarMenu ? (
            // Project Detail Sidebar Menu
            <>
              <TouchableOpacity
                style={styles.backButtonSidebar}
                onPress={() => {
                  setSidebarMenu(null);
                  navigate('/');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>← Zurück zur Übersicht</Text>
              </TouchableOpacity>
              <View style={styles.navGroup}>
                <Text style={styles.navGroupLabel}>PROJEKT NAVIGATION</Text>
                {sidebarMenu.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.path}
                      style={[styles.navItem, isActive && styles.navItemActive]}
                      onPress={() => navigate(item.path)}
                      activeOpacity={0.7}
                    >
                      {isActive && <View style={styles.activeIndicator} />}
                      {Icon && <Icon size={20} color={isActive ? colors.primary : '#94a3b8'} strokeWidth={isActive ? 2.5 : 2} />}
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            // Default Menu
            <>
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
            </>
          )}
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
            <View ref={notificationRef} style={{ position: 'relative' as any, zIndex: 100 }}>
              <TouchableOpacity 
                style={styles.headerIconBtn}
                onPress={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} color="#475569" />
                {notifications.filter((n: any) => !n.is_read).length > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>

              {/* Notification Dropdown */}
              {showNotifications && (
                <View style={styles.notificationDropdown}>
                  <NotificationCenterWrapper onClose={() => setShowNotifications(false)} />
                </View>
              )}
            </View>
            <View style={styles.headerDivider} />
            <ProfileDropdown 
              userName={displayName}
              userEmail={userEmail}
              userAvatar={userAvatar}
            />
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
  backButtonSidebar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    marginHorizontal: 0,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
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
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', position: 'relative' as any, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', width: 280, gap: 10 },
  searchText: { flex: 1, color: '#94a3b8', fontSize: 14 },
  searchShortcut: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  searchShortcutText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16, position: 'relative' as any, zIndex: 200 },
  headerIconBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', position: 'relative' as any },
  notifDot: { position: 'absolute' as any, top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#F8FAFC' },
  notificationDropdown: {
    position: 'absolute' as any,
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    zIndex: 9999,
    maxHeight: 500,
    elevation: 9999,
    overflow: 'hidden' as any,
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
