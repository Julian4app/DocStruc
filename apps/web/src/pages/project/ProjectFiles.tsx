import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card, Button } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { ModernModal } from '../../components/ModernModal';
import { Select } from '../../components/Select';
import { 
  FolderOpen, Upload, File, FileText, Image, Video, Folder, Download, 
  MoreVertical, Edit2, Trash2, Share2, X, Plus, FolderPlus, Clock,
  User, ChevronRight, ChevronDown, Eye, EyeOff
} from 'lucide-react';

interface ProjectFolder {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ProjectFile {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  storage_path: string;
  file_size: number;
  mime_type: string;
  version: number;
  is_latest_version: boolean;
  uploaded_by: string;
  uploaded_at: string;
  uploader_name?: string;
}

interface FileVersion {
  id: string;
  file_id: string;
  version: number;
  storage_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  change_notes: string | null;
  uploader_name?: string;
}

interface FileShare {
  id: string;
  file_id: string | null;
  folder_id: string | null;
  shared_with_user_id: string | null;
  permission_level: string;
  can_download: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  shared_by: string;
  expires_at: string | null;
  created_at: string;
}

interface UnifiedDocument {
  id: string;
  name: string;
  type: 'task-attachment' | 'task-documentation' | 'project-file' | 'general-info';
  source: string;
  storage_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploader_name?: string;
  created_at: string;
  folder_id?: string | null;
  task_id?: string;
  task_title?: string;
  linked_folder_name?: string;
}

export function ProjectFiles() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  
  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFileRenameModalOpen, setIsFileRenameModalOpen] = useState(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUploadingToFolder, setIsUploadingToFolder] = useState<string | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<ProjectFolder | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'folders' | 'all-documents'>('folders');
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [selectedDocForLink, setSelectedDocForLink] = useState<any | null>(null);
  const [isLinkToFolderModalOpen, setIsLinkToFolderModalOpen] = useState(false);
  const [selectedFolderForLink, setSelectedFolderForLink] = useState<string | null>(null);
  
  // Form data
  const [folderFormData, setFolderFormData] = useState({ name: '', description: '', parent_folder_id: null as string | null });
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [fileShares, setFileShares] = useState<FileShare[]>([]);
  const [shareFormData, setShareFormData] = useState({
    user_id: '',
    permission_level: 'viewer',
    can_download: true,
    can_edit: false,
    can_delete: false,
    can_share: false
  });
  
  // Stats
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    folders: 0
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFolders(),
        loadFiles(),
        loadProjectMembers(),
        loadAllDocuments()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('project_folders')
      .select('*')
      .eq('project_id', id)
      .order('name');

    if (error) {
      console.error('Error loading folders:', error);
      showToast('Fehler beim Laden der Ordner', 'error');
      return;
    }

    setFolders(data || []);
    setStats(prev => ({ ...prev, folders: (data || []).length }));
  };

  const loadFiles = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('project_files')
      .select(`
        *,
        profiles!project_files_uploaded_by_fkey(email, first_name, last_name)
      `)
      .eq('project_id', id)
      .eq('is_latest_version', true)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error loading files:', error);
      showToast('Fehler beim Laden der Dateien', 'error');
      return;
    }

    const filesWithNames = (data || []).map((file: any) => ({
      ...file,
      uploader_name: file.profiles 
        ? `${file.profiles.first_name || ''} ${file.profiles.last_name || ''}`.trim() || file.profiles.email || 'Unbekannt'
        : 'Unbekannt'
    }));

    setFiles(filesWithNames);
    
    const totalSize = filesWithNames.reduce((sum: number, f: ProjectFile) => sum + f.file_size, 0);
    setStats(prev => ({ ...prev, totalFiles: filesWithNames.length, totalSize }));
  };

  const loadProjectMembers = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('project_members')
      .select('*, profiles(email, first_name, last_name)')
      .eq('project_id', id);

    setProjectMembers(data || []);
  };

  const loadAllDocuments = async () => {
    if (!id) return;

    try {
      const allDocs: UnifiedDocument[] = [];

      // 1. Load task documentation (images, videos, documents)
      const { data: taskDocs } = await supabase
        .from('task_documentation')
        .select('*, tasks(title), profiles(email, first_name, last_name)')
        .eq('project_id', id)
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: false });

      if (taskDocs) {
        taskDocs.forEach((doc: any) => {
          const profile = doc.profiles;
          const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Unbekannt';
          
          allDocs.push({
            id: doc.id,
            name: doc.file_name || `${doc.documentation_type}-${doc.id}`,
            type: 'task-documentation',
            source: `Aufgabe: ${doc.tasks?.title || 'Unbekannt'}`,
            storage_path: doc.storage_path,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            uploaded_by: doc.user_id,
            uploader_name: userName,
            created_at: doc.created_at,
            task_id: doc.task_id,
            task_title: doc.tasks?.title,
            folder_id: null
          });
        });
      }

      // 2. Load project files
      const { data: projectFiles } = await supabase
        .from('project_files')
        .select('*, profiles(email, first_name, last_name), project_folders(name)')
        .eq('project_id', id)
        .order('uploaded_at', { ascending: false });

      if (projectFiles) {
        projectFiles.forEach((file: any) => {
          const profile = file.profiles;
          const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Unbekannt';
          
          allDocs.push({
            id: file.id,
            name: file.name,
            type: 'project-file',
            source: file.folder_id ? `Ordner: ${file.project_folders?.name || 'Unbekannt'}` : 'Root',
            storage_path: file.storage_path,
            file_size: file.file_size,
            mime_type: file.mime_type,
            uploaded_by: file.uploaded_by,
            uploader_name: userName,
            created_at: file.uploaded_at,
            folder_id: file.folder_id,
            linked_folder_name: file.project_folders?.name
          });
        });
      }

      setAllDocuments(allDocs);
    } catch (error) {
      console.error('Error loading all documents:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!id || !folderFormData.name.trim()) {
      showToast('Bitte geben Sie einen Ordnernamen ein', 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('project_folders')
      .insert({
        project_id: id,
        parent_folder_id: folderFormData.parent_folder_id,
        name: folderFormData.name,
        description: folderFormData.description,
        created_by: user.id
      });

    if (error) {
      console.error('Error creating folder:', error);
      showToast('Fehler beim Erstellen des Ordners', 'error');
      return;
    }

    showToast('Ordner erfolgreich erstellt', 'success');
    setIsFolderModalOpen(false);
    setFolderFormData({ name: '', description: '', parent_folder_id: null });
    loadFolders();
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderFormData.name.trim()) return;

    const { error } = await supabase
      .from('project_folders')
      .update({
        name: folderFormData.name,
        description: folderFormData.description
      })
      .eq('id', editingFolder.id);

    if (error) {
      console.error('Error updating folder:', error);
      showToast('Fehler beim Aktualisieren des Ordners', 'error');
      return;
    }

    showToast('Ordner erfolgreich aktualisiert', 'success');
    setIsFolderModalOpen(false);
    setEditingFolder(null);
    setFolderFormData({ name: '', description: '', parent_folder_id: null });
    loadFolders();
  };

  const handleDeleteFolder = async (folder: ProjectFolder) => {
    setFolderToDelete(folder);
    setDeleteConfirmText('');
    setIsDeleteConfirmModalOpen(true);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;

    if (deleteConfirmText !== folderToDelete.name) {
      showToast('Der eingegebene Name stimmt nicht überein', 'error');
      return;
    }

    const { error } = await supabase
      .from('project_folders')
      .delete()
      .eq('id', folderToDelete.id);

    if (error) {
      console.error('Error deleting folder:', error);
      showToast('Fehler beim Löschen des Ordners', 'error');
      return;
    }

    showToast('Ordner erfolgreich gelöscht', 'success');
    setIsDeleteConfirmModalOpen(false);
    setFolderToDelete(null);
    setDeleteConfirmText('');
    loadFolders();
    loadFiles();
    loadAllDocuments();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('Sie müssen angemeldet sein', 'error');
      return;
    }

    try {
      // First, verify the user is a project member
      const { data: memberCheck } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .single();

      const { data: ownerCheck } = await supabase
        .from('projects')
        .select('id')
        .eq('id', id)
        .eq('owner_id', user.id)
        .single();

      if (!memberCheck && !ownerCheck) {
        showToast('Sie haben keine Berechtigung für dieses Projekt', 'error');
        return;
      }

      // Create file record FIRST (before storage upload)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const folderPath = isUploadingToFolder || 'root';
      const filePath = `${id}/${folderPath}/${fileName}`;
      const mimeType = file.type || 'application/octet-stream';

      console.log('Creating file record:', {
        project_id: id,
        folder_id: isUploadingToFolder,
        name: file.name,
        storage_path: filePath,
        user_id: user.id
      });

      // Insert database record first
      const { data: fileRecord, error: insertError } = await supabase
        .from('project_files')
        .insert({
          project_id: id,
          folder_id: isUploadingToFolder,
          name: file.name,
          storage_path: filePath,
          file_size: file.size,
          mime_type: mimeType,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Datenbankfehler: ${insertError.message}`);
      }

      console.log('Database record created, now uploading to storage:', filePath);

      // Now upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Clean up database record if upload fails
        await supabase.from('project_files').delete().eq('id', fileRecord.id);
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);

      showToast('Datei erfolgreich hochgeladen', 'success');
      setIsUploadingToFolder(null);
      loadFiles();
      loadAllDocuments();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      showToast(error.message || 'Fehler beim Hochladen der Datei', 'error');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Datei wird heruntergeladen', 'success');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      showToast('Fehler beim Herunterladen der Datei', 'error');
    }
  };

  const handleFileRename = async () => {
    if (!renamingFile || !newFileName.trim()) return;

    const { error } = await supabase
      .from('project_files')
      .update({ name: newFileName })
      .eq('id', renamingFile.id);

    if (error) {
      console.error('Error renaming file:', error);
      showToast('Fehler beim Umbenennen der Datei', 'error');
      return;
    }

    showToast('Datei erfolgreich umbenannt', 'success');
    setIsFileRenameModalOpen(false);
    setRenamingFile(null);
    setNewFileName('');
    loadFiles();
  };

  const handleFileDelete = async (file: ProjectFile) => {
    if (!confirm('Möchten Sie diese Datei wirklich löschen?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      if (deleteError) throw deleteError;

      showToast('Datei erfolgreich gelöscht', 'success');
      loadFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      showToast('Fehler beim Löschen der Datei', 'error');
    }
  };

  const handleUploadNewVersion = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedFile || !id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Upload new version to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_v${selectedFile.version + 1}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${id}/${selectedFile.folder_id || 'root'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create version record
      const { error: versionError } = await supabase
        .from('project_file_versions')
        .insert({
          file_id: selectedFile.id,
          version: selectedFile.version,
          storage_path: selectedFile.storage_path,
          file_size: selectedFile.file_size,
          uploaded_by: selectedFile.uploaded_by,
          uploaded_at: selectedFile.uploaded_at
        });

      if (versionError) throw versionError;

      // Update file with new version
      const { error: updateError } = await supabase
        .from('project_files')
        .update({
          storage_path: filePath,
          file_size: file.size,
          version: selectedFile.version + 1,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', selectedFile.id);

      if (updateError) throw updateError;

      showToast('Neue Version erfolgreich hochgeladen', 'success');
      loadFiles();
      loadFileVersions(selectedFile.id);
    } catch (error: any) {
      console.error('Error uploading new version:', error);
      showToast('Fehler beim Hochladen der neuen Version', 'error');
    }
  };

  const loadFileVersions = async (fileId: string) => {
    const { data, error } = await supabase
      .from('project_file_versions')
      .select(`
        *,
        profiles!project_file_versions_uploaded_by_fkey(email, first_name, last_name)
      `)
      .eq('file_id', fileId)
      .order('version', { ascending: false });

    if (error) {
      console.error('Error loading versions:', error);
      return;
    }

    const versionsWithNames = (data || []).map((v: any) => ({
      ...v,
      uploader_name: v.profiles 
        ? `${v.profiles.first_name || ''} ${v.profiles.last_name || ''}`.trim() || v.profiles.email || 'Unbekannt'
        : 'Unbekannt'
    }));

    setFileVersions(versionsWithNames);
  };

  const handleShareFile = async () => {
    if (!selectedFile || !shareFormData.user_id) {
      showToast('Bitte wählen Sie einen Benutzer aus', 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('project_file_shares')
      .insert({
        file_id: selectedFile.id,
        shared_with_user_id: shareFormData.user_id,
        permission_level: shareFormData.permission_level,
        can_download: shareFormData.can_download,
        can_edit: shareFormData.can_edit,
        can_delete: shareFormData.can_delete,
        can_share: shareFormData.can_share,
        shared_by: user.id
      });

    if (error) {
      console.error('Error sharing file:', error);
      showToast('Fehler beim Teilen der Datei', 'error');
      return;
    }

    showToast('Datei erfolgreich geteilt', 'success');
    loadFileShares(selectedFile.id);
    setShareFormData({
      user_id: '',
      permission_level: 'viewer',
      can_download: true,
      can_edit: false,
      can_delete: false,
      can_share: false
    });
  };

  const loadFileShares = async (fileId: string) => {
    const { data, error } = await supabase
      .from('project_file_shares')
      .select('*')
      .eq('file_id', fileId);

    if (error) {
      console.error('Error loading shares:', error);
      return;
    }

    setFileShares(data || []);
  };

  const handleRemoveShare = async (shareId: string) => {
    const { error } = await supabase
      .from('project_file_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error('Error removing share:', error);
      showToast('Fehler beim Entfernen der Freigabe', 'error');
      return;
    }

    showToast('Freigabe erfolgreich entfernt', 'success');
    if (selectedFile) {
      loadFileShares(selectedFile.id);
    }
  };

  const handleLinkDocumentToFolder = async () => {
    if (!selectedDocForLink || !selectedFolderForLink) return;

    try {
      // Only project-files can be linked to folders in the current schema
      if (selectedDocForLink.type === 'project-file') {
        const { error } = await supabase
          .from('project_files')
          .update({ folder_id: selectedFolderForLink })
          .eq('id', selectedDocForLink.id);

        if (error) throw error;

        showToast('Dokument erfolgreich verknüpft', 'success');
      } else {
        // For task documentation, we create a reference in project_files
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('project_files')
          .insert({
            project_id: id!,
            folder_id: selectedFolderForLink,
            name: selectedDocForLink.name,
            storage_path: selectedDocForLink.storage_path,
            file_size: selectedDocForLink.file_size || 0,
            mime_type: selectedDocForLink.mime_type || 'application/octet-stream',
            uploaded_by: user.id,
            description: `Verknüpft von: ${selectedDocForLink.source}`
          });

        if (error) throw error;

        showToast('Dokument als Kopie im Ordner verknüpft', 'success');
      }

      setIsLinkToFolderModalOpen(false);
      setSelectedDocForLink(null);
      setSelectedFolderForLink(null);
      loadFiles();
      loadAllDocuments();
    } catch (error: any) {
      console.error('Error linking document:', error);
      showToast('Fehler beim Verknüpfen', 'error');
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image size={20} color="#10B981" />;
    }
    if (mimeType.startsWith('video/')) {
      return <Video size={20} color="#8B5CF6" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText size={20} color="#DC2626" />;
    }
    return <File size={20} color="#64748b" />;
  };

  const getFilesForFolder = (folderId: string | null) => {
    return files.filter(f => f.folder_id === folderId);
  };

  const renderFolder = (folder: ProjectFolder, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderFiles = getFilesForFolder(folder.id);
    const childFolders = folders.filter(f => f.parent_folder_id === folder.id);

    return (
      <View key={folder.id} style={{ marginLeft: level * 20 }}>
        <Card style={styles.folderCard}>
          <View style={styles.folderHeader}>
            <TouchableOpacity
              style={styles.folderTitleRow}
              onPress={() => toggleFolder(folder.id)}
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <Folder size={24} color="#F59E0B" />
              <Text style={styles.folderName}>{folder.name}</Text>
              <View style={styles.folderBadge}>
                <Text style={styles.folderBadgeText}>
                  {folderFiles.length} {folderFiles.length === 1 ? 'Datei' : 'Dateien'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.folderActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setIsUploadingToFolder(folder.id);
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={16} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setEditingFolder(folder);
                  setFolderFormData({
                    name: folder.name,
                    description: folder.description || '',
                    parent_folder_id: folder.parent_folder_id
                  });
                  setIsFolderModalOpen(true);
                }}
              >
                <Edit2 size={16} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDeleteFolder(folder)}
              >
                <Trash2 size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>

          {isExpanded && (
            <View style={styles.folderContent}>
              {folderFiles.map(file => renderFile(file))}
              {folderFiles.length === 0 && childFolders.length === 0 && (
                <Text style={styles.emptyText}>Keine Dateien in diesem Ordner</Text>
              )}
            </View>
          )}
        </Card>

        {isExpanded && childFolders.map(childFolder => renderFolder(childFolder, level + 1))}
      </View>
    );
  };

  const renderFile = (file: ProjectFile) => {
    return (
      <View key={file.id} style={styles.fileCard}>
        <View style={styles.fileIconContainer}>
          {getFileIcon(file.mime_type)}
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{file.name}</Text>
          <View style={styles.fileMeta}>
            <Text style={styles.fileMetaText}>{formatFileSize(file.file_size)}</Text>
            <Text style={styles.fileMetaSep}>•</Text>
            <Text style={styles.fileMetaText}>v{file.version}</Text>
            <Text style={styles.fileMetaSep}>•</Text>
            <Text style={styles.fileMetaText}>{formatDate(file.uploaded_at)}</Text>
            <Text style={styles.fileMetaSep}>•</Text>
            <Text style={styles.fileMetaText}>{file.uploader_name}</Text>
          </View>
        </View>
        <View style={styles.fileActionsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleFileDownload(file)}
          >
            <Download size={16} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setSelectedFile(file);
              loadFileVersions(file.id);
              setIsVersionsModalOpen(true);
            }}
          >
            <Clock size={16} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setSelectedFile(file);
              loadFileShares(file.id);
              setIsShareModalOpen(true);
            }}
          >
            <Share2 size={16} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setRenamingFile(file);
              setNewFileName(file.name);
              setIsFileRenameModalOpen(true);
            }}
          >
            <Edit2 size={16} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleFileDelete(file)}
          >
            <Trash2 size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rootFolders = folders.filter(f => !f.parent_folder_id);
  const rootFiles = getFilesForFolder(null);

  return (
    <View style={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Dokumente</Text>
          <Text style={styles.pageSubtitle}>
            Dateiverwaltung mit Ordnerstruktur, Versionierung und Freigaben
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            variant="outline"
            onClick={() => {
              setEditingFolder(null);
              setFolderFormData({ name: '', description: '', parent_folder_id: null });
              setIsFolderModalOpen(true);
            }}
          >
            <FolderPlus size={18} /> Neuer Ordner
          </Button>
          <Button
            onClick={() => {
              setIsUploadingToFolder(null);
              fileInputRef.current?.click();
            }}
          >
            <Upload size={18} /> Datei hochladen
          </Button>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'folders' && styles.tabActive]}
          onPress={() => setActiveTab('folders')}
        >
          <FolderOpen size={18} color={activeTab === 'folders' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'folders' && styles.tabTextActive]}>
            Ordner-Ansicht
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all-documents' && styles.tabActive]}
          onPress={() => setActiveTab('all-documents')}
        >
          <File size={18} color={activeTab === 'all-documents' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'all-documents' && styles.tabTextActive]}>
            Alle Dokumente ({allDocuments.length})
          </Text>
        </TouchableOpacity>
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
        {/* FOLDERS TAB */}
        {activeTab === 'folders' && (
          <View>
            {/* Root files */}
            {rootFiles.length > 0 && (
              <Card style={styles.folderCard}>
            <View style={styles.folderHeader}>
              <View style={styles.folderTitleRow}>
                <Folder size={24} color="#94a3b8" />
                <Text style={styles.folderName}>Root</Text>
                <View style={styles.folderBadge}>
                  <Text style={styles.folderBadgeText}>
                    {rootFiles.length} {rootFiles.length === 1 ? 'Datei' : 'Dateien'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.folderContent}>
              {rootFiles.map(file => renderFile(file))}
            </View>
          </Card>
        )}

        {/* Folders */}
        {rootFolders.map(folder => renderFolder(folder))}

        {folders.length === 0 && files.length === 0 && (
          <Card style={styles.emptyCard}>
            <FolderOpen size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Keine Dateien vorhanden</Text>
            <Text style={styles.emptyText}>
              Erstellen Sie einen Ordner oder laden Sie eine Datei hoch
            </Text>
          </Card>
        )}
          </View>
        )}

        {/* ALL DOCUMENTS TAB */}
        {activeTab === 'all-documents' && (
          <View style={{ gap: 12 }}>
            {allDocuments.length === 0 ? (
              <Card style={{ padding: 40, alignItems: 'center' }}>
                <File size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center' }}>
                  Keine Dokumente vorhanden
                </Text>
              </Card>
            ) : (
              allDocuments.map((doc) => (
                <Card key={`${doc.type}-${doc.id}`} style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentIcon}>
                      {doc.mime_type?.startsWith('image/') ? (
                        <Image size={20} color="#3B82F6" />
                      ) : doc.mime_type?.startsWith('video/') ? (
                        <Video size={20} color="#8B5CF6" />
                      ) : (
                        <FileText size={20} color="#64748b" />
                      )}
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentName}>{doc.name}</Text>
                      <View style={styles.documentMeta}>
                        <Text style={styles.documentMetaText}>{doc.source}</Text>
                        <Text style={styles.documentMetaText}>•</Text>
                        <Text style={styles.documentMetaText}>
                          {new Date(doc.created_at).toLocaleDateString('de-DE')}
                        </Text>
                        {doc.uploader_name && (
                          <>
                            <Text style={styles.documentMetaText}>•</Text>
                            <Text style={styles.documentMetaText}>{doc.uploader_name}</Text>
                          </>
                        )}
                        {doc.file_size && (
                          <>
                            <Text style={styles.documentMetaText}>•</Text>
                            <Text style={styles.documentMetaText}>{formatFileSize(doc.file_size)}</Text>
                          </>
                        )}
                      </View>
                      {doc.linked_folder_name && (
                        <View style={styles.linkedFolderBadge}>
                          <Folder size={12} color="#3B82F6" />
                          <Text style={styles.linkedFolderText}>{doc.linked_folder_name}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.documentActions}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedDocForLink(doc);
                        setIsLinkToFolderModalOpen(true);
                      }}
                    >
                      <Folder size={14} /> Zu Ordner hinzufügen
                    </Button>
                    {doc.type === 'project-file' && (
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          const file = files.find(f => f.id === doc.id);
                          if (file) handleFileDownload(file);
                        }}
                      >
                        <Download size={16} color="#3B82F6" />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Folder Modal */}
      <ModernModal
        visible={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setEditingFolder(null);
          setFolderFormData({ name: '', description: '', parent_folder_id: null });
        }}
        title={editingFolder ? 'Ordner bearbeiten' : 'Neuer Ordner'}
      >
        <View style={styles.modalBody}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Ordnername *</Text>
            <TextInput
              style={styles.textInput}
              value={folderFormData.name}
              onChangeText={(text) => setFolderFormData({ ...folderFormData, name: text })}
              placeholder="z.B. Pläne & Zeichnungen"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Beschreibung</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={folderFormData.description}
              onChangeText={(text) => setFolderFormData({ ...folderFormData, description: text })}
              placeholder="Optionale Beschreibung"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsFolderModalOpen(false);
                setEditingFolder(null);
                setFolderFormData({ name: '', description: '', parent_folder_id: null });
              }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
              style={{ flex: 1 }}
              disabled={!folderFormData.name.trim()}
            >
              {editingFolder ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* File Rename Modal */}
      <ModernModal
        visible={isFileRenameModalOpen}
        onClose={() => {
          setIsFileRenameModalOpen(false);
          setRenamingFile(null);
          setNewFileName('');
        }}
        title="Datei umbenennen"
      >
        <View style={styles.modalBody}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Neuer Name</Text>
            <TextInput
              style={styles.textInput}
              value={newFileName}
              onChangeText={setNewFileName}
              placeholder="Dateiname"
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsFileRenameModalOpen(false);
                setRenamingFile(null);
                setNewFileName('');
              }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleFileRename}
              style={{ flex: 1 }}
              disabled={!newFileName.trim()}
            >
              Umbenennen
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Versions Modal */}
      <ModernModal
        visible={isVersionsModalOpen}
        onClose={() => {
          setIsVersionsModalOpen(false);
          setSelectedFile(null);
          setFileVersions([]);
        }}
        title={`Versionen: ${selectedFile?.name}`}
      >
        <View style={styles.modalBody}>
          <View style={styles.versionActions}>
            <input
              type="file"
              style={{ display: 'none' }}
              id="version-upload"
              onChange={handleUploadNewVersion}
            />
            <Button
              onClick={() => document.getElementById('version-upload')?.click()}
            >
              <Upload size={16} /> Neue Version hochladen
            </Button>
          </View>

          <View style={styles.versionsList}>
            {/* Current version */}
            {selectedFile && (
              <View style={styles.versionCard}>
                <View style={styles.versionHeader}>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>v{selectedFile.version}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#16A34A' }]}>Aktuell</Text>
                  </View>
                </View>
                <View style={styles.versionMeta}>
                  <Text style={styles.versionMetaText}>
                    {formatFileSize(selectedFile.file_size)}
                  </Text>
                  <Text style={styles.fileMetaSep}>•</Text>
                  <Text style={styles.versionMetaText}>
                    {formatDate(selectedFile.uploaded_at)}
                  </Text>
                  <Text style={styles.fileMetaSep}>•</Text>
                  <Text style={styles.versionMetaText}>
                    {selectedFile.uploader_name}
                  </Text>
                </View>
              </View>
            )}

            {/* Previous versions */}
            {fileVersions.map((version) => (
              <View key={version.id} style={styles.versionCard}>
                <View style={styles.versionHeader}>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>v{version.version}</Text>
                  </View>
                </View>
                <View style={styles.versionMeta}>
                  <Text style={styles.versionMetaText}>
                    {formatFileSize(version.file_size)}
                  </Text>
                  <Text style={styles.fileMetaSep}>•</Text>
                  <Text style={styles.versionMetaText}>
                    {formatDate(version.uploaded_at)}
                  </Text>
                  <Text style={styles.fileMetaSep}>•</Text>
                  <Text style={styles.versionMetaText}>
                    {version.uploader_name}
                  </Text>
                </View>
                {version.change_notes && (
                  <Text style={styles.versionNotes}>{version.change_notes}</Text>
                )}
              </View>
            ))}

            {fileVersions.length === 0 && (
              <Text style={styles.emptyText}>Keine älteren Versionen vorhanden</Text>
            )}
          </View>
        </View>
      </ModernModal>

      {/* Share Modal */}
      <ModernModal
        visible={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setSelectedFile(null);
          setFileShares([]);
          setShareFormData({
            user_id: '',
            permission_level: 'viewer',
            can_download: true,
            can_edit: false,
            can_delete: false,
            can_share: false
          });
        }}
        title={`Teilen: ${selectedFile?.name}`}
      >
        <View style={styles.modalBody}>
          <Select
            label="Benutzer"
            value={shareFormData.user_id}
            options={[
              { label: 'Benutzer auswählen', value: '' },
              ...projectMembers.map((member) => ({
                label: member.profiles
                  ? `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email
                  : 'Unbekannt',
                value: member.user_id
              }))
            ]}
            onChange={(value) => setShareFormData({ ...shareFormData, user_id: value as string })}
            placeholder="Benutzer auswählen"
          />

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Berechtigungen</Text>
            <View style={styles.permissionsGrid}>
              <TouchableOpacity
                style={[styles.permissionToggle, shareFormData.can_download && styles.permissionToggleActive]}
                onPress={() => setShareFormData({ ...shareFormData, can_download: !shareFormData.can_download })}
              >
                <Download size={14} color={shareFormData.can_download ? '#fff' : '#64748b'} />
                <Text style={[styles.permissionToggleText, shareFormData.can_download && styles.permissionToggleTextActive]}>
                  Herunterladen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionToggle, shareFormData.can_edit && styles.permissionToggleActive]}
                onPress={() => setShareFormData({ ...shareFormData, can_edit: !shareFormData.can_edit })}
              >
                <Edit2 size={14} color={shareFormData.can_edit ? '#fff' : '#64748b'} />
                <Text style={[styles.permissionToggleText, shareFormData.can_edit && styles.permissionToggleTextActive]}>
                  Bearbeiten
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionToggle, shareFormData.can_delete && styles.permissionToggleActive]}
                onPress={() => setShareFormData({ ...shareFormData, can_delete: !shareFormData.can_delete })}
              >
                <Trash2 size={14} color={shareFormData.can_delete ? '#fff' : '#64748b'} />
                <Text style={[styles.permissionToggleText, shareFormData.can_delete && styles.permissionToggleTextActive]}>
                  Löschen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionToggle, shareFormData.can_share && styles.permissionToggleActive]}
                onPress={() => setShareFormData({ ...shareFormData, can_share: !shareFormData.can_share })}
              >
                <Share2 size={14} color={shareFormData.can_share ? '#fff' : '#64748b'} />
                <Text style={[styles.permissionToggleText, shareFormData.can_share && styles.permissionToggleTextActive]}>
                  Teilen
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button onClick={handleShareFile} disabled={!shareFormData.user_id}>
            <Share2 size={16} /> Freigeben
          </Button>

          {/* Active shares */}
          {fileShares.length > 0 && (
            <View style={styles.sharesList}>
              <Text style={styles.sharesTitle}>Aktive Freigaben</Text>
              {fileShares.map((share) => {
                const member = projectMembers.find(m => m.user_id === share.shared_with_user_id);
                return (
                  <View key={share.id} style={styles.shareCard}>
                    <View style={styles.shareInfo}>
                      <User size={16} color="#64748b" />
                      <Text style={styles.shareName}>
                        {member?.profiles
                          ? `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || member.profiles.email || 'Unbekannt'
                          : 'Unbekannt'}
                      </Text>
                      <View style={styles.sharePermissions}>
                        {share.can_download && <Download size={12} color="#10B981" />}
                        {share.can_edit && <Edit2 size={12} color="#3B82F6" />}
                        {share.can_delete && <Trash2 size={12} color="#DC2626" />}
                        {share.can_share && <Share2 size={12} color="#8B5CF6" />}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleRemoveShare(share.id)}
                    >
                      <X size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ModernModal>

      {/* Delete Confirmation Modal */}
      <ModernModal
        visible={isDeleteConfirmModalOpen}
        onClose={() => {
          setIsDeleteConfirmModalOpen(false);
          setFolderToDelete(null);
          setDeleteConfirmText('');
        }}
        title="Ordner löschen"
      >
        <View style={styles.modalBody}>
          <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ color: '#DC2626', fontWeight: '600', marginBottom: 8 }}>
              ⚠️ Warnung: Diese Aktion kann nicht rückgängig gemacht werden
            </Text>
            <Text style={{ color: '#991B1B', fontSize: 14 }}>
              Alle Dateien in diesem Ordner werden ebenfalls gelöscht.
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              Bitte geben Sie den Ordnernamen ein um zu bestätigen:
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>
              {folderToDelete?.name}
            </Text>
            <TextInput
              style={styles.textInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Ordnername eingeben"
              autoFocus
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteConfirmModalOpen(false);
                setFolderToDelete(null);
                setDeleteConfirmText('');
              }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={confirmDeleteFolder}
              disabled={deleteConfirmText !== folderToDelete?.name}
              style={{
                flex: 1,
                backgroundColor: deleteConfirmText === folderToDelete?.name ? '#DC2626' : '#cbd5e1'
              }}
            >
              <Trash2 size={16} /> Endgültig löschen
            </Button>
          </View>
        </View>
      </ModernModal>

      {/* Link to Folder Modal */}
      <ModernModal
        visible={isLinkToFolderModalOpen}
        onClose={() => {
          setIsLinkToFolderModalOpen(false);
          setSelectedDocForLink(null);
          setSelectedFolderForLink(null);
        }}
        title="Zu Ordner hinzufügen"
      >
        <View style={styles.modalBody}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Dokument</Text>
            <View style={{ 
              padding: 12, 
              backgroundColor: '#F8FAFC', 
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0'
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 }}>
                {selectedDocForLink?.name}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>
                {selectedDocForLink?.source}
              </Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Zielordner auswählen</Text>
            <select
              value={selectedFolderForLink || ''}
              onChange={(e) => setSelectedFolderForLink(e.target.value)}
              style={{
                padding: 12,
                fontSize: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="">-- Ordner auswählen --</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </View>

          <View style={{ backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#1e40af' }}>
              💡 Das Dokument wird mit dem ausgewählten Ordner verknüpft und dort angezeigt.
            </Text>
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsLinkToFolderModalOpen(false);
                setSelectedDocForLink(null);
                setSelectedFolderForLink(null);
              }}
              style={{ flex: 1 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleLinkDocumentToFolder}
              disabled={!selectedFolderForLink}
              style={{ flex: 1 }}
            >
              <Folder size={16} /> Verknüpfen
            </Button>
          </View>
        </View>
      </ModernModal>
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folderTitleRow: {
    flex: 1,
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
  folderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  folderContent: {
    padding: 20,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
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
  fileActionsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyCard: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  textInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  versionActions: {
    marginBottom: 16,
  },
  versionsList: {
    gap: 12,
  },
  versionCard: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 8,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  versionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  versionMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  versionNotes: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    transition: 'all 0.2s',
  },
  permissionToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  permissionToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  permissionToggleTextActive: {
    color: '#ffffff',
  },
  sharesList: {
    marginTop: 16,
    gap: 12,
  },
  sharesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  shareCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  shareInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  sharePermissions: {
    flexDirection: 'row',
    gap: 6,
  },
  documentCard: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  documentHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    gap: 6,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  documentMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  linkedFolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  linkedFolderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -2,
    cursor: 'pointer',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: colors.primary,
  },
});
