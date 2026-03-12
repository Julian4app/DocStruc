import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, Check } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface SelectOption {
    label: string;
    value: string | number;
}

interface SelectProps {
    label?: string;
    value: string | number;
    options: SelectOption[];
    onChange: (value: string | number) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function Select({ label, value, options, onChange, placeholder = "Auswählen...", disabled = false }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<any>(null);

    const selectedOption = options.find(o => o.value === value);

    const handleOpen = () => {
        if (disabled) return;
        if (!isOpen && triggerRef.current) {
            const rect = (triggerRef.current as HTMLElement).getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        setIsOpen(prev => !prev);
    };

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
    };

    // Close on scroll or resize
    useEffect(() => {
        if (!isOpen) return;
        const close = () => setIsOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    const dropdownPortal = isOpen && typeof document !== 'undefined'
        ? createPortal(
            <>
                {/* Invisible backdrop */}
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                    onClick={() => setIsOpen(false)}
                />
                {/* Dropdown panel */}
                <div style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 99999,
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 24px rgba(15,23,42,0.12)',
                    maxHeight: 300,
                    overflowY: 'auto',
                }}>
                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: option.value === value ? '#EFF6FF' : '#ffffff',
                                cursor: 'pointer',
                                fontSize: 14,
                                color: option.value === value ? colors.primary : '#334155',
                                fontWeight: option.value === value ? 600 : 400,
                            }}
                            onMouseEnter={e => { if (option.value !== value) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F8FAFC'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = option.value === value ? '#EFF6FF' : '#ffffff'; }}
                        >
                            <span style={{ flex: 1 }}>{option.label}</span>
                            {option.value === value && <Check size={14} color={colors.primary} />}
                        </div>
                    ))}
                </div>
            </>,
            document.body
        )
        : null;

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}

            <TouchableOpacity
                ref={triggerRef}
                style={[styles.trigger, disabled && styles.disabled, isOpen && styles.triggerOpen]}
                onPress={handleOpen}
                activeOpacity={0.7}
            >
                <Text style={[styles.valueText, !selectedOption && styles.placeholder]}>
                    {selectedOption ? selectedOption.label : placeholder}
                </Text>
                <ChevronDown size={16} color="#64748b" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] } as any} />
            </TouchableOpacity>

            {dropdownPortal}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        minHeight: 48,
    },
    triggerOpen: {
        borderColor: colors.primary,
        borderWidth: 1.5,
    },
    disabled: {
        backgroundColor: '#F8FAFC',
        opacity: 0.6,
    },
    valueText: {
        fontSize: 14,
        color: '#0f172a',
        flex: 1,
    },
    placeholder: {
        color: '#94a3b8',
    },
});
