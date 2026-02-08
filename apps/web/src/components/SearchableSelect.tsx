import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface Option {
    label: string;
    value: string;
    subtitle?: string; // e.g. "Employee" or "Company A"
}

interface SearchableSelectProps {
    options: Option[];
    values: string[]; // Array of selected value IDs
    onChange: (values: string[]) => void;
    placeholder?: string;
    label?: string;
    multi?: boolean;
}

export function SearchableSelect({ options, values, onChange, placeholder = "Select...", label, multi = false }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside (Web behavior)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => {
        if (!opt || !opt.label) return false;
        const searchLower = search.toLowerCase();
        return opt.label.toLowerCase().includes(searchLower) || 
               (opt.subtitle && opt.subtitle.toLowerCase().includes(searchLower));
    });

    const toggleValue = (val: string) => {
        if (multi) {
            if (values.includes(val)) {
                onChange(values.filter(v => v !== val));
            } else {
                onChange([...values, val]);
            }
        } else {
            onChange([val]);
            setIsOpen(false);
        }
    };

    const selectedOptions = options.filter(o => values.includes(o.value));

    return (
        <div ref={containerRef} style={{ marginBottom: 16, position: 'relative', zIndex: 999999 }}> 
            {/* Using div for ref containment in web, View inside for styling */}
            <View>
                {label && <Text style={styles.label}>{label}</Text>}
                
                <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[styles.trigger, isOpen && styles.triggerActive]} 
                    onPress={() => setIsOpen(!isOpen)}
                >
                    <View style={styles.chipsContainer}>
                        {selectedOptions.length === 0 && (
                            <Text style={styles.placeholder}>{placeholder}</Text>
                        )}
                        {selectedOptions.map(opt => (
                            <View key={opt.value} style={styles.chip}>
                                <Text style={styles.chipText}>{opt.label}</Text>
                                <TouchableOpacity onPress={(e) => {
                                    e.stopPropagation();
                                    toggleValue(opt.value);
                                }}>
                                    <X size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                    <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {isOpen && (
                    <View style={styles.dropdown}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                        />
                        <ScrollView style={styles.optionsList} nestedScrollEnabled>
                            {filteredOptions.length === 0 ? (
                                <Text style={styles.noResults}>No results found</Text>
                            ) : (
                                filteredOptions.map(opt => {
                                    const isSelected = values.includes(opt.value);
                                    return (
                                        <TouchableOpacity 
                                            key={opt.value} 
                                            style={[styles.option, isSelected && styles.optionSelected]}
                                            onPress={() => toggleValue(opt.value)}
                                        >
                                            <View>
                                                <Text style={[styles.optionLabel, isSelected && styles.textSelected]}>{opt.label}</Text>
                                                {opt.subtitle && <Text style={styles.optionSub}>{opt.subtitle}</Text>}
                                            </View>
                                            {isSelected && <Check size={16} color={colors.primary} />}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
        </div>
    );
}

const styles = StyleSheet.create({
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 8
    },
    trigger: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff'
    },
    triggerActive: {
        borderColor: colors.primary,
        borderWidth: 2,
        paddingHorizontal: 11
    },
    placeholder: {
        color: colors.textSecondary,
        fontSize: 14
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingVertical: 6,
        flex: 1
    },
    chip: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 4,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    chipText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500'
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        zIndex: 999999,
        overflow: 'hidden'
    },
    searchInput: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        fontSize: 14
    },
    optionsList: {
        maxHeight: 200
    },
    option: {
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    optionSelected: {
        backgroundColor: '#f5faff'
    },
    optionLabel: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500'
    },
    textSelected: {
        color: colors.primary
    },
    optionSub: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2
    },
    noResults: {
        padding: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        fontSize: 14
    }
});
