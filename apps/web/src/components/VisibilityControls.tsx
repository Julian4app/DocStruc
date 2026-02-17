import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Globe, Users, Lock, Eye, ChevronDown } from 'lucide-react';
import { colors } from '@docstruc/theme';

export type VisibilityLevel = 'all_participants' | 'team_only' | 'owner_only';

const VISIBILITY_OPTIONS: { value: VisibilityLevel; label: string; shortLabel: string; description: string; icon: any; color: string; bgColor: string }[] = [
  {
    value: 'all_participants',
    label: 'Alle Beteiligten',
    shortLabel: 'Alle Beteiligten',
    description: 'Alle Projektmitglieder können dies sehen',
    icon: Globe,
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  {
    value: 'team_only',
    label: 'Nur eigenes Team',
    shortLabel: 'Nur Team',
    description: 'Nur Mitglieder Ihres Teams können dies sehen',
    icon: Users,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
  },
  {
    value: 'owner_only',
    label: 'Nur Projektersteller',
    shortLabel: 'Nur Ersteller',
    description: 'Nur Projektersteller und Superuser',
    icon: Lock,
    color: '#EF4444',
    bgColor: '#FEF2F2',
  },
];

function getVisibilityConfig(level: VisibilityLevel) {
  return VISIBILITY_OPTIONS.find(o => o.value === level) || VISIBILITY_OPTIONS[0];
}

interface VisibilityBadgeProps {
  visibility: VisibilityLevel;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

/**
 * Shows a small badge indicating the visibility level of a content item.
 */
export function VisibilityBadge({ visibility, size = 'small', showLabel = false }: VisibilityBadgeProps) {
  const config = getVisibilityConfig(visibility);
  const Icon = config.icon;
  const iconSize = size === 'small' ? 12 : 14;

  return (
    <View style={[styles.badge, { backgroundColor: config.bgColor }, size === 'medium' && styles.badgeMedium]}>
      <Icon size={iconSize} color={config.color} />
      {showLabel && (
        <Text style={[styles.label, { color: config.color }, size === 'medium' && styles.labelMedium]}>
          {config.shortLabel}
        </Text>
      )}
    </View>
  );
}

interface VisibilityDropdownProps {
  value: VisibilityLevel;
  onChange: (value: VisibilityLevel) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * A polished dropdown selector for visibility level.
 * Designed to sit at the top of create/edit modals.
 */
export function VisibilityDropdown({ value, onChange, disabled = false, label = 'Sichtbarkeit' }: VisibilityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<View>(null);
  const triggerRef = useRef<TouchableOpacity>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = getVisibilityConfig(value);
  const SelectedIcon = selected.icon;

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: any) => {
      // Check if click is outside both dropdown and trigger
      const target = e.target as HTMLElement;
      const dropdownEl = (dropdownRef.current as any)?._touchableNode || (dropdownRef.current as any);
      const triggerEl = (triggerRef.current as any)?._touchableNode || (triggerRef.current as any);
      
      if (dropdownEl && !dropdownEl.contains(target) && triggerEl && !triggerEl.contains(target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  // Calculate position when opening
  const handleToggle = () => {
    if (disabled) return;
    
    if (!isOpen) {
      // Opening: calculate position first, THEN open in next tick
      const triggerEl = (triggerRef.current as any)?._touchableNode || (triggerRef.current as any);
      
      if (triggerEl && typeof triggerEl.getBoundingClientRect === 'function') {
        const rect = triggerEl.getBoundingClientRect();
        const newPosition = {
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        };
        
        // Set position and open in the same state update using functional updates
        setMenuPosition(newPosition);
        // Use setTimeout to ensure position is set before opening
        setTimeout(() => {
          setIsOpen(true);
        }, 0);
      }
    } else {
      setIsOpen(false);
    }
  };

  return (
    <View style={styles.dropdownWrapper}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      {/* Trigger */}
      <TouchableOpacity
        ref={triggerRef as any}
        onPress={handleToggle}
        style={[
          styles.dropdownTrigger,
          { borderColor: isOpen ? selected.color : '#E2E8F0' },
          disabled && { opacity: 0.5 },
        ]}
        disabled={disabled}
      >
        <View style={[styles.dropdownIconCircle, { backgroundColor: selected.bgColor }]}>
          <SelectedIcon size={14} color={selected.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropdownTriggerText, { color: '#1F2937' }]}>{selected.label}</Text>
          <Text style={styles.dropdownTriggerDesc}>{selected.description}</Text>
        </View>
        <ChevronDown
          size={16}
          color="#9CA3AF"
          style={{ transform: isOpen ? [{ rotate: '180deg' }] : [] } as any}
        />
      </TouchableOpacity>

      {/* Dropdown Menu - Rendered via Portal to escape modal stacking context */}
      {isOpen && menuPosition && typeof document !== 'undefined' && createPortal(
        <View 
          ref={dropdownRef}
          style={{
            position: 'fixed' as any,
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            backgroundColor: '#ffffff',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 25,
            elevation: 20,
            zIndex: 999999,
            overflow: 'hidden',
          }}
        >
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={[
                  styles.dropdownOption,
                  isSelected && { backgroundColor: opt.bgColor },
                ]}
              >
                <View style={[styles.dropdownIconCircle, { backgroundColor: isSelected ? opt.bgColor : '#F3F4F6' }]}>
                  <Icon size={14} color={isSelected ? opt.color : '#6B7280'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.dropdownOptionLabel,
                    isSelected && { color: opt.color, fontWeight: '600' },
                  ]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.dropdownOptionDesc}>{opt.description}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.dropdownCheck, { backgroundColor: opt.color }]}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>,
        document.body
      )}
    </View>
  );
}

// Keep legacy VisibilitySelector for backwards compatibility (redirects to dropdown)
interface VisibilitySelectorProps {
  value: VisibilityLevel;
  onChange: (value: VisibilityLevel) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function VisibilitySelector({ value, onChange, disabled = false }: VisibilitySelectorProps) {
  return <VisibilityDropdown value={value} onChange={onChange} disabled={disabled} />;
}

const styles = StyleSheet.create({
  // VisibilityBadge styles
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
  labelMedium: {
    fontSize: 12,
  },

  // Dropdown styles
  dropdownWrapper: {
    gap: 4,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
  },
  dropdownIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  dropdownTriggerDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  dropdownOptionDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  dropdownCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
