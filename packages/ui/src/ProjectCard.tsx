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
      <View style={styles.header}>
        <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {project.status ? project.status.toUpperCase() : 'PLANNING'}
          </Text>
        </View>
      </View>
      
      <View style={styles.content}>
        {project.address ? (
            <Text style={styles.address} numberOfLines={2}>📍 {project.address}</Text>
        ) : (
            <Text style={[styles.address, { fontStyle: 'italic', opacity: 0.5 }]}>Keine Adresse hinterlegt</Text>
        )}
        
        {project.description && (
          <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
        )}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.date}>
          Updated: {new Date(project.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardOverride: {
    minHeight: 160,
    justifyContent: 'space-between',
    ...Platform.select({
        web: {
            cursor: 'pointer',
            transition: 'transform 0.2s',
            ':hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }
        } as any
    })
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.m,
  },
  titleContainer: {
    flex: 1,
    paddingRight: spacing.s,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  address: {
    fontSize: 14,
    color: colors.textStart || '#4B5563',
    marginBottom: spacing.s,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.m,
    paddingTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  arrow: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  }
});
