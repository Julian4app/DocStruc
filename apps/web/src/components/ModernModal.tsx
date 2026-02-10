import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
 * ModernModal — uses React Portal to render outside the DOM hierarchy
 * with a true full-page overlay that covers the entire viewport.
 */
export function ModernModal({ visible, onClose, title, children, maxWidth = 600 }: ModernModalProps) {
    const portalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        
        if (!portalRef.current) {
            portalRef.current = document.createElement('div');
            portalRef.current.id = 'modal-portal';
        }
        
        if (visible) {
            document.body.appendChild(portalRef.current);
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            if (portalRef.current && document.body.contains(portalRef.current)) {
                document.body.removeChild(portalRef.current);
            }
            document.body.style.overflow = '';
        };
    }, [visible]);

    if (!visible || typeof document === 'undefined' || !portalRef.current) return null;

    const modalContent = (
        <div style={overlayStyles}>
            {/* Backdrop */}
            <div 
                style={backdropStyles}
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div style={modalWrapperStyles}>
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
            </div>
        </div>
    );

    return createPortal(modalContent, portalRef.current);
}

// Pure CSS styles for portal overlay
const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'modalFadeIn 0.2s ease-out',
};

const backdropStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
};

const modalWrapperStyles: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '95vw',
    padding: 24,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
};


const styles = StyleSheet.create({
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        width: '100%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
        elevation: 10,
        maxHeight: '85vh' as any,
        display: 'flex' as any,
        flexDirection: 'column' as any,
        // @ts-ignore
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.05)',
        overflow: 'visible' as any,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.4,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        // @ts-ignore
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ':hover': {
            backgroundColor: '#F1F5F9',
        }
    },
    body: {
        padding: 24,
        backgroundColor: '#ffffff',
        flex: 1,
        // @ts-ignore
        overflowY: 'auto',
        overflowX: 'visible',
        position: 'relative' as any,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    }
});
