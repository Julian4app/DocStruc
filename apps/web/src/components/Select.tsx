import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

            {/* Dropdown Menu */}
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
        zIndex: 1000,
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
    backdrop: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
    },
    dropdown: {
        position: 'absolute' as any,
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        maxHeight: 300,
        zIndex: 1000,
    },
    scroll: {
        maxHeight: 300,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    optionSelected: {
        backgroundColor: '#EFF6FF',
    },
    optionText: {
        fontSize: 14,
        color: '#334155',
        flex: 1,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
});
