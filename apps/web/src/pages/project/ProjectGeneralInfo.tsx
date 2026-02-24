import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput as RNTextInput, Image } from 'react-native';
import { LottieLoader } from '../../components/LottieLoader';

import { Card, Button, Input } from '@docstruc/ui';
import { colors, spacing } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { ModernModal } from '../../components/ModernModal';
import { RichTextEditor } from '../../components/RichTextEditor';
import { MapDisplay } from '../../components/MapDisplay';
import { VoiceRecorder, VoicePlayer } from '../../components/VoicePlayer';
import { useToast } from '../../components/ToastProvider';
import { Info, MapPin, Image as ImageIcon, Mic, Save, ExternalLink, Plus, Trash2, Edit2, Upload, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import DOMPurify from 'dompurify';

interface VoiceMessage {
  id: string;
  project_info_id: string;
  storage_path: string;
  file_name: string;
  transcription: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface ProjectInfo {
  id: string;
  project_id: string;
  detailed_description: string | null;
  voice_message_url: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectInfoImage {
  id: string;
  storage_path: string;
  file_name: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
}

export function ProjectGeneralInfo() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const permissions = useProjectPermissionContext();
  // Use project from outlet context — already loaded by ProjectDetail, no extra query needed
  const ctxProject = (permissions as any).project;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(ctxProject || null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [images, setImages] = useState<ProjectInfoImage[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTranscription, setEditingTranscription] = useState<string | null>(null);
  const [transcriptionEditText, setTranscriptionEditText] = useState('');

  // Form state
  const [detailedDescription, setDetailedDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');

  // Image editing states
  const [imageEditModal, setImageEditModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProjectInfoImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Carousel + lightbox states
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const canEdit = permissions.canEdit('general_info') || permissions.isProjectOwner;
  const canDelete = permissions.canDelete('general_info') || permissions.isProjectOwner;
  const canView = permissions.canView('general_info') || permissions.isProjectOwner;

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [id, canView]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Use project from context if available, otherwise fetch (fallback)
      let projectData = ctxProject;
      if (!projectData) {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        projectData = data;
      }
      setProject(projectData);

      // Load or create project_info
      let { data: infoData, error: infoError } = await supabase
        .from('project_info')
        .select('*')
        .eq('project_id', id)
        .single();

      if (infoError && infoError.code !== 'PGRST116') {
        throw infoError;
      }

      // Create empty project_info if not exists
      if (!infoData) {
        const { data: newInfo, error: createError } = await supabase
          .from('project_info')
          .insert({ project_id: id })
          .select()
          .single();

        if (createError) throw createError;
        infoData = newInfo;
      }

      setProjectInfo(infoData);
      setDetailedDescription(infoData.detailed_description || '');
      setNotes(infoData.notes || '');
      setFormattedAddress(infoData.formatted_address || projectData.address || '');

      // Load images
      if (infoData.id) {
        const { data: imagesData, error: imagesError } = await supabase
          .from('project_info_images')
          .select('*')
          .eq('project_info_id', infoData.id)
          .order('display_order');

        if (imagesError) throw imagesError;
        setImages(imagesData || []);

        // Load voice messages
        const { data: voiceData, error: voiceError } = await supabase
          .from('project_voice_messages')
          .select('*')
          .eq('project_info_id', infoData.id)
          .order('created_at', { ascending: false });

        if (voiceError) throw voiceError;
        setVoiceMessages(voiceData || []);
      }

    } catch (error: any) {
      console.error('Error loading project info:', error);
      showToast('Fehler beim Laden der Projektinformationen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectInfo) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_info')
        .update({
          detailed_description: detailedDescription.trim() || null,
          notes: notes.trim() || null,
          formatted_address: formattedAddress.trim() || null,
        })
        .eq('id', projectInfo.id);

      if (error) throw error;

      showToast('Projektinformationen gespeichert', 'success');
      setIsEditMode(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving project info:', error);
      showToast('Fehler beim Speichern: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (imageId: string, storagePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-info-images')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_info_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      showToast('Bild gelöscht', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error deleting image:', error);
      showToast('Fehler beim Löschen: ' + error.message, 'error');
    }
  };

  const handleUpdateCaption = async (imageId: string, caption: string) => {
    try {
      const { error } = await supabase
        .from('project_info_images')
        .update({ caption })
        .eq('id', imageId);

      if (error) throw error;

      showToast('Bildunterschrift aktualisiert', 'success');
      setImageEditModal(false);
      setSelectedImage(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating caption:', error);
      showToast('Fehler beim Aktualisieren: ' + error.message, 'error');
    }
  };

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('project-info-images')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!projectInfo) return;

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    for (const file of files) {
      await uploadImage(file);
    }
  };

  /**
   * Resize an image to at most MAX_DIMENSION on the longest side, and compress
   * it to JPEG at 85 % quality. Falls back to the original file on any error.
   */
  const resizeImage = (file: File): Promise<File> =>
    new Promise((resolve) => {
      const MAX_DIMENSION = 2048;
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const { width, height } = img;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const baseName = file.name.replace(/\.[^.]+$/, '');
              resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });

  const uploadImage = async (file: File) => {
    if (!projectInfo) return;

    setUploadingImage(true);
    try {
      // Resize/compress before uploading so large camera photos don't fail
      const resized = await resizeImage(file);
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-info-images')
        .upload(filePath, resized);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('project_info_images')
        .insert({
          project_info_id: projectInfo.id,
          storage_path: filePath,
          file_name: resized.name,
          file_size: resized.size,
          mime_type: resized.type,
          display_order: images.length,
        });

      if (dbError) throw dbError;

      showToast('Bild erfolgreich hochgeladen', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast('Fehler beim Hochladen: ' + error.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    for (const file of files) {
      await uploadImage(file);
    }
  };

  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !projectInfo) return;
    const file = event.target.files[0];
    if (!file) return;

    setUploadingVoice(true);
    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      setAudioBlob(blob);
      showToast('Audio-Datei geladen - Bitte speichern', 'success');
    } catch (error: any) {
      console.error('Error loading audio file:', error);
      showToast('Fehler beim Laden: ' + error.message, 'error');
    } finally {
      setUploadingVoice(false);
    }
  };

  const openGoogleMaps = () => {
    if (project?.latitude && project?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${project.latitude},${project.longitude}`;
      window.open(url, '_blank');
    } else if (project?.address) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(project.address)}`;
      window.open(url, '_blank');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      
      // Try different mime types based on browser support
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Last resort: let browser pick default
        mimeType = '';
      }
      
      console.log('Using mime type:', mimeType || '(browser default)');
      
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }
      
      const recorder = new MediaRecorder(stream, recorderOptions);
      
      // Store the actual mime type the recorder is using
      const actualMimeType = recorder.mimeType;
      console.log('Actual recorder mimeType:', actualMimeType);
      
      // Reset chunks
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        console.log('Data available:', e.data.size, 'bytes, type:', e.data.type);
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped. Total chunks:', audioChunksRef.current.length);
        const totalSize = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
        console.log('Total recorded size:', totalSize, 'bytes');
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0 || totalSize === 0) {
          showToast('Aufnahme fehlgeschlagen - keine Daten aufgenommen', 'error');
          return;
        }
        
        // Use the recorder's actual mimeType for the blob
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        console.log('Created blob:', blob.size, 'bytes, type:', blob.type);
        
        // Verify the blob is playable before setting it
        try {
          const testUrl = URL.createObjectURL(blob);
          const testAudio = new Audio(testUrl);
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              // If metadata doesn't load in 3 seconds, still accept the blob
              // (some formats are slow to parse metadata)
              resolve();
            }, 3000);
            
            testAudio.onloadedmetadata = () => {
              clearTimeout(timeout);
              console.log('Audio verification: duration =', testAudio.duration, 'seconds');
              resolve();
            };
            testAudio.onerror = () => {
              clearTimeout(timeout);
              console.error('Audio verification failed');
              reject(new Error('Audio blob is not playable'));
            };
            testAudio.load();
          });
          
          URL.revokeObjectURL(testUrl);
        } catch (verifyError) {
          console.error('Audio verification error:', verifyError);
          showToast('Aufnahme-Format nicht unterstützt. Bitte versuchen Sie es erneut.', 'error');
          return;
        }
        
        setAudioBlob(blob);
        
        // Auto-transcribe
        await transcribeAudio(blob);
      };

      // DO NOT use timeslice (e.g. start(100)) - this causes broken audio
      // in many browsers because individual chunks lack proper codec headers.
      // Using start() without arguments collects all data into a single chunk.
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      showToast('Aufnahme gestartet', 'info');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        showToast('Mikrofon-Zugriff verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.', 'error');
      } else if (error.name === 'NotFoundError') {
        showToast('Kein Mikrofon gefunden. Bitte schließen Sie ein Mikrofon an.', 'error');
      } else {
        showToast('Fehler beim Starten der Aufnahme: ' + error.message, 'error');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      if (mediaRecorder.state === 'recording') {
        // Calling stop() triggers one final 'dataavailable' event, then 'onstop'
        mediaRecorder.stop();
      }
      setIsRecording(false);
      showToast('Aufnahme wird verarbeitet...', 'info');
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      // Using Web Speech API for transcription (client-side)
      const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognitionAPI) {
        throw new Error('Browser unterstützt keine Spracherkennung');
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'de-DE';
      recognition.continuous = false;
      recognition.interimResults = false;

      // Convert blob to audio for recognition
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTranscriptionText(transcript);
        showToast('Transkription abgeschlossen', 'success');
      };

      recognition.onerror = () => {
        showToast('Transkription nicht verfügbar - Bitte manuell eingeben', 'error');
        setTranscriptionText('[Transkription fehlgeschlagen]');
      };

      // Note: Web Speech API doesn't work with pre-recorded audio well
      // For production, use backend service like OpenAI Whisper or Google Speech-to-Text
      showToast('Transkription wird verarbeitet...', 'info');
      
      // Fallback: Allow manual transcription
      setTranscriptionText('[Transkription wird serverseitig verarbeitet - Bitte warten oder manuell eingeben]');
      
    } catch (error: any) {
      console.error('Transcription error:', error);
      showToast('Transkription fehlgeschlagen. Bitte manuell transkribieren.', 'error');
      setTranscriptionText('');
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveVoiceMessage = async () => {
    if (!audioBlob || !projectInfo) return;

    console.log('Saving audio blob:', audioBlob.size, 'bytes', audioBlob.type);

    if (audioBlob.size === 0) {
      showToast('Fehler: Aufnahme ist leer', 'error');
      return;
    }

    setUploadingVoice(true);
    try {
      // Determine file extension from the blob's actual MIME type
      const blobType = audioBlob.type || '';
      let extension = 'webm';
      let contentType = blobType || 'audio/webm';
      
      if (blobType.includes('mp4') || blobType.includes('m4a')) {
        extension = 'm4a';
        contentType = 'audio/mp4';
      } else if (blobType.includes('ogg')) {
        extension = 'ogg';
        contentType = 'audio/ogg';
      } else if (blobType.includes('mpeg') || blobType.includes('mp3')) {
        extension = 'mp3';
        contentType = 'audio/mpeg';
      } else if (blobType.includes('wav')) {
        extension = 'wav';
        contentType = 'audio/wav';
      } else if (blobType.includes('webm')) {
        extension = 'webm';
        contentType = 'audio/webm';
      }
      
      console.log('Saving audio - Blob size:', audioBlob.size, 'Type:', blobType, 'Extension:', extension, 'Content-Type:', contentType);
      
      // Get audio duration
      let durationSeconds: number | null = null;
      try {
        const tempUrl = URL.createObjectURL(audioBlob);
        const tempAudio = new Audio(tempUrl);
        durationSeconds = await new Promise<number | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 3000);
          tempAudio.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve(isFinite(tempAudio.duration) ? Math.round(tempAudio.duration) : null);
          };
          tempAudio.onerror = () => {
            clearTimeout(timeout);
            resolve(null);
          };
          tempAudio.load();
        });
        URL.revokeObjectURL(tempUrl);
      } catch {
        console.warn('Could not determine audio duration');
      }
      
      // Upload audio file
      const fileName = `voice_${Date.now()}.${extension}`;
      const filePath = `${id}/${fileName}`;

      console.log('Attempting upload to:', filePath, 'size:', audioBlob.size, 'type:', contentType);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-voice-messages')
        .upload(filePath, audioBlob, {
          contentType: contentType,
          upsert: false,
          cacheControl: '3600'
        });
      
      console.log('Upload result - data:', uploadData, 'error:', uploadError);

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          statusCode: (uploadError as any).statusCode,
          error: uploadError
        });
        
        // Provide more specific error messages
        if (uploadError.message?.includes('policy')) {
          throw new Error('Keine Berechtigung zum Hochladen. Bitte kontaktieren Sie den Administrator.');
        } else if (uploadError.message?.includes('size')) {
          throw new Error('Datei zu groß (Maximum: 50MB)');
        } else {
          throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
        }
      }

      if (!uploadData || !uploadData.path) {
        console.error('Upload succeeded but no data returned');
        throw new Error('Upload-Daten fehlen');
      }
      
      console.log('Upload successful! Path:', uploadData.path);

      // Get the public URL for verification
      const { data: urlData } = supabase.storage
        .from('project-voice-messages')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', urlData.publicUrl);

      if (!urlData.publicUrl) {
        throw new Error('Konnte keine öffentliche URL erhalten');
      }
      
      // Verify the file is actually accessible by attempting to fetch its metadata
      try {
        const testResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.warn('File HEAD request failed with status:', testResponse.status);
        } else {
          console.log('File verification successful, Content-Type:', testResponse.headers.get('content-type'));
        }
      } catch (fetchError) {
        console.warn('Could not verify file upload:', fetchError);
        // Don't fail the whole operation if verification fails
      }

      // Insert into voice messages table
      const { error: insertError } = await supabase
        .from('project_voice_messages')
        .insert({
          project_info_id: projectInfo.id,
          storage_path: filePath,
          file_name: fileName,
          transcription: transcriptionText && transcriptionText !== '[Transkription fehlgeschlagen]' && !transcriptionText.includes('serverseitig') ? transcriptionText : null,
          duration_seconds: durationSeconds,
        });

      if (insertError) {
        console.error('Database error:', insertError);
        // Try to clean up the uploaded file
        await supabase.storage.from('project-voice-messages').remove([filePath]);
        throw new Error(`Datenbank-Fehler: ${insertError.message}`);
      }

      showToast('Sprachnachricht gespeichert', 'success');
      setAudioBlob(null);
      setTranscriptionText('');
      await loadData();
    } catch (error: any) {
      console.error('Error saving voice message:', error);
      showToast(`Fehler beim Speichern: ${error.message}`, 'error');
    } finally {
      setUploadingVoice(false);
    }
  };

  const deleteVoiceMessage = async (voiceId: string, storagePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-voice-messages')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_voice_messages')
        .delete()
        .eq('id', voiceId);

      if (dbError) throw dbError;

      showToast('Sprachnachricht gelöscht', 'success');
      await loadData();
    } catch (error: any) {
      console.error('Error deleting voice message:', error);
      showToast('Fehler beim Löschen der Sprachnachricht', 'error');
    }
  };

  const updateTranscription = async (voiceId: string, newTranscription: string) => {
    try {
      const { error } = await supabase
        .from('project_voice_messages')
        .update({ transcription: newTranscription })
        .eq('id', voiceId);

      if (error) throw error;

      showToast('Transkription aktualisiert', 'success');
      setEditingTranscription(null);
      await loadData();
    } catch (error: any) {
      console.error('Error updating transcription:', error);
      showToast('Fehler beim Aktualisieren der Transkription', 'error');
    }
  };

  const getVoiceUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('project-voice-messages')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieLoader size={120} />
      </View>
    );
  }

  if (!canView) {
    return (
      <View style={styles.container}>
        <Card style={styles.noAccessCard}>
          <Text style={styles.noAccessText}>
            Sie haben keine Berechtigung, die allgemeinen Projektinformationen anzuzeigen.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Allgemeine Info</Text>
          <Text style={styles.pageSubtitle}>
            Detaillierte Projektbeschreibung und Informationen
          </Text>
        </View>
        {canEdit && !isEditMode && (
          <Button onClick={() => setIsEditMode(true)}>
            <Edit2 size={18} /> Bearbeiten
          </Button>
        )}
        {isEditMode && (
          <View style={styles.editActions}>
            <Button 
              onClick={() => {
                setIsEditMode(false);
                setDetailedDescription(projectInfo?.detailed_description || '');
                setNotes(projectInfo?.notes || '');
                setFormattedAddress(projectInfo?.formatted_address || project?.address || '');
              }}
              style={styles.cancelButton}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save size={18} /> Speichern
            </Button>
          </View>
        )}
      </View>

      {/* Project Basic Info */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Projektübersicht</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Projektname</Text>
            <Text style={styles.infoValue}>{project?.name}</Text>
          </View>
          {project?.address && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{project.address}</Text>
            </View>
          )}
          {project?.city && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Stadt</Text>
              <Text style={styles.infoValue}>
                {project.postal_code && `${project.postal_code} `}{project.city}
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* Detailed Description */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Detaillierte Beschreibung</Text>
        {isEditMode ? (
          <RichTextEditor
            value={detailedDescription}
            onChange={setDetailedDescription}
            placeholder="Ausführliche Projektbeschreibung..."
            disabled={saving}
          />
        ) : (
          <View>
            {detailedDescription ? (
              <div 
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detailedDescription) }}
                style={{ fontSize: 15, color: '#475569', lineHeight: 1.6 }}
              />
            ) : (
              <Text style={styles.descriptionText}>
                Keine detaillierte Beschreibung vorhanden.
              </Text>
            )}
          </View>
        )}
      </Card>

      {/* Location & Map */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <MapPin size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Standort & Karte</Text>
          <Button 
            onClick={openGoogleMaps}
            style={styles.mapButton}
          >
            <ExternalLink size={16} /> Route in Google Maps öffnen
          </Button>
        </View>

        {(project?.address || projectInfo?.formatted_address) && (
          <MapDisplay
            address={projectInfo?.formatted_address || project?.address || ''}
            latitude={projectInfo?.latitude || project?.latitude}
            longitude={projectInfo?.longitude || project?.longitude}
          />
        )}

        {!project?.address && !projectInfo?.formatted_address && (
          <Text style={styles.addressText}>
            Keine Adresse hinterlegt
          </Text>
        )}
      </Card>

      {/* Images Gallery - Carousel with lightbox */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <ImageIcon size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Bildergalerie</Text>
          {canEdit && (
            <>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="image-upload-input"
              />
              <Button 
                onClick={() => document.getElementById('image-upload-input')?.click()}
                disabled={uploadingImage}
              >
                <Plus size={16} /> {uploadingImage ? 'Wird hochgeladen...' : 'Bild hinzufügen'}
              </Button>
            </>
          )}
        </View>

        {canEdit && images.length === 0 && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? colors.primary : '#E2E8F0'}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onClick={() => document.getElementById('image-upload-input')?.click()}
          >
            <Upload size={48} color={isDragging ? colors.primary : '#CBD5E1'} style={{ margin: '0 auto 16px' }} />
            <Text style={styles.emptyText}>
              {isDragging ? 'Bilder hier ablegen' : 'Bilder hierher ziehen oder klicken zum Auswählen'}
            </Text>
            <Text style={styles.emptySubtext}>
              Unterstützte Formate: JPEG, PNG, GIF, WebP (max. 10MB)
            </Text>
          </div>
        )}

        {images.length > 0 && (
          <div
            onDragOver={canEdit ? handleDragOver : undefined}
            onDragLeave={canEdit ? handleDragLeave : undefined}
            onDrop={canEdit ? handleDrop : undefined}
          >
            {/* Fan-style 3-panel carousel */}
            <div style={{ position: 'relative', background: '#f8fafc', borderRadius: 20, padding: '32px 16px 20px', overflow: 'hidden' }}>
              {/* Cards row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, minHeight: 280, position: 'relative' }}>
                {/* Left card (prev) */}
                {images.length > 1 && (() => {
                  const prevIdx = (carouselIndex - 1 + images.length) % images.length;
                  return (
                    <div
                      onClick={() => setCarouselIndex(prevIdx)}
                      style={{
                        flex: '0 0 auto',
                        width: '26%',
                        height: 220,
                        borderRadius: 20,
                        overflow: 'hidden',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                        opacity: 0.65,
                        transform: 'scale(0.88) translateX(40px)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        zIndex: 1,
                        flexShrink: 0,
                        background: '#e2e8f0',
                      }}
                    >
                      <img src={getImageUrl(images[prevIdx].storage_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  );
                })()}

                {/* Center card (active) */}
                <div
                  style={{
                    flex: '0 0 auto',
                    width: images.length === 1 ? '70%' : '44%',
                    height: 260,
                    borderRadius: 20,
                    overflow: 'hidden',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                    opacity: 1,
                    transform: 'scale(1)',
                    cursor: 'zoom-in',
                    transition: 'all 0.3s ease',
                    zIndex: 3,
                    position: 'relative',
                    flexShrink: 0,
                    background: '#e2e8f0',
                  }}
                  onClick={() => { setLightboxIndex(carouselIndex); setLightboxOpen(true); }}
                >
                  <img
                    src={getImageUrl(images[carouselIndex].storage_path)}
                    alt={images[carouselIndex].caption || `Bild ${carouselIndex + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {/* Zoom hint */}
                  <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
                    <ZoomIn size={13} color="#fff" />
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>Vergrößern</span>
                  </div>
                  {/* Caption */}
                  {images[carouselIndex].caption && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', padding: '20px 12px 10px', color: '#fff', fontSize: 12 }}>
                      {images[carouselIndex].caption}
                    </div>
                  )}
                  {/* Edit/Delete overlay */}
                  {(canEdit || canDelete) && (
                    <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedImage(images[carouselIndex]); setImageEditModal(true); }}
                          style={{ background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: 11, fontWeight: 600 }}
                        >
                          <Edit2 size={12} color="#fff" /> Bearbeiten
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Bild wirklich löschen?')) { handleDeleteImage(images[carouselIndex].id, images[carouselIndex].storage_path); if (carouselIndex >= images.length - 1) setCarouselIndex(Math.max(0, images.length - 2)); } }}
                          style={{ background: 'rgba(220,38,38,0.75)', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: 11, fontWeight: 600 }}
                        >
                          <Trash2 size={12} color="#fff" /> Löschen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right card (next) */}
                {images.length > 1 && (() => {
                  const nextIdx = (carouselIndex + 1) % images.length;
                  return (
                    <div
                      onClick={() => setCarouselIndex(nextIdx)}
                      style={{
                        flex: '0 0 auto',
                        width: '26%',
                        height: 220,
                        borderRadius: 20,
                        overflow: 'hidden',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                        opacity: 0.65,
                        transform: 'scale(0.88) translateX(-40px)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        zIndex: 1,
                        flexShrink: 0,
                        background: '#e2e8f0',
                      }}
                    >
                      <img src={getImageUrl(images[nextIdx].storage_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  );
                })()}
              </div>

              {/* Navigation arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCarouselIndex((carouselIndex - 1 + images.length) % images.length); }}
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: '#ffffff', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', zIndex: 10 }}
                  >
                    <ChevronLeft size={20} color="#334155" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCarouselIndex((carouselIndex + 1) % images.length); }}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: '#ffffff', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', zIndex: 10 }}
                  >
                    <ChevronRight size={20} color="#334155" />
                  </button>
                </>
              )}

              {/* Dot indicators */}
              {images.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCarouselIndex(i); }}
                      style={{ width: i === carouselIndex ? 24 : 8, height: 8, borderRadius: 4, background: i === carouselIndex ? colors.primary : '#cbd5e1', border: 'none', cursor: 'pointer', transition: 'all 0.25s ease', padding: 0 }}
                    />
                  ))}
                </div>
              )}

              {/* Counter badge */}
              <div style={{ position: 'absolute', top: 12, right: 16, background: 'rgba(15,23,42,0.55)', borderRadius: 20, padding: '3px 10px', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {carouselIndex + 1} / {images.length}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxOpen(false)}
        >
          <button onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color="#fff" />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
                style={{ position: 'absolute', left: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={26} color="#fff" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
                style={{ position: 'absolute', right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={26} color="#fff" />
              </button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={getImageUrl(images[lightboxIndex].storage_path)}
              alt={images[lightboxIndex].caption || ''}
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            />
            {images[lightboxIndex].caption && (
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', maxWidth: 600 }}>{images[lightboxIndex].caption}</div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{lightboxIndex + 1} / {images.length}</div>
          </div>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              {images.map((img, i) => (
                <div
                  key={img.id}
                  onClick={() => setLightboxIndex(i)}
                  style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${i === lightboxIndex ? '#fff' : 'transparent'}`, opacity: i === lightboxIndex ? 1 : 0.5 }}
                >
                  <img src={getImageUrl(img.storage_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Voice Message - Sprachaufnahme mit Transkription */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Mic size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Sprachnachrichten mit Transkription</Text>
        </View>

        {/* Existing Voice Messages */}
        {voiceMessages.length > 0 && (
          <View style={styles.voiceMessagesList}>
            {voiceMessages.map((voice) => (
              <View key={voice.id} style={styles.voiceMessageItem}>
                <VoicePlayer 
                  audioUrl={getVoiceUrl(voice.storage_path)} 
                  duration={voice.duration_seconds}
                />
                
                {editingTranscription === voice.id ? (
                  <View style={styles.transcriptionBox}>
                    <Text style={styles.transcriptionLabel}>Transkription bearbeiten:</Text>
                    <Input
                      value={transcriptionEditText}
                      onChangeText={setTranscriptionEditText}
                      placeholder="Transkription eingeben..."
                      multiline
                      numberOfLines={4}
                      style={styles.transcriptionInput as any}
                    />
                    <View style={styles.voiceActions}>
                      <Button onClick={() => setEditingTranscription(null)} style={styles.cancelButton}>
                        Abbrechen
                      </Button>
                      <Button onClick={() => updateTranscription(voice.id, transcriptionEditText)}>
                        <Save size={16} /> Speichern
                      </Button>
                    </View>
                  </View>
                ) : voice.transcription ? (
                  <View style={styles.transcriptionBox}>
                    <Text style={styles.transcriptionLabel}>Transkription:</Text>
                    <Text style={styles.transcriptionText}>{voice.transcription}</Text>
                    {canEdit && (
                      <TouchableOpacity 
                        onPress={() => {
                          setEditingTranscription(voice.id);
                          setTranscriptionEditText(voice.transcription || '');
                        }}
                        style={styles.editTranscriptionButton}
                      >
                        <Edit2 size={14} color={colors.primary} />
                        <Text style={styles.editTranscriptionText}>Bearbeiten</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : canEdit ? (
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingTranscription(voice.id);
                      setTranscriptionEditText('');
                    }}
                    style={styles.addTranscriptionButton}
                  >
                    <Plus size={16} color={colors.primary} />
                    <Text style={styles.addTranscriptionText}>Transkription hinzufügen</Text>
                  </TouchableOpacity>
                ) : null}

                {canEdit && (
                  <TouchableOpacity
                    onPress={() => {
                      if (confirm('Sprachnachricht wirklich löschen?')) {
                        deleteVoiceMessage(voice.id, voice.storage_path);
                      }
                    }}
                    style={styles.deleteVoiceButton}
                  >
                    <Trash2 size={16} color="#DC2626" />
                    <Text style={styles.deleteVoiceText}>Löschen</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* New Recording UI */}
        {audioBlob ? (
          <View>
            <VoicePlayer 
              audioUrl={URL.createObjectURL(audioBlob)}
            />
            
            {isTranscribing ? (
              <View style={styles.transcriptionBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.transcriptionLabel}>Wird transkribiert...</Text>
              </View>
            ) : transcriptionText ? (
              <View style={styles.transcriptionBox}>
                <Text style={styles.transcriptionLabel}>Transkription:</Text>
                <Input
                  value={transcriptionText}
                  onChangeText={setTranscriptionText}
                  placeholder="Transkription bearbeiten..."
                  multiline
                  numberOfLines={4}
                  style={styles.transcriptionInput as any}
                />
              </View>
            ) : null}

            <View style={styles.voiceActions}>
              <Button onClick={() => { setAudioBlob(null); setTranscriptionText(''); }} style={styles.cancelButton}>
                Verwerfen
              </Button>
              <Button onClick={saveVoiceMessage} disabled={uploadingVoice}>
                <Save size={16} /> {uploadingVoice ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </View>
          </View>
        ) : (
          <View>
            {canEdit && !isRecording ? (
              <View style={styles.voiceRecorderWrapper}>
                <VoiceRecorder
                  isRecording={isRecording}
                  onStart={startRecording}
                  onStop={stopRecording}
                  disabled={uploadingVoice}
                />
                <View style={styles.voiceUploadSection}>
                  <Text style={styles.orText}>oder</Text>
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Button 
                    onClick={() => audioFileInputRef.current?.click()}
                    disabled={uploadingVoice}
                    style={styles.uploadButton}
                  >
                    <Upload size={16} /> {uploadingVoice ? 'Lädt...' : 'Datei hochladen'}
                  </Button>
                </View>
              </View>
            ) : isRecording ? (
              <View style={styles.voiceRecorderWrapper}>
                <VoiceRecorder
                  isRecording={isRecording}
                  onStart={startRecording}
                  onStop={stopRecording}
                  disabled={uploadingVoice}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Mic size={48} color={'#CBD5E1'} />
                <Text style={styles.emptyText}>Keine Sprachnachricht vorhanden</Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Notes */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Notizen</Text>
        {isEditMode ? (
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="Allgemeine Notizen zum Projekt..."
          />
        ) : (
          <View>
            {notes ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notes) }} style={{ fontSize: 14, lineHeight: 1.6, color: '#475569' }} />
            ) : (
              <Text style={styles.notesText}>Keine Notizen vorhanden.</Text>
            )}
          </View>
        )}
      </Card>

      {/* Image Edit Modal */}
      {imageEditModal && selectedImage && (
        <ModernModal
          visible={imageEditModal}
          onClose={() => {
            setImageEditModal(false);
            setSelectedImage(null);
          }}
          title="Bildunterschrift bearbeiten"
        >
          <View style={styles.modalContent}>
            <Image 
              source={{ uri: getImageUrl(selectedImage.storage_path) }}
              style={styles.modalImage}
              resizeMode="contain"
            />
            <Input
              value={selectedImage.caption || ''}
              onChangeText={(text) => setSelectedImage({ ...selectedImage, caption: text })}
              placeholder="Bildunterschrift..."
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Button onClick={() => {
                setImageEditModal(false);
                setSelectedImage(null);
              }} style={styles.cancelButton}>
                Abbrechen
              </Button>
              <Button onClick={() => handleUpdateCaption(selectedImage.id, selectedImage.caption || '')}>
                <Save size={16} /> Speichern
              </Button>
            </View>
          </View>
        </ModernModal>
      )}
    </ScrollView>
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
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  card: {
    marginBottom: 20,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    padding: 12,
  },
  addressText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  mapButton: {
    marginBottom: 12,
  },
  coordinatesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  coordinatesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  coordinatesText: {
    fontSize: 13,
    color: '#475569',
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageItem: {
    width: '31%',
    minWidth: 120,
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  imageActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  imageActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(220,38,38,0.9)',
  },
  imagePlaceholder: {
    aspectRatio: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCaption: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  audioPlayerContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 12,
  },
  transcriptionBox: {
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginBottom: 12,
  },
  transcriptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 6,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#1E3A8A',
    lineHeight: 20,
  },
  transcriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  voiceActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  voiceRecorderWrapper: {
    gap: 16,
  },
  voiceUploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  orText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  stopButton: {
    backgroundColor: '#DC2626',
  },
  uploadButton: {
    backgroundColor: '#3B82F6',
  },
  deleteVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    marginTop: 8,
  },
  deleteVoiceText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  voiceMessagesList: {
    gap: 12,
    marginBottom: 16,
  },
  voiceMessageItem: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  editTranscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  editTranscriptionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  addTranscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  addTranscriptionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  gpsButton: {
    backgroundColor: '#10B981',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  modalContent: {
    gap: 16,
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
  },
  notesText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: 40,
    padding: 16,
  },
  infoCardText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  infoCardBold: {
    fontWeight: '700',
  },
  noAccessCard: {
    padding: 40,
    alignItems: 'center',
  },
  noAccessText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});
