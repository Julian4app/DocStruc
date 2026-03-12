import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ReportData {
  generatedAt: string;
  users: { total: number; newThisMonth: number; admins: number };
  projects: { total: number; byStatus: Record<string, number> };
  companies: { total: number; byStatus: Record<string, number>; leads: number; active: number };
  subscriptions: { total: number; revenue: number; byFrequency: Record<string, number> };
  invoices: { total: number; open: number; paid: number; delayed: number; openAmount: number; paidAmount: number };
  feedback: { total: number; avgRating: number | null; byCategory: Record<string, number> };
  support: { total: number; open: number; inProgress: number; resolved: number };
  recentUsers: any[];
  topCompanies: any[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        usersAll, usersMonth, usersAdmin,
        projects,
        companies,
        subscriptions,
        invoices,
        feedback,
        support,
        recentUsers,
        topCompanies,
      ] = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true),
        supabase.from('projects').select('id, status'),
        supabase.from('companies').select('id, name, status, employees_count, accounts_count'),
        supabase.from('company_subscriptions').select('id, frequency, invoice_amount, status'),
        supabase.from('invoices').select('id, status, amount'),
        supabase.from('feedback').select('id, rating, category'),
        supabase.from('support_messages').select('id, status'),
        supabase.from('profiles').select('id, email, first_name, last_name, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('companies').select('id, name, status, employees_count, accounts_count').order('accounts_count', { ascending: false }).limit(5),
      ]);

      const get = <T,>(r: PromiseSettledResult<any>): T | null =>
        r.status === 'fulfilled' ? r.value as T : null;

      const projectData: any[] = get<any>(projects)?.data || [];
      const companyData: any[] = get<any>(companies)?.data || [];
      const subData: any[] = get<any>(subscriptions)?.data || [];
      const invoiceData: any[] = get<any>(invoices)?.data || [];
      const feedbackData: any[] = get<any>(feedback)?.data || [];
      const supportData: any[] = get<any>(support)?.data || [];

      // projects by status
      const projectsByStatus: Record<string, number> = {};
      projectData.forEach((p) => {
        projectsByStatus[p.status] = (projectsByStatus[p.status] || 0) + 1;
      });

      // companies by status
      const companiesByStatus: Record<string, number> = {};
      companyData.forEach((c) => {
        const s = c.status || 'unknown';
        companiesByStatus[s] = (companiesByStatus[s] || 0) + 1;
      });

      // subscriptions
      const subsByFreq: Record<string, number> = {};
      let totalRevenue = 0;
      subData.forEach((s) => {
        if (s.status === 'active') {
          subsByFreq[s.frequency] = (subsByFreq[s.frequency] || 0) + 1;
          totalRevenue += Number(s.invoice_amount) || 0;
        }
      });

      // invoices
      let openAmount = 0, paidAmount = 0;
      invoiceData.forEach((inv) => {
        if (inv.status === 'open' || inv.status === 'delayed') openAmount += Number(inv.amount) || 0;
        if (inv.status === 'paid') paidAmount += Number(inv.amount) || 0;
      });

      // feedback
      const ratings = feedbackData.map((f) => f.rating).filter((r): r is number => typeof r === 'number');
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;
      const feedbackByCategory: Record<string, number> = {};
      feedbackData.forEach((f) => {
        feedbackByCategory[f.category] = (feedbackByCategory[f.category] || 0) + 1;
      });

      // support
      const supportByStatus: Record<string, number> = {};
      supportData.forEach((s) => {
        supportByStatus[s.status] = (supportByStatus[s.status] || 0) + 1;
      });

      setData({
        generatedAt: now.toISOString(),
        users: {
          total: get<any>(usersAll)?.count ?? 0,
          newThisMonth: get<any>(usersMonth)?.count ?? 0,
          admins: get<any>(usersAdmin)?.count ?? 0,
        },
        projects: { total: projectData.length, byStatus: projectsByStatus },
        companies: {
          total: companyData.length,
          byStatus: companiesByStatus,
          leads: companiesByStatus['lead'] || 0,
          active: companiesByStatus['active'] || 0,
        },
        subscriptions: {
          total: subData.filter((s) => s.status === 'active').length,
          revenue: totalRevenue,
          byFrequency: subsByFreq,
        },
        invoices: {
          total: invoiceData.length,
          open: invoiceData.filter((i) => i.status === 'open').length,
          paid: invoiceData.filter((i) => i.status === 'paid').length,
          delayed: invoiceData.filter((i) => i.status === 'delayed').length,
          openAmount,
          paidAmount,
        },
        feedback: { total: feedbackData.length, avgRating, byCategory: feedbackByCategory },
        support: {
          total: supportData.length,
          open: supportByStatus['open'] || 0,
          inProgress: supportByStatus['in_progress'] || 0,
          resolved: supportByStatus['resolved'] || 0,
        },
        recentUsers: get<any>(recentUsers)?.data || [],
        topCompanies: get<any>(topCompanies)?.data || [],
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Erstelle Report…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.errorWrap}>
        <p style={{ color: '#ef4444' }}>Fehler beim Laden: {error}</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    active: 'Aktiv', inactive: 'Inaktiv', lead: 'Lead',
    'In Planung': 'In Planung', 'Genehmigt': 'Genehmigt',
    'In Ausführung': 'In Ausführung', 'Abgeschlossen': 'Abgeschlossen',
    open: 'Offen', in_progress: 'In Bearbeitung', resolved: 'Gelöst',
    monthly: 'Monatlich', quarterly: 'Quartalsweise', yearly: 'Jährlich',
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-page { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={styles.toolbar}>
        <div>
          <h1 style={styles.toolbarTitle}>System Report</h1>
          <p style={styles.toolbarSub}>
            Generiert am {new Date(data.generatedAt).toLocaleDateString('de-DE', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <button onClick={handlePrint} style={styles.printBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Als PDF drucken / exportieren
        </button>
      </div>

      {/* Report Content */}
      <div ref={printRef} className="report-page" style={styles.page}>
        {/* Header */}
        <div style={styles.reportHeader}>
          <div>
            <div style={styles.reportLogo}>DocStruc</div>
            <div style={styles.reportSubtitle}>Admin System Report</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.reportDate}>
              {new Date(data.generatedAt).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </div>
            <div style={styles.reportDateSub}>
              {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
            <div style={styles.confidentialBadge}>VERTRAULICH</div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Executive Summary */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Executive Summary</h2>
          <div style={styles.kpiGrid}>
            <KPI label="Registrierte Nutzer" value={data.users.total} color="#3b82f6" />
            <KPI label="Neue Nutzer (Monat)" value={data.users.newThisMonth} color="#8b5cf6" />
            <KPI label="Kunden (Firmen)" value={data.companies.total} color="#f59e0b" />
            <KPI label="Projekte gesamt" value={data.projects.total} color="#10b981" />
            <KPI label="Aktive Abonnements" value={data.subscriptions.total} color="#06b6d4" />
            <KPI label="Monatl. Umsatz (aktiv)" value={formatCurrency(data.subscriptions.revenue)} color="#22c55e" />
            <KPI label="Offene Rechnungen" value={formatCurrency(data.invoices.openAmount)} color="#ef4444" />
            <KPI label="Bezahlte Rechnungen" value={formatCurrency(data.invoices.paidAmount)} color="#64748b" />
          </div>
        </div>

        {/* Users */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>👥 Nutzer & Zugänge</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Nutzer gesamt', data.users.total],
              ['Neue Nutzer (diesen Monat)', data.users.newThisMonth],
              ['Admin-Nutzer', data.users.admins],
              ['Reguläre Nutzer', data.users.total - data.users.admins],
            ]} />
            <div style={styles.statCard}>
              <div style={styles.statCardTitle}>Neueste Registrierungen</div>
              {data.recentUsers.slice(0, 6).map((u) => (
                <div key={u.id} style={styles.listRow}>
                  <div style={{ ...styles.avatar, backgroundColor: '#3b82f6' }}>
                    {((u.first_name?.[0] || '') + (u.last_name?.[0] || '') || u.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.listName}>
                      {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || 'Unbekannt'}
                    </div>
                    {u.email && (u.first_name || u.last_name) && (
                      <div style={styles.listSub}>{u.email}</div>
                    )}
                  </div>
                  <div style={styles.listDate}>{formatDate(u.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Companies */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🏢 Kunden & Firmen</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Firmen gesamt', data.companies.total],
              ['Aktive Kunden', data.companies.active],
              ['Leads', data.companies.leads],
              ['Inaktive Kunden', data.companies.byStatus['inactive'] || 0],
            ]} />
            <div style={styles.statCard}>
              <div style={styles.statCardTitle}>Top Firmen (nach Accounts)</div>
              {data.topCompanies.map((c, i) => (
                <div key={c.id} style={styles.listRow}>
                  <div style={{ ...styles.rankBadge, backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#cd7c54' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.listName}>{c.name}</div>
                    <div style={styles.listSub}>{c.employees_count || 0} Mitarbeiter · {c.accounts_count || 0} Accounts</div>
                  </div>
                  <StatusPill status={c.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Projects */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📁 Projekte</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Projekte gesamt', data.projects.total],
              ...Object.entries(data.projects.byStatus).map(([k, v]) => [statusLabels[k] || k, v] as [string, number]),
            ]} />
            <BarChart
              title="Projekte nach Status"
              data={Object.entries(data.projects.byStatus).map(([k, v]) => ({ label: statusLabels[k] || k, value: v }))}
              total={data.projects.total}
              color="#8b5cf6"
            />
          </div>
        </div>

        {/* Subscriptions & Revenue */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>💳 Abonnements & Umsatz</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Aktive Abonnements', data.subscriptions.total],
              ['Monatlicher Umsatz (aktiv)', formatCurrency(data.subscriptions.revenue)],
              ...Object.entries(data.subscriptions.byFrequency).map(([k, v]) => [statusLabels[k] || k, v] as [string, number]),
            ]} />
            <BarChart
              title="Abonnements nach Laufzeit"
              data={Object.entries(data.subscriptions.byFrequency).map(([k, v]) => ({ label: statusLabels[k] || k, value: v }))}
              total={data.subscriptions.total}
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Invoices */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🧾 Rechnungen</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Rechnungen gesamt', data.invoices.total],
              ['Offen', data.invoices.open],
              ['Bezahlt', data.invoices.paid],
              ['Überfällig', data.invoices.delayed],
              ['Offener Betrag', formatCurrency(data.invoices.openAmount)],
              ['Bezahlter Betrag', formatCurrency(data.invoices.paidAmount)],
            ]} />
            <BarChart
              title="Rechnungen nach Status"
              data={[
                { label: 'Offen', value: data.invoices.open, color: '#f59e0b' },
                { label: 'Bezahlt', value: data.invoices.paid, color: '#10b981' },
                { label: 'Überfällig', value: data.invoices.delayed, color: '#ef4444' },
              ]}
              total={data.invoices.total}
              color="#10b981"
            />
          </div>
        </div>

        {/* Feedback */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>⭐ Feedback & Bewertungen</h2>
          <div style={styles.twoCol}>
            <StatTable rows={[
              ['Feedbacks gesamt', data.feedback.total],
              ['Ø Bewertung', data.feedback.avgRating != null ? `${data.feedback.avgRating} / 5` : '–'],
              ...Object.entries(data.feedback.byCategory).map(([k, v]) => [k, v] as [string, number]),
            ]} />
            <BarChart
              title="Feedback nach Kategorie"
              data={Object.entries(data.feedback.byCategory).map(([k, v]) => ({ label: k, value: v }))}
              total={data.feedback.total}
              color="#f59e0b"
            />
          </div>
        </div>

        {/* Support */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🎧 Support-Anfragen</h2>
          <StatTable rows={[
            ['Gesamt', data.support.total],
            ['Offen', data.support.open],
            ['In Bearbeitung', data.support.inProgress],
            ['Gelöst', data.support.resolved],
          ]} />
        </div>

        {/* Footer */}
        <div style={styles.divider} />
        <div style={styles.footer}>
          <span>DocStruc Admin System Report</span>
          <span>Vertraulich – Nur für interne Verwendung</span>
          <span>Generiert: {new Date(data.generatedAt).toLocaleString('de-DE')}</span>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPI({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...styles.kpiCard, borderTopColor: color }}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function StatTable({ rows }: { rows: [string, string | number][] }) {
  return (
    <table style={styles.table}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}>
            <td style={styles.tdLabel}>{label}</td>
            <td style={styles.tdValue}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BarChart({
  title, data, total, color,
}: {
  title: string;
  data: { label: string; value: number; color?: string }[];
  total: number;
  color: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardTitle}>{title}</div>
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{d.label}</span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{d.value} ({pct}%)</span>
            </div>
            <div style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                backgroundColor: d.color || color,
                borderRadius: 4,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    active: { bg: '#dcfce7', text: '#166534' },
    lead: { bg: '#eff6ff', text: '#1d4ed8' },
    inactive: { bg: '#f1f5f9', text: '#64748b' },
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      backgroundColor: s.bg, color: s.text,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: 300, gap: 16,
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid #e2e8f0', borderTopColor: '#0E2A47',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#64748b', fontSize: 15, margin: 0 },
  errorWrap: { padding: 40, textAlign: 'center' },

  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', backgroundColor: '#0E2A47', borderRadius: 12,
    marginBottom: 24, gap: 16,
  },
  toolbarTitle: { margin: 0, color: 'white', fontSize: 20, fontWeight: 700 },
  toolbarSub: { margin: '4px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  printBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    backgroundColor: 'white', color: '#0E2A47',
    border: 'none', borderRadius: 8, padding: '10px 20px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    flexShrink: 0,
  },

  page: {
    backgroundColor: 'white', borderRadius: 12, padding: '40px 48px',
    boxShadow: '0 4px 32px rgba(0,0,0,0.08)', maxWidth: 1000,
    margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  reportHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24,
  },
  reportLogo: {
    fontSize: 28, fontWeight: 800, color: '#0E2A47', letterSpacing: -0.5,
  },
  reportSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  reportDate: { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  reportDateSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  confidentialBadge: {
    display: 'inline-block', marginTop: 8,
    fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
    padding: '3px 10px', borderRadius: 4,
    backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
  },

  divider: { height: 1, backgroundColor: '#e2e8f0', margin: '24px 0' },

  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 18, fontWeight: 700, color: '#0f172a',
    margin: '0 0 16px', borderLeft: '4px solid #0E2A47',
    paddingLeft: 12,
  },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
  },
  kpiCard: {
    padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
    borderTopWidth: 3, backgroundColor: '#fafafa',
  },
  kpiValue: { fontSize: 22, fontWeight: 800, marginBottom: 4 },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  tdLabel: { padding: '9px 14px', color: '#334155', fontWeight: 500, width: '65%' },
  tdValue: { padding: '9px 14px', color: '#0f172a', fontWeight: 700, textAlign: 'right' },

  statCard: {
    border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px',
    backgroundColor: '#fafafa',
  },
  statCardTitle: {
    fontSize: 13, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
  },
  listRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0,
  },
  rankBadge: {
    width: 24, height: 24, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0,
  },
  listName: { fontSize: 13, fontWeight: 600, color: '#0f172a' },
  listSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  listDate: { fontSize: 12, color: '#94a3b8', flexShrink: 0 },

  footer: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 11, color: '#94a3b8', paddingTop: 8,
  },
};
