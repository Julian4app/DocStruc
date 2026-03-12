import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  Users, FolderKanban, MessageSquare, Star,
  ArrowUpRight, TrendingUp, Building2, CreditCard, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalUsers: number;
  newUsersThisMonth: number;
  totalProjects: number;
  activeProjects: number;
  totalCompanies: number;
  totalFeedback: number;
  avgRating: number | null;
  openSupportMessages: number;
  totalSubscriptions: number;
}

interface RecentUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface RecentFeedback {
  id: string;
  message: string;
  rating: number | null;
  category: string;
  email: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
};

const initials = (first: string | null, last: string | null, email: string | null) => {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
};

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KPICard = ({
  title, value, sub, icon: Icon, color, loading,
}: {
  title: string; value: string | number; sub?: string;
  icon: any; color: string; loading?: boolean;
}) => (
  <View style={styles.kpiCard}>
    <View style={styles.kpiTop}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiTitle}>{title}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={color} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
        ) : (
          <Text style={styles.kpiValue}>{value}</Text>
        )}
      </View>
      <View style={[styles.kpiIconBox, { backgroundColor: `${color}18` }]}>
        <Icon size={22} color={color} />
      </View>
    </View>
    {sub && !loading && (
      <View style={styles.kpiSubRow}>
        <ArrowUpRight size={13} color="#10b981" />
        <Text style={styles.kpiSub}>{sub}</Text>
      </View>
    )}
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<RecentFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        usersRes,
        newUsersRes,
        projectsRes,
        companiesRes,
        feedbackRes,
        supportRes,
        subscriptionsRes,
        recentUsersRes,
        recentFeedbackRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth.toISOString()),
        supabase.from('projects').select('id, status'),
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('feedback').select('rating'),
        supabase.from('support_messages').select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase.from('company_subscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id, email, first_name, last_name, created_at')
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('feedback').select('id, message, rating, category, email, created_at')
          .order('created_at', { ascending: false }).limit(5),
      ]);

      const allProjects = projectsRes.data || [];
      const activeStatuses = ['In Planung', 'Genehmigt', 'In Ausführung', 'active', 'planning'];
      const activeProjects = allProjects.filter((p: any) => activeStatuses.includes(p.status)).length;

      const ratings = (feedbackRes.data || [])
        .map((f: any) => f.rating)
        .filter((r: any): r is number => typeof r === 'number');
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      setStats({
        totalUsers: usersRes.count ?? 0,
        newUsersThisMonth: newUsersRes.count ?? 0,
        totalProjects: allProjects.length,
        activeProjects,
        totalCompanies: companiesRes.count ?? 0,
        totalFeedback: feedbackRes.data?.length ?? 0,
        avgRating,
        openSupportMessages: supportRes.count ?? 0,
        totalSubscriptions: subscriptionsRes.count ?? 0,
      });

      setRecentUsers(recentUsersRes.data || []);
      setRecentFeedback(recentFeedbackRes.data || []);
    } catch (e) {
      console.error('Admin Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <Text style={styles.pageSubtitle}>Echtzeit-Übersicht aller Plattform-Kennzahlen</Text>
      </View>

      {/* KPI Row 1 */}
      <View style={styles.row}>
        <KPICard
          title="Registrierte Nutzer"
          value={stats?.totalUsers ?? '—'}
          sub={stats ? `+${stats.newUsersThisMonth} diesen Monat` : undefined}
          icon={Users}
          color="#3b82f6"
          loading={loading}
        />
        <KPICard
          title="Projekte gesamt"
          value={stats?.totalProjects ?? '—'}
          sub={stats ? `${stats.activeProjects} aktiv` : undefined}
          icon={FolderKanban}
          color="#8b5cf6"
          loading={loading}
        />
        <KPICard
          title="Kunden (Firmen)"
          value={stats?.totalCompanies ?? '—'}
          sub={stats ? `${stats.totalSubscriptions} Abonnements` : undefined}
          icon={Building2}
          color="#f59e0b"
          loading={loading}
        />
        <KPICard
          title="Ø Bewertung"
          value={stats?.avgRating != null ? `${stats.avgRating} / 5` : '—'}
          sub={stats ? `aus ${stats.totalFeedback} Feedbacks` : undefined}
          icon={Star}
          color="#10b981"
          loading={loading}
        />
      </View>

      {/* KPI Row 2 */}
      <View style={[styles.row, { marginBottom: 8 }]}>
        <KPICard
          title="Offene Support-Anfragen"
          value={stats?.openSupportMessages ?? '—'}
          icon={AlertCircle}
          color="#ef4444"
          loading={loading}
        />
        <KPICard
          title="Abonnements aktiv"
          value={stats?.totalSubscriptions ?? '—'}
          icon={CreditCard}
          color="#06b6d4"
          loading={loading}
        />
        <KPICard
          title="Aktive Projekte"
          value={stats?.activeProjects ?? '—'}
          sub={stats ? `von ${stats.totalProjects} gesamt` : undefined}
          icon={TrendingUp}
          color="#22c55e"
          loading={loading}
        />
        <KPICard
          title="Feedbacks gesamt"
          value={stats?.totalFeedback ?? '—'}
          icon={MessageSquare}
          color="#f97316"
          loading={loading}
        />
      </View>

      {/* Bottom Row */}
      <View style={styles.row}>
        {/* Recent Users */}
        <View style={[styles.card, styles.flex1]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Neue Nutzer</Text>
            <Users size={16} color="#64748b" />
          </View>
          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 16 }} />
          ) : recentUsers.length === 0 ? (
            <Text style={styles.emptyText}>Keine Nutzer gefunden</Text>
          ) : (
            recentUsers.map((u, i) => (
              <View key={u.id} style={[styles.listItem, i === recentUsers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(u.id) }]}>
                  <Text style={styles.avatarText}>{initials(u.first_name, u.last_name, u.email)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>
                    {u.first_name && u.last_name
                      ? `${u.first_name} ${u.last_name}`
                      : u.email ?? 'Unbekannt'}
                  </Text>
                  {u.email && (u.first_name || u.last_name) && (
                    <Text style={styles.listItemSub}>{u.email}</Text>
                  )}
                </View>
                <Text style={styles.listItemTime}>{formatRelative(u.created_at)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Recent Feedback */}
        <View style={[styles.card, styles.flex1]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Neuestes Feedback</Text>
            <MessageSquare size={16} color="#64748b" />
          </View>
          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 16 }} />
          ) : recentFeedback.length === 0 ? (
            <Text style={styles.emptyText}>Kein Feedback vorhanden</Text>
          ) : (
            recentFeedback.map((fb, i) => (
              <View key={fb.id} style={[styles.listItem, i === recentFeedback.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {fb.rating != null && (
                      <View style={styles.ratingBadge}>
                        <Star size={10} color="#f59e0b" />
                        <Text style={styles.ratingText}>{fb.rating}</Text>
                      </View>
                    )}
                    <Text style={styles.categoryBadge}>{fb.category}</Text>
                  </View>
                  <Text style={styles.listItemTitle} numberOfLines={2}>{fb.message}</Text>
                  {fb.email && <Text style={styles.listItemSub}>{fb.email}</Text>}
                </View>
                <Text style={styles.listItemTime}>{formatRelative(fb.created_at)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingBottom: 40,
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  flex1: { flex: 1, minWidth: 300 },
  // KPI Card
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  kpiIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiSub: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  // List Card
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  listItemSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  listItemTime: {
    fontSize: 12,
    color: '#94a3b8',
    flexShrink: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
