import React from 'react';
import { createPortal } from 'react-dom';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' shows red confirm button (default for deletes), 'warning' shows orange */
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
}

/**
 * Branded in-app confirm dialog — replaces all window.confirm() / confirm() calls.
 * Renders via React Portal so it always appears above all other content.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
  onConfirm,
  onCancel,
  zIndex = 20000,
}: ConfirmDialogProps) {
  const portalRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!portalRef.current) {
      portalRef.current = document.createElement('div');
    }
    if (visible) {
      document.body.appendChild(portalRef.current);
    }
    return () => {
      if (portalRef.current && document.body.contains(portalRef.current)) {
        document.body.removeChild(portalRef.current);
      }
    };
  }, [visible]);

  if (!visible || typeof document === 'undefined' || !portalRef.current) return null;

  const confirmBg =
    variant === 'danger' ? colors.danger :
    variant === 'warning' ? colors.warning :
    colors.primary;

  const iconBg =
    variant === 'danger' ? '#FEF2F2' :
    variant === 'warning' ? '#FFFBEB' :
    '#EFF6FF';

  const iconColor =
    variant === 'danger' ? colors.danger :
    variant === 'warning' ? colors.warning :
    colors.primary;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />
      {/* Card */}
      <View style={styles.card}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {variant === 'danger'
            ? <Trash2 size={22} color={iconColor} />
            : <AlertTriangle size={22} color={iconColor} />}
        </View>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Text */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: confirmBg }]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </div>
  );

  return createPortal(content, portalRef.current);
}

const styles = StyleSheet.create({
  card: {
    position: 'relative' as any,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    margin: 16,
    alignItems: 'center',
    // @ts-ignore
    zIndex: 1,
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute' as any,
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    // @ts-ignore
    cursor: 'pointer',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    // @ts-ignore
    cursor: 'pointer',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
