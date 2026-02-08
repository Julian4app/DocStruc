import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.container}>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                ))}
            </View>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) => {
    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <CheckCircle size={20} color="#fff" />;
            case 'error': return <AlertCircle size={20} color="#fff" />;
            default: return <Info size={20} color="#fff" />;
        }
    };

    const getBgColor = () => {
        switch (toast.type) {
            case 'success': return '#10B981';
            case 'error': return '#EF4444';
            default: return '#3B82F6';
        }
    };

    return (
        <View style={[styles.toast, { backgroundColor: getBgColor() }]}>
            <View style={styles.content}>
                {getIcon()}
                <Text style={styles.text}>{toast.message}</Text>
            </View>
            <TouchableOpacity onPress={onDismiss}>
                <X size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'fixed' as any,
        bottom: 24,
        right: 24,
        zIndex: 9999,
        gap: 10,
        maxWidth: 380,
        width: '100%'
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingHorizontal: 20,
        borderRadius: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        minWidth: 300,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    }
});
