import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { colors } from '@docstruc/theme';

interface ImageUploaderProps {
    value: string[];
    onChange: (urls: string[]) => void;
    bucketName?: string;
    label?: string;
    single?: boolean;
}

export function ImageUploader({ value = [], onChange, bucketName = 'project-images', label = "Upload Images", single = false }: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        
        setUploading(true);
        try {
            const newUrls: string[] = [];
            
            for (let i = 0; i < event.target.files.length; i++) {
                const file = event.target.files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
                newUrls.push(data.publicUrl);
            }

            if (single) {
                onChange([newUrls[0]]);
            } else {
                onChange([...value, ...newUrls]);
            }
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        const newUrls = [...value];
        newUrls.splice(index, 1);
        onChange(newUrls);
    };

    // Web-specific drag and drop handlers
    const handleDragOver = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Re-use logic (create synthetic event or extract function)
             const files = e.dataTransfer.files;
             setUploading(true);
             try {
                 const newUrls: string[] = [];
                 for (let i = 0; i < files.length; i++) {
                     const file = files[i];
                     const fileExt = file.name.split('.').pop();
                     const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                     const { error } = await supabase.storage.from(bucketName).upload(fileName, file);
                     if (error) throw error;
                     const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
                     newUrls.push(data.publicUrl);
                 }
                 if (single) onChange([newUrls[0]]);
                 else onChange([...value, ...newUrls]);
             } catch (err: any) {
                 alert(err.message);
             } finally {
                 setUploading(false);
             }
        }
    };

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            
            <View 
                style={[styles.dropZone, uploading && styles.uploading]}
                // @ts-ignore - React Native Web specific props for valid HTML5 events
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    multiple={!single}
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <Upload size={24} color={colors.textSecondary} />
                <Text style={styles.dropText}>
                    {uploading ? 'Uploading...' : 'Click or Drag & Drop to Upload'}
                </Text>
            </View>

            {value.length > 0 && (
                <View style={styles.previewGrid}>
                    {value.map((url, idx) => (
                        <View key={idx} style={styles.previewItem}>
                            <Image source={{ uri: url }} style={styles.image} />
                            <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                                <X size={12} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
        marginBottom: 8
    },
    dropZone: {
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        cursor: 'pointer' as any,
        gap: 8,
        transition: 'all 0.2s ease',
    },
    uploading: {
        opacity: 0.5,
        pointerEvents: 'none'
    },
    dropText: {
        color: colors.textSecondary,
        fontSize: 14
    },
    previewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12
    },
    previewItem: {
        width: 80,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: colors.border
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    removeBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center'
    }
});
