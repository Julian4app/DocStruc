import * as React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Card } from "./Card";
import { colors, spacing } from "@docstruc/theme";
import { Project } from "@docstruc/logic";

export interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.status?.inWork || '#3B82F6';
      case 'completed': return colors.status?.agreed || '#10B981';
      case 'planning': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const statusColor = getStatusColor(project.status);

  return (
    <Card onPress={onPress} style={styles.cardOverride}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
            <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
                <Text style={styles.date}>
                Last update: {new Date(project.updated_at).toLocaleDateString()}
                </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
                {project.status ? project.status.toUpperCase() : 'PLANNING'}
            </Text>
            </View>
        </View>
        
        <View style={styles.body}>
            {project.address ? (
                <View style={styles.addressRow}>
                    <Text style={styles.addressIcon}>📍</Text>
                    <Text style={styles.address} numberOfLines={1}>{project.address}</Text>
                </View>
            ) : (
                <Text style={[styles.address, { fontStyle: 'italic', opacity: 0.5 }]}>No address set</Text>
            )}
            
            {project.description && (
            <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
            )}
        </View>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
             <Text style={styles.footerText}>Open Project</Text>
        </View>
        <View style={styles.arrowBtn}>
            <Text style={styles.arrow}>→</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardOverride: {
    minHeight: 180,
    padding: 0, 
    borderWidth: 0,
    shadowColor: "#0E2A47",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    ...Platform.select({
        web: {
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            ':hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 25px -5px rgba(14, 42, 71, 0.1), 0 10px 10px -5px rgba(14, 42, 71, 0.04)'
            }
        } as any
    })
  },
  contentWrapper: {
      padding: 24,
      flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary, 
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  date: {
      fontSize: 12,
      color: '#94a3b8',
      fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    gap: 8,
  },
  addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  addressIcon: {
      fontSize: 14,
  },
  address: {
      fontSize: 14,
      color: '#64748b',
      fontWeight: '500',
  },
  description: {
      fontSize: 14,
      color: '#64748b',
      lineHeight: 20,
  },
  footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: '#F8FAFC',
      borderTopWidth: 1,
      borderTopColor: '#F1F5F9',
  },
  footerInfo: {
      flexDirection: 'row',
  },
  footerText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
  },
  arrowBtn: {
      width: 28, 
      height: 28, 
      borderRadius: 14, 
      backgroundColor: 'white', 
      alignItems: 'center', 
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 2,
  },
  arrow: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
    marginBottom: 2,
  },
});
