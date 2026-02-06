import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

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
        setTimeout(() => removeToast(id), 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.toastContainer}>
                {toasts.map(toast => (
                    <View key={toast.id} style={[styles.toast, styles[toast.type]]}>
                        {toast.type === 'success' && <CheckCircle size={20} color="#15803d" />}
                        {toast.type === 'error' && <AlertCircle size={20} color="#b91c1c" />}
                        {toast.type === 'info' && <Info size={20} color="#0369a1" />}
                        <Text style={styles.message}>{toast.message}</Text>
                        <TouchableOpacity onPress={() => removeToast(toast.id)}>
                            <X size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        gap: 12,
        zIndex: 10000,
        maxWidth: 400
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        gap: 12,
        borderLeftWidth: 4,
        minWidth: 300
    },
    success: { borderLeftColor: '#22c55e' },
    error: { borderLeftColor: '#ef4444' },
    info: { borderLeftColor: '#3b82f6' },
    message: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' }
});
