import React from 'react';
import { View, Text, StyleSheet, Modal as RNModal, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface ModernModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: number;
}

export function ModernModal({ visible, onClose, title, children, maxWidth = 600 }: ModernModalProps) {
    if (!visible) return null;

    return (
        <RNModal transparent visible={visible} animationType="fade">
            <View style={styles.wrapper}>
                <TouchableOpacity 
                    style={styles.backdrop} 
                    activeOpacity={1} 
                    onPress={onClose} 
                />
                
                <View style={styles.contentContainer} pointerEvents="box-none">
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
            </View>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        // Ensure zIndex is top but let standard Modal handling work
        zIndex: 9999, 
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        // @ts-ignore
        backdropFilter: 'blur(4px)',
        zIndex: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 2, // Explicitly above backdrop
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0', // Visible border just in case
        opacity: 1, // Force opacity
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff', // Ensure header has background
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a', // Explicit dark color
    },
    closeBtn: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: '#f1f5f9'
    },
    body: {
        padding: 20,
        backgroundColor: '#ffffff', // Ensure body has background
    }
});
