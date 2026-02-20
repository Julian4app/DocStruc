import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronDown, X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: Option[];
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Auswählen...', 
  multiple = false,
  disabled = false 
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<any>(null);
  const triggerRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const openDropdown = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
    setIsOpen(!isOpen);
  };

  const getSelectedLabel = () => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      return value.map(v => options.find(opt => opt.value === v)?.label).filter(Boolean).join(', ');
    }
    const selected = options.find(opt => opt.value === value);
    return selected ? selected.label : placeholder;
  };

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter(v => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const removeTag = (e: any, optionValue: string) => {
    e.stopPropagation();
    if (multiple && Array.isArray(value)) {
      onChange(value.filter(v => v !== optionValue));
    }
  };

  const selectedValues = Array.isArray(value) ? value : [value];
  const selectedOptions = multiple ? options.filter(opt => selectedValues.includes(opt.value)) : [];

  return (
    <View ref={triggerRef} style={styles.container}>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={openDropdown}
        activeOpacity={0.7}
      >
        {multiple && selectedOptions.length > 0 ? (
          <View style={styles.tagsContainer}>
            {selectedOptions.map(opt => (
              <View key={opt.value} style={styles.tag}>
                <Text style={styles.tagText}>{opt.label}</Text>
                <TouchableOpacity
                  onPress={(e) => removeTag(e, opt.value)}
                  style={styles.tagRemove}
                  activeOpacity={0.7}
                >
                  <X size={14} color="#6366f1" />
                </TouchableOpacity>
              </View>
            ))}
            <Text style={styles.addMoreText}>Add tools</Text>
          </View>
        ) : (
          <Text style={[styles.selectedText, !value && styles.placeholderText]}>
            {getSelectedLabel()}
          </Text>
        )}
        <ChevronDown
          size={20}
          color="#94a3b8"
          style={{
            transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
            transition: 'transform 0.2s ease',
          } as any}
        />
      </TouchableOpacity>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} style={{ ...dropdownStyle, position: 'fixed' }}>
          <View style={styles.dropdown}>
            <ScrollView style={styles.optionsList} bounces={false}>
              {options.map((option) => {
                const isSelected = multiple 
                  ? selectedValues.includes(option.value)
                  : value === option.value;
                
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {multiple && isSelected && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </div>,
        document.body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative' as any,
    width: '100%',
    zIndex: 100,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minHeight: 48,
    cursor: 'pointer' as any,
  },
  triggerDisabled: {
    backgroundColor: '#F8FAFC',
    cursor: 'not-allowed' as any,
  },
  selectedText: {
    fontSize: 15,
    color: '#1e293b',
    flex: 1,
  },
  placeholderText: {
    color: '#94a3b8',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    alignItems: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f8f7ff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#8b7ef8',
  },
  tagText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  tagRemove: {
    padding: 2,
  },
  addMoreText: {
    fontSize: 14,
    color: '#d4d4d8',
    fontWeight: '400',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    maxHeight: 280,
    overflow: 'hidden' as any,
    elevation: 10000,
  },
  optionsList: {
    maxHeight: 280,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    cursor: 'pointer' as any,
  },
  optionSelected: {
    backgroundColor: '#f8f7ff',
  },
  optionText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '400',
  },
  optionTextSelected: {
    color: '#6366f1',
    fontWeight: '600',
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
