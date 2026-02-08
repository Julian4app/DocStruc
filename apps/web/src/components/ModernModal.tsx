import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface ModernModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: number;
}

/**
 * ModernModal — uses a pure CSS portal approach (position: fixed) 
 * instead of RNModal to avoid z-index / stacking-context issues
 * that plague react-native-web's Modal implementation.
 */
export function ModernModal({ visible, onClose, title, children, maxWidth = 600 }: ModernModalProps) {
    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop */}
            <TouchableOpacity 
                style={styles.backdrop} 
                activeOpacity={1} 
                onPress={onClose} 
            />
            
            {/* Content — centered via flexbox on overlay */}
            <View style={[styles.modalCard, { maxWidth }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.body}>
                    {children}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        // @ts-ignore – position: fixed is web-only but essential
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        // @ts-ignore
        backdropFilter: 'blur(4px)',
        // @ts-ignore
        WebkitBackdropFilter: 'blur(4px)',
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
        overflow: 'hidden',
        zIndex: 1, // Above backdrop within overlay
        maxHeight: '90vh' as any,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        // @ts-ignore
        transition: 'background-color 0.15s ease',
    },
    body: {
        padding: 24,
        backgroundColor: '#ffffff',
    }
});
