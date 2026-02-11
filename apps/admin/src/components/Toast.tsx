import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, type, message, duration };
    
    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const showError = useCallback((message: string) => showToast(message, 'error', 5000), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, 'info'), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="#059669" />;
      case 'error':
        return <AlertCircle size={20} color="#dc2626" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      case 'info':
        return <Info size={20} color="#3b82f6" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#f0fdf4',
          borderColor: '#86efac',
        };
      case 'error':
        return {
          backgroundColor: '#fef2f2',
          borderColor: '#fca5a5',
        };
      case 'warning':
        return {
          backgroundColor: '#fffbeb',
          borderColor: '#fcd34d',
        };
      case 'info':
        return {
          backgroundColor: '#eff6ff',
          borderColor: '#93c5fd',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <View style={styles.toastContainer}>
        {toasts.map((toast) => {
          const colorStyles = getStyles(toast.type);
          return (
            <View
              key={toast.id}
              style={[
                styles.toast,
                {
                  backgroundColor: colorStyles.backgroundColor,
                  borderLeftColor: colorStyles.borderColor,
                },
              ]}
            >
              <View style={styles.toastContent}>
                {getIcon(toast.type)}
                <Text style={styles.toastMessage}>{toast.message}</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeToast(toast.id)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'fixed' as any,
    bottom: 24,
    right: 24,
    zIndex: 100000,
    gap: 12,
    pointerEvents: 'box-none' as any,
  },
  toast: {
    minWidth: 320,
    maxWidth: 420,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    pointerEvents: 'auto' as any,
    // Animation
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toastMessage: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
});
