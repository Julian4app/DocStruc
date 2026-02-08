import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { ChevronDown } from 'lucide-react';

interface Country {
    code: string;
    name: string;
    flag: string;
}

const countries: Country[] = [
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
    { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴' },
    { code: 'FI', name: 'Finland', flag: '🇫🇮' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
    { code: 'GR', name: 'Greece', flag: '🇬🇷' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
    { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
];

interface CountrySelectProps {
    label?: string;
    value: string;
    onChange: (code: string) => void;
}

export function CountrySelect({ label, value, onChange }: CountrySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<any>(null);

    const selectedCountry = countries.find(c => c.code === value);
    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelect = (code: string) => {
        onChange(code);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <View style={[styles.container, { zIndex: 999999, position: 'relative' as any }]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View ref={dropdownRef as any} style={{ position: 'relative' as any, zIndex: 999999 }}>
                <TouchableOpacity 
                    style={styles.trigger} 
                    onPress={() => setIsOpen(!isOpen)}
                    activeOpacity={0.7}
                >
                    <View style={styles.selectedContent}>
                        {selectedCountry ? (
                            <>
                                <Text style={styles.flag}>{selectedCountry.flag}</Text>
                                <Text style={styles.countryName}>{selectedCountry.name}</Text>
                            </>
                        ) : (
                            <Text style={styles.placeholder}>Select country...</Text>
                        )}
                    </View>
                    <ChevronDown size={18} color="#94a3b8" />
                </TouchableOpacity>

                {isOpen && (
                    <View style={styles.dropdown}>
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search countries..."
                                value={search}
                                onChangeText={setSearch}
                                autoFocus
                            />
                        </View>
                        <ScrollView style={styles.list} nestedScrollEnabled>
                            {filteredCountries.map(country => (
                                <TouchableOpacity
                                    key={country.code}
                                    style={[
                                        styles.option,
                                        country.code === value && styles.optionSelected
                                    ]}
                                    onPress={() => handleSelect(country.code)}
                                >
                                    <Text style={styles.optionFlag}>{country.flag}</Text>
                                    <Text style={styles.optionName}>{country.name}</Text>
                                    <Text style={styles.optionCode}>{country.code}</Text>
                                </TouchableOpacity>
                            ))}
                            {filteredCountries.length === 0 && (
                                <Text style={styles.noResults}>No countries found</Text>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        color: '#475569',
        marginBottom: 6,
        fontWeight: '600',
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        backgroundColor: '#F8FAFC',
        // @ts-ignore
        cursor: 'pointer',
    },
    selectedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    flag: {
        fontSize: 20,
    },
    countryName: {
        fontSize: 15,
        color: '#0f172a',
        fontWeight: '500',
    },
    placeholder: {
        fontSize: 15,
        color: '#94a3b8',
    },
    dropdown: {
        // @ts-ignore
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        // @ts-ignore
        boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
        zIndex: 999999,
        maxHeight: 300,
        // Force solid background
        opacity: 1,
    },
    searchContainer: {
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    searchInput: {
        padding: 8,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        // @ts-ignore
        outline: 'none',
    },
    list: {
        maxHeight: 240,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 14,
        gap: 10,
        backgroundColor: '#ffffff',
        // @ts-ignore
        cursor: 'pointer',
        ':hover': {
            backgroundColor: '#F8FAFC',
        },
    },
    optionSelected: {
        backgroundColor: '#EFF6FF',
    },
    optionFlag: {
        fontSize: 20,
    },
    optionName: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
    },
    optionCode: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    noResults: {
        padding: 16,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 14,
    },
});
