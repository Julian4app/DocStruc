import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal as RNModal, TouchableOpacity, Animated, Dimensions } from 'react-native';
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
    const [show, setShow] = useState(visible);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.95))[0];

    useEffect(() => {
        if (visible) {
            setShow(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true
            }).start(() => setShow(false));
        }
    }, [visible]);

    if (!show) return null;

    return (
        <RNModal transparent visible={show} animationType="none">
            <View style={styles.overlay}>
                <TouchableOpacity 
                    style={styles.backdrop} 
                    activeOpacity={1} 
                    onPress={onClose} 
                />
                
                <Animated.View style={[
                    styles.modalContainer, 
                    { maxWidth, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.content}>
                        {children}
                    </View>
                </Animated.View>
            </View>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 9999, // Ensure it's on top
        // @ts-ignore
        backdropFilter: 'blur(4px)' // Modern glass effect
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 10,
        maxHeight: '90%',
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary
    },
    closeBtn: {
        padding: 8,
        marginRight: -8,
        borderRadius: 8
    },
    content: {
        padding: 24
    }
});
