import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
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

export function Select({ label, value, options, onChange, placeholder = "Select...", disabled = false }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedOption = options.find(o => o.value === value);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            
            <TouchableOpacity 
                style={[styles.trigger, disabled && styles.disabled]} 
                onPress={() => !disabled && setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <Text style={[styles.valueText, !selectedOption && styles.placeholder]}>
                    {selectedOption ? selectedOption.label : placeholder}
                </Text>
                <ChevronDown size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Dropdown Menu - Simple conditional rendering with absolute positioning for Web */}
            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <TouchableOpacity 
                        style={styles.backdrop} 
                        onPress={() => setIsOpen(false)} 
                        activeOpacity={1} 
                    />
                    
                    <View style={styles.dropdown}>
                        <ScrollView style={styles.scroll} nestedScrollEnabled>
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.option,
                                        option.value === value && styles.optionSelected
                                    ]}
                                    onPress={() => handleSelect(option.value)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        option.value === value && styles.optionTextSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                    {option.value === value && (
                                        <Check size={14} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        zIndex: 10, // Ensure dropdown goes over other elements
        position: 'relative'
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6
    },
    trigger: {
        height: 40,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    disabled: {
        opacity: 0.6,
        backgroundColor: '#F8FAFC'
    },
    valueText: {
        fontSize: 14,
        color: '#0F172A'
    },
    placeholder: {
        color: '#94A3B8'
    },
    backdrop: {
        position: 'fixed' as any, // Web only property
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        cursor: 'default'
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        zIndex: 1000,
        maxHeight: 200,
        overflow: 'hidden'
    },
    scroll: {
        maxHeight: 200
    },
    option: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    optionSelected: {
        backgroundColor: '#EFF6FF'
    },
    optionText: {
        fontSize: 14,
        color: '#334155'
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: '500'
    }
});
