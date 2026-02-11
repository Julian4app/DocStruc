import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { FolderOpen, Upload, File, FileText, Image, Video, Folder, Download, MoreVertical } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: string;
  size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
}

interface FolderStructure {
  id: string;
  name: string;
  files: FileItem[];
}

export function ProjectFiles() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<FolderStructure[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    folders: 0
  });

  useEffect(() => {
    if (id) {
      loadFiles();
    }
  }, [id]);

  const loadFiles = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Mock folder structure - in real app this would come from storage bucket
      const mockFolders: FolderStructure[] = [
        {
          id: '1',
          name: 'Pläne & Zeichnungen',
          files: [
            {
              id: 'f1',
              name: 'Grundriss_EG.pdf',
              type: 'file',
              fileType: 'pdf',
              size: 2457600,
              uploaded_at: '2026-02-10T10:30:00',
              uploaded_by: 'Max Mustermann'
            },
            {
              id: 'f2',
              name: 'Ansicht_Nord.pdf',
              type: 'file',
              fileType: 'pdf',
              size: 1843200,
              uploaded_at: '2026-02-09T14:20:00',
              uploaded_by: 'Max Mustermann'
            }
          ]
        },
        {
          id: '2',
          name: 'Verträge',
          files: [
            {
              id: 'f3',
              name: 'Bauvertrag.pdf',
              type: 'file',
              fileType: 'pdf',
              size: 524288,
              uploaded_at: '2026-02-01T09:00:00',
              uploaded_by: 'Admin'
            }
          ]
        },
        {
          id: '3',
          name: 'Fotos',
          files: [
            {
              id: 'f4',
              name: 'Baustelle_20260210.jpg',
              type: 'file',
              fileType: 'image',
              size: 3145728,
              uploaded_at: '2026-02-10T16:45:00',
              uploaded_by: 'Team'
            }
          ]
        },
        {
          id: '4',
          name: 'Sonstiges',
          files: []
        }
      ];

      setFolders(mockFolders);

      // Calculate stats
      const totalFiles = mockFolders.reduce((sum, folder) => sum + folder.files.length, 0);
      const totalSize = mockFolders.reduce((sum, folder) => 
        sum + folder.files.reduce((s, f) => s + (f.size || 0), 0), 0
      );

      setStats({
        totalFiles,
        totalSize,
        folders: mockFolders.length
      });
    } catch (error: any) {
      console.error('Error loading files:', error);
      showToast('Fehler beim Laden der Dateien', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    showToast('Upload-Funktion folgt in Kürze', 'info');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText size={20} color="#DC2626" />;
      case 'image':
        return <Image size={20} color="#10B981" />;
      case 'video':
        return <Video size={20} color="#8B5CF6" />;
      default:
        return <File size={20} color="#64748b" />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Dokumente</Text>
          <Text style={styles.pageSubtitle}>
            Datei-Repository für Pläne, Verträge und Dokumente
          </Text>
        </View>
        <Button onClick={handleUpload}>
          <Upload size={18} /> Hochladen
        </Button>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <File size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.totalFiles}</Text>
          <Text style={styles.statLabel}>Dateien</Text>
        </Card>
        <Card style={styles.statCard}>
          <Folder size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.folders}</Text>
          <Text style={styles.statLabel}>Ordner</Text>
        </Card>
        <Card style={styles.statCard}>
          <Download size={24} color="#10B981" />
          <Text style={styles.statValue}>{formatFileSize(stats.totalSize)}</Text>
          <Text style={styles.statLabel}>Gesamt</Text>
        </Card>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {folders.map(folder => (
          <Card key={folder.id} style={styles.folderCard}>
            <TouchableOpacity
              style={styles.folderHeader}
              onPress={() => setCurrentFolder(
                currentFolder === folder.id ? null : folder.id
              )}
            >
              <View style={styles.folderTitleRow}>
                <Folder size={24} color="#F59E0B" />
                <Text style={styles.folderName}>{folder.name}</Text>
                <View style={styles.folderBadge}>
                  <Text style={styles.folderBadgeText}>
                    {folder.files.length} {folder.files.length === 1 ? 'Datei' : 'Dateien'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {currentFolder === folder.id && (
              <View style={styles.filesList}>
                {folder.files.length === 0 ? (
                  <Text style={styles.emptyText}>Keine Dateien in diesem Ordner</Text>
                ) : (
                  folder.files.map(file => (
                    <View key={file.id} style={styles.fileCard}>
                      <View style={styles.fileIconContainer}>
                        {getFileIcon(file.fileType)}
                      </View>
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName}>{file.name}</Text>
                        <View style={styles.fileMeta}>
                          <Text style={styles.fileMetaText}>
                            {file.size && formatFileSize(file.size)}
                          </Text>
                          <Text style={styles.fileMetaSep}>•</Text>
                          <Text style={styles.fileMetaText}>
                            {file.uploaded_at && formatDate(file.uploaded_at)}
                          </Text>
                          {file.uploaded_by && (
                            <>
                              <Text style={styles.fileMetaSep}>•</Text>
                              <Text style={styles.fileMetaText}>{file.uploaded_by}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={styles.fileActions}>
                        <MoreVertical size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </Card>
        ))}

        {/* Info Box */}
        <Card style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            💡 Datei-Upload, Versionierung und Freigabe-Funktionen werden in einer
            späteren Version implementiert. Die Dateien werden sicher in Supabase Storage
            gespeichert.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  folderCard: {
    padding: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    overflow: 'hidden',
  },
  folderHeader: {
    padding: 20,
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  folderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  folderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filesList: {
    padding: 20,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginBottom: 8,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  fileMetaText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  fileMetaSep: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  fileActions: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});
