import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const KPICard = ({ title, value, trend, trendValue }: { title: string, value: string, trend?: 'up' | 'down', trendValue?: string }) => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{title}</Text>
             {/* Icon placeholder */}
             <View style={styles.iconPlaceholder} />
        </View>
        <Text style={styles.cardValue}>{value}</Text>
        {trendValue && (
            <View style={styles.trendContainer}>
                <View style={[styles.trendBadge, trend === 'up' ? styles.trendUp : styles.trendDown]}>
                    <Text style={[styles.trendText, trend === 'up' ? styles.trendTextUp : styles.trendTextDown]}>
                        {trend === 'up' ? '↗' : '↘'} {trendValue}
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
        {/* KPI Row */}
        <View style={styles.row}>
            <KPICard title="Registered Users" value="24,473" trend="up" trendValue="15.8%" />
            <KPICard title="Total Customers" value="892" trend="up" trendValue="8.2%" />
            <KPICard title="Paid Customers" value="654" trend="up" trendValue="5.4%" />
            <KPICard title="Monthly Turnover" value="$363.95k" trend="down" trendValue="2.1%" />
        </View>

        {/* Charts Row */}
        <View style={styles.row}>
             {/* Subscription Distribution */}
             <View style={[styles.card, styles.flex2]}>
                <View style={styles.headerRow}>
                    <Text style={styles.sectionTitle}>Customers per Subscription Type</Text>
                    {/* Filter placeholder */}
                </View>
                <View style={styles.chartContainer}>
                    {/* Mock Bars for Subscription Types */}
                    <View style={styles.barGroup}>
                        <View style={[styles.bar, { height: '80%', backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.barLabel}>Enterprise</Text>
                    </View>
                    <View style={styles.barGroup}>
                        <View style={[styles.bar, { height: '45%', backgroundColor: '#10B981' }]} />
                        <Text style={styles.barLabel}>Pro</Text>
                    </View>
                    <View style={styles.barGroup}>
                        <View style={[styles.bar, { height: '30%', backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.barLabel}>Starter</Text>
                    </View>
                     <View style={styles.barGroup}>
                        <View style={[styles.bar, { height: '10%', backgroundColor: '#6B7280' }]} />
                        <Text style={styles.barLabel}>Free</Text>
                    </View>
                </View>
             </View>

             {/* Turnover Chart Placeholder */}
             <View style={[styles.card, styles.flex3]}>
                 <Text style={styles.sectionTitle}>Turnover Development</Text>
                 <View style={styles.lineChartPlaceholder}>
                     <View style={[styles.linePoint, { bottom: '20%', left: '0%' }]} />
                     <View style={[styles.linePoint, { bottom: '40%', left: '20%' }]} />
                     <View style={[styles.linePoint, { bottom: '35%', left: '40%' }]} />
                     <View style={[styles.linePoint, { bottom: '60%', left: '60%' }]} />
                     <View style={[styles.linePoint, { bottom: '50%', left: '80%' }]} />
                     <View style={[styles.linePoint, { bottom: '80%', left: '100%' }]} />
                     {/* SVG Line connection would go here in real implementation */}
                     <View style={{ position: 'absolute', bottom: 0, width: '100%', height: 1, backgroundColor: '#E5E7EB' }} />
                 </View>
             </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingBottom: 40
  },
  row: {
      flexDirection: 'row',
      gap: 24,
      flexWrap: 'wrap'
  },
  flex2: { flex: 2, minWidth: 300 },
  flex3: { flex: 3, minWidth: 400 },
  card: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    flex: 1,
    minWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
  },
  cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6B7280'
  },
  iconPlaceholder: {
      width: 32,
      height: 32,
      backgroundColor: '#F3F4F6',
      borderRadius: 16
  },
  cardValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 12
  },
  trendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
  },
  trendBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center'
  },
  trendUp: { backgroundColor: '#ECFDF5' },
  trendDown: { backgroundColor: '#FEF2F2' },
  trendText: { fontSize: 12, fontWeight: '600' },
  trendTextUp: { color: '#059669' },
  trendTextDown: { color: '#DC2626' },
  trendLabel: {
      fontSize: 12,
      color: '#9CA3AF'
  },
  headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827'
  },
  chartContainer: {
      height: 200,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      paddingBottom: 20
  },
  barGroup: {
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
      gap: 8,
      width: 40
  },
  bar: {
      width: '100%',
      borderRadius: 6,
  },
  barLabel: {
      fontSize: 12,
      color: '#6B7280'
  },
  lineChartPlaceholder: {
      height: 200,
      marginTop: 20,
      position: 'relative'
  },
  linePoint: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#3B82F6',
      position: 'absolute',
      borderWidth: 2,
      borderColor: 'white'
  }
});
