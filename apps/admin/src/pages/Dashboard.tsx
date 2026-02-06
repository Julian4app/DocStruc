import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Users, Building2, CreditCard, DollarSign, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';

const KPICard = ({ title, value, trend, trendValue, icon: Icon, color }: { title: string, value: string, trend?: 'up' | 'down', trendValue?: string, icon: any, color: string }) => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <View>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardValue}>{value}</Text>
            </View>
            <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
                <Icon size={20} color={color} />
            </View>
        </View>
        
        {trendValue && (
            <View style={styles.trendRow}>
                <View style={[styles.trendBadge, trend === 'up' ? styles.trendUp : styles.trendDown]}>
                    {trend === 'up' ? <ArrowUpRight size={14} color="#10b981" /> : <ArrowDownRight size={14} color="#ef4444" />}
                    <Text style={[styles.trendText, trend === 'up' ? styles.trendTextUp : styles.trendTextDown]}>
                        {trendValue}
                    </Text>
                </View>
                <Text style={styles.trendLabel}>vs last month</Text>
            </View>
        )}
    </View>
);

export default function Dashboard() {
  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <View>
                <Text style={styles.pageTitle}>Dashboard</Text>
                <Text style={styles.pageSubtitle}>Overview of your business performance.</Text>
            </View>
        </View>

        {/* KPI Row */}
        <View style={styles.row}>
            <KPICard 
                title="Registered Users" 
                value="24,473" 
                trend="up" 
                trendValue="15.8%" 
                icon={Users} 
                color="#3b82f6" 
            />
            <KPICard 
                title="Total Customers" 
                value="892" 
                trend="up" 
                trendValue="8.2%" 
                icon={Building2} 
                color="#8b5cf6" 
            />
            <KPICard 
                title="Paid Customers" 
                value="654" 
                trend="up" 
                trendValue="5.4%" 
                icon={CreditCard} 
                color="#f59e0b" 
            />
            <KPICard 
                title="Monthly Turnover" 
                value="$363.95k" 
                trend="down" 
                trendValue="2.1%" 
                icon={DollarSign} 
                color="#10b981" 
            />
        </View>

        {/* Charts Row */}
        <View style={styles.row}>
             {/* Subscription Distribution */}
             <View style={[styles.card, styles.flex2, { paddingBottom: 0 }]}>
                <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>Customers by Plan</Text>
                    <MoreHorizontal size={20} color="#94a3b8" />
                </View>
                <View style={styles.chartContainer}>
                    {/* Mock Bars */}
                    {[
                        { label: 'Enterprise', height: '80%', color: '#3b82f6', count: '320' },
                        { label: 'Pro', height: '45%', color: '#10b981', count: '180' },
                        { label: 'Starter', height: '30%', color: '#f59e0b', count: '120' },
                        { label: 'Free', height: '10%', color: '#94a3b8', count: '34' }
                    ].map((bar, i) => (
                        <View key={i} style={styles.barGroup}>
                            <View style={styles.barTooltip}>
                                <Text style={styles.barTooltipText}>{bar.count}</Text>
                            </View>
                            <View style={[styles.bar, { height: bar.height as any, backgroundColor: bar.color }]} />
                            <Text style={styles.barLabel}>{bar.label}</Text>
                        </View>
                    ))}
                </View>
             </View>

             {/* Turnover Chart Placeholder */}
             <View style={[styles.card, styles.flex3]}>
                 <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>Revenue Growth</Text>
                    <View style={styles.pillSelector}>
                        <Text style={[styles.pillText, styles.pillActive]}>12 Months</Text>
                        <Text style={styles.pillText}>30 Days</Text>
                        <Text style={styles.pillText}>7 Days</Text>
                    </View>
                 </View>
                 <View style={styles.lineChartPlaceholder}>
                     {/* Horizontal Grid Lines */}
                     {[0.2, 0.4, 0.6, 0.8].map(h => (
                         <View key={h} style={[styles.gridLine, { bottom: `${h * 100}%` }]} />
                     ))}
                     
                     {/* The Line (CSS Art) */}
                     <View style={styles.polyLine}>
                         <View style={[styles.lineSegment, { left: '0%', bottom: '20%', height: 2, width: '20%', transform: [{ rotate: '-15deg' }] }]} /> 
                         <View style={[styles.linePoint, { bottom: '20%', left: '0%' }]} />
                         <View style={[styles.linePoint, { bottom: '40%', left: '20%' }]} />
                         <View style={[styles.linePoint, { bottom: '35%', left: '40%' }]} />
                         <View style={[styles.linePoint, { bottom: '60%', left: '60%' }]} />
                         <View style={[styles.linePoint, { bottom: '50%', left: '80%' }]} />
                         <View style={[styles.linePoint, { bottom: '80%', left: '100%' }]} />
                         <View style={{ position: 'absolute', bottom: 0, width: '100%', height: 1, backgroundColor: '#e2e8f0' }} />
                     </View>
                     
                     {/* Gradient Area (simulated with opacity blocks) */}
                     <View style={{position: 'absolute', bottom: 1, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(59, 130, 246, 0.05)'}} />
                 </View>
             </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.card}>
            <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Text style={styles.linkText}>View All</Text>
            </View>
            <View style={styles.activityList}>
                {[
                    { user: 'Alexander Smith', action: 'upgraded to', target: 'Pro Plan', time: '2 mins ago', initials: 'AS', color: '#3b82f6' },
                    { user: 'Sarah Connor', action: 'created a new project', target: 'Skynet Alpha', time: '1 hour ago', initials: 'SC', color: '#ec4899' },
                    { user: 'Michael Chen', action: 'invited 3 members to', target: 'Marketing Team', time: '3 hours ago', initials: 'MC', color: '#f59e0b' },
                ].map((item, i) => (
                    <View key={i} style={[styles.activityItem, i === 2 && { borderBottomWidth: 0 }]}>
                        <View style={[styles.avatar, { backgroundColor: item.color }]}>
                            <Text style={styles.avatarText}>{item.initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activityText}>
                                <Text style={styles.bold}>{item.user}</Text> {item.action} <Text style={styles.bold}>{item.target}</Text>
                            </Text>
                            <Text style={styles.activityTime}>{item.time}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingBottom: 40,
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center'
  },
  header: {
      marginBottom: 8
  },
  pageTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#0f172a',
      marginBottom: 4
  },
  pageSubtitle: {
      fontSize: 14,
      color: '#64748b'
  },
  row: {
      flexDirection: 'row',
      gap: 20,
      flexWrap: 'wrap'
  },
  flex2: { flex: 2, minWidth: 320 },
  flex3: { flex: 3, minWidth: 460 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flex: 1,
    minWidth: 260,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    padding: 20
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16
  },
  cardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
  },
  cardValue: {
      fontSize: 28,
      fontWeight: '700',
      color: '#0f172a',
      letterSpacing: -0.5
  },
  iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center'
  },
  trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
  },
  trendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 100
  },
  trendUp: { backgroundColor: '#ecfdf5' },
  trendDown: { backgroundColor: '#fef2f2' },
  trendText: { fontSize: 12, fontWeight: '600' },
  trendTextUp: { color: '#10b981' },
  trendTextDown: { color: '#ef4444' },
  trendLabel: {
      fontSize: 12,
      color: '#94a3b8'
  },
  chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f172a'
  },
  chartContainer: {
      height: 220,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      paddingBottom: 20
  },
  barGroup: {
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
      gap: 12,
      width: 48,
      position: 'relative'
  },
  bar: {
      width: '100%',
      borderRadius: 8,
      minHeight: 4 // Ensure tiny bars are visible
  },
  barLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: '#64748b'
  },
  barTooltip: {
      backgroundColor: '#1e293b',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginBottom: 4,
      opacity: 0, // Hidden for now, could animate in
  },
  barTooltipText: {
      color: 'white',
      fontSize: 10,
      fontWeight: '600'
  },
  
  // Line Chart
  lineChartPlaceholder: {
      height: 220,
      width: '100%',
      position: 'relative',
  },
  gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: '#f1f5f9',
      borderStyle: 'dashed'
  },
  polyLine: {
      flex: 1,
      position: 'relative'
  },
  linePoint: {
      width: 10,
      height: 10,
      borderRadius: 6,
      backgroundColor: '#3b82f6',
      position: 'absolute',
      borderWidth: 2,
      borderColor: 'white',
      shadowColor: '#3b82f6',
      shadowOpacity: 0.3, 
      shadowRadius: 4,
      zIndex: 10
  },
  lineSegment: {
      position: 'absolute',
      backgroundColor: '#3b82f6',
      transformOrigin: 'left bottom'
  },
  
  pillSelector: {
      flexDirection: 'row',
      backgroundColor: '#f1f5f9',
      padding: 4,
      borderRadius: 8,
      gap: 4
  },
  pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6
  },
  pillActive: {
      backgroundColor: 'white',
      color: '#0f172a',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 }
  },

  // Activity
  linkText: {
      color: '#3b82f6',
      fontSize: 13,
      fontWeight: '600'
  },
  activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      gap: 16
  },
  avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center'
  },
  avatarText: {
      color: 'white',
      fontWeight: '700',
      fontSize: 14
  },
  activityText: {
      fontSize: 14,
      color: '#334155'
  },
  activityTime: {
      fontSize: 12,
      color: '#94a3b8',
      marginTop: 2
  },
  bold: {
      fontWeight: '600',
      color: '#0f172a'
  },
  activityList: {
      paddingHorizontal: 0
  }
});
