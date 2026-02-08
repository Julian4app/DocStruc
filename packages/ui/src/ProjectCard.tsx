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
    // Match colors from StatusSelect
    const statusMap: Record<string, { color: string; bgColor: string }> = {
      'Angefragt': { color: '#0ea5e9', bgColor: '#e0f2fe' },
      'In Planung': { color: '#8b5cf6', bgColor: '#f3e8ff' },
      'Genehmigt': { color: '#10b981', bgColor: '#d1fae5' },
      'In Ausf\u00fchrung': { color: '#f59e0b', bgColor: '#fef3c7' },
      'Abgeschlossen': { color: '#059669', bgColor: '#d1fae5' },
      'Pausiert': { color: '#64748b', bgColor: '#f1f5f9' },
      'Abgebrochen': { color: '#ef4444', bgColor: '#fee2e2' },
      'Nachbesserung': { color: '#f97316', bgColor: '#ffedd5' },
    };
    return statusMap[status] || { color: '#64748b', bgColor: '#f1f5f9' };
  };

  const statusInfo = getStatusColor(project.status || 'Angefragt');
  
  // Get first image from project
  const projectImage = project.images && project.images.length > 0 ? project.images[0] : project.picture_url;
  
  // Generate Google Maps static image URL if address exists
  const getMapUrl = (address: string) => {
    if (!address) return null;
    const encodedAddress = encodeURIComponent(address);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=YOUR_API_KEY`;
  };
  
  const mapUrl = project.address ? getMapUrl(project.address) : null;

  return (
    <Card onPress={onPress} style={styles.cardOverride}>
      {/* Image/Map Header */}
      {(projectImage || mapUrl) && (
        <View style={styles.mediaContainer}>
          {projectImage ? (
            <View style={styles.imageWrapper}>
              <View style={[styles.imageBox, { backgroundImage: `url(${projectImage})` } as any]} />
            </View>
          ) : mapUrl ? (
            <View style={styles.imageWrapper}>
              <View style={[styles.imageBox, { backgroundImage: `url(${mapUrl})` } as any]} />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapLabel}>🗺️ Map View</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
      
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
            <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={1}>{project.name}</Text>
                <Text style={styles.date}>
                Last update: {new Date(project.updated_at).toLocaleDateString()}
                </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusInfo.bgColor }]}>
            <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                {project.status || 'Angefragt'}
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
    minHeight: 240,
    padding: 0, 
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#0E2A47",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderRadius: 18,
    overflow: 'hidden',
    ...Platform.select({
        web: {
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
            ':hover': {
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 24px -6px rgba(14, 42, 71, 0.08), 0 6px 12px -4px rgba(14, 42, 71, 0.03)'
            }
        } as any
    })
  },
  mediaContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative' as any,
  },
  imageBox: {
    width: '100%',
    height: '100%',
    // @ts-ignore
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  mapOverlay: {
    position: 'absolute' as any,
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
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
      paddingVertical: 14,
      backgroundColor: '#FAFBFC',
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
