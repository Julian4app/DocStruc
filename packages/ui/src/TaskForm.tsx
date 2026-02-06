import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Image, TouchableOpacity } from 'react-native';
import { Button } from './Button';
import { Input } from './Input';
import { colors, spacing } from '@docstruc/theme';
import { MemberWithUser } from '@docstruc/api';
// import * as ImagePicker from 'expo-image-picker'; // <-- Replaced with platform wrapper
import * as ImagePicker from './platform/image-picker';

interface TaskFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  members: MemberWithUser[];
  initialValues?: any;
}

export function TaskForm({ onSubmit, onCancel, members, initialValues }: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [assignedTo, setAssignedTo] = useState(initialValues?.assigned_to || '');
  const [dueDate, setDueDate] = useState(initialValues?.due_date || '');
  const [image, setImage] = useState<string | null>(null);
  const [webFile, setWebFile] = useState<any>(null); // To store actual File object on web
  const [isDragOver, setIsDragOver] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // For web, if it's a blob/base64, we might handle it in upload, 
      // but expo-image-picker returns a uri that fetch() can read.
      if (Platform.OS === 'web' && result.assets[0].file) {
        setWebFile(result.assets[0].file);
      }
    }
  };

  const handleSubmit = () => {
    onSubmit({
      title,
      description,
      assigned_to: assignedTo,
      due_date: dueDate,
      imageUri: image,
      webFile: webFile
    });
  };

  // Web Drag and Drop Handlers
  const handleDragOver = (e: any) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          setImage(event.target.result);
          setWebFile(file);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>
        {initialValues ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
      </Text>

      <Input label="Titel" value={title} onChangeText={setTitle} placeholder="Was muss erledigt werden?" />
      
      <Input label="Beschreibung" value={description} onChangeText={setDescription} placeholder="Details..." />

      {/* Date Picker - Simplified as text input for cross-platform now */}
      <Input 
        label="Fälligkeitsdatum (YYYY-MM-DD)" 
        value={dueDate} 
        onChangeText={setDueDate} 
        placeholder="2024-12-31" 
      />

      {/* Assignee Selection - Custom Select for RN/Web */}
      <Text style={styles.label}>Zuweisen an</Text>
      <View style={styles.membersContainer}>
        {members.map(m => (
          <TouchableOpacity 
            key={m.user.id} 
            style={[styles.memberChip, assignedTo === m.user.id && styles.memberChipSelected]}
            onPress={() => setAssignedTo(m.user.id)}
          >
            <Text style={[styles.memberText, assignedTo === m.user.id && styles.memberTextSelected]}>
              {m.user.first_name || m.user.email}
            </Text>
          </TouchableOpacity>
        ))}
        {members.length === 0 && <Text style={styles.noMembers}>Keine Projektmitglieder gefunden</Text>}
      </View>

      <Text style={styles.label}>Foto</Text>
      
      {/* Drop Zone for Web */}
      {Platform.OS === 'web' ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragOver ? colors.primary : colors.border}`,
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            marginBottom: 10,
            backgroundColor: isDragOver ? colors.background : 'transparent',
            cursor: 'pointer'
          }}
          onClick={pickImage}
        >
          <Text style={{ color: colors.textSecondary }}>
            Bild hierher ziehen oder klicken zum Auswählen
          </Text>
        </div>
      ) : (
        <Button variant="outline" onClick={pickImage}>Foto auswählen</Button>
      )}

      {image && (
        <Image source={{ uri: image }} style={styles.previewImage} />
      )}

      <View style={styles.footer}>
        <Button onClick={handleSubmit}>Speichern</Button>
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing.m,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    marginTop: spacing.s,
  },
  membersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.m,
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  memberText: {
    fontSize: 14,
    color: colors.text,
  },
  memberTextSelected: {
    color: '#fff',
  },
  noMembers: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    borderRadius: 8,
    marginTop: 8,
  },
  footer: {
    marginTop: spacing.l,
    gap: 12,
  },
});
