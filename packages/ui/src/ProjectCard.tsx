import * as React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Card } from "./Card";
import { colors } from "@docstruc/theme";
import { Project } from "@docstruc/logic";

interface MapCoords {
  lat: number;
  lon: number;
}

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

  // images[] or picture_url may exist at runtime even if not in the TS type
  const projectImage: string | null =
    (project as any).images?.length > 0
      ? (project as any).images[0]
      : ((project as any).picture_url ?? null);

  // Geocode address via Nominatim to show a real OSM iframe map when there's no project image
  const [mapCoords, setMapCoords] = React.useState<MapCoords | null>(null);

  React.useEffect(() => {
    if (projectImage || !project.address) {
      setMapCoords(null);
      return;
    }
    let cancelled = false;
    fetch(
      'https://nominatim.openstreetmap.org/search?format=json&q=' +
        encodeURIComponent(project.address) +
        '&limit=1',
      { headers: { 'Accept-Language': 'de' } }
    )
      .then((r) => r.json())
      .then((data: Array<{ lat: string; lon: string }>) => {
        if (!cancelled && data.length > 0) {
          setMapCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.address, projectImage]);

  // Build the same OSM embed URL that MapDisplay.tsx uses
  const getOsmEmbedUrl = (lat: number, lon: number): string => {
    const delta = 0.005;
    const bbox = (lon - delta) + ',' + (lat - delta) + ',' + (lon + delta) + ',' + (lat + delta);
    return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + lat + ',' + lon;
  };

  const showMap = !projectImage && mapCoords !== null;

  return (
    <Card onPress={onPress} style={styles.cardOverride}>
      {/* Image / Map Header */}
      {(projectImage || showMap) && (
        <View style={styles.mediaContainer}>
          {projectImage ? (
            <View style={styles.imageWrapper}>
              {/* @ts-ignore */}
              <View style={[styles.imageBox, { backgroundImage: 'url(' + projectImage + ')' } as any]} />
            </View>
          ) : showMap ? (
            <View style={styles.imageWrapper}>
              {/* @ts-ignore - iframe is valid in react-native-web */}
              <iframe
                src={getOsmEmbedUrl(mapCoords!.lat, mapCoords!.lon)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  pointerEvents: 'none',
                } as React.CSSProperties}
                title="Projektstandort"
                loading="lazy"
              />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapLabel}>🗺️ Standort</Text>
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
              Zuletzt aktualisiert: {new Date(project.updated_at).toLocaleDateString('de-DE')}
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
                <Text style={[styles.address, { fontStyle: 'italic', opacity: 0.5 }]}>Keine Adresse hinterlegt</Text>
            )}
            
            {project.description && (
            <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
            )}
        </View>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Projekt öffnen</Text>
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
    minHeight: 280,
    padding: 0, 
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
    shadowColor: "#0E2A47",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
        web: {
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            ':hover': {
                transform: 'translateY(-8px) scale(1.02)',
                borderColor: colors.primary[200],
                boxShadow: '0 20px 40px -8px rgba(14, 42, 71, 0.12), 0 8px 16px -4px rgba(14, 42, 71, 0.06)',
            }
        } as any
    })
  },
  mediaContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    position: 'relative' as any,
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
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  mapLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  contentWrapper: {
      padding: 24,
      flex: 1,
      gap: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: '#0f172a', 
    marginBottom: 6,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  date: {
      fontSize: 13,
      color: '#94a3b8',
      fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: 'uppercase' as any,
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
      backgroundColor: '#FAFBFF',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
  },
  footerInfo: {
      flexDirection: 'row',
  },
  footerText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.2,
  },
  arrowBtn: {
      width: 32, 
      height: 32, 
      borderRadius: 16, 
      backgroundColor: colors.primary, 
      alignItems: 'center', 
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
  },
  arrow: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
});
