import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { ChevronDown } from 'lucide-react';

interface Country {
    code: string;
    name: string;
    flag: string;
    dialCode: string;
}

const countries: Country[] = [
    { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹', dialCode: '+43' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41' },
    { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
    { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪', dialCode: '+32' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱', dialCode: '+48' },
    { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dialCode: '+420' },
    { code: 'DK', name: 'Denmark', flag: '🇩🇰', dialCode: '+45' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47' },
    { code: 'FI', name: 'Finland', flag: '🇫🇮', dialCode: '+358' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹', dialCode: '+351' },
    { code: 'GR', name: 'Greece', flag: '🇬🇷', dialCode: '+30' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353' },
    { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dialCode: '+352' },
];

interface PhoneInputProps {
    label?: string;
    value: string;
    countryCode: string;
    onChangeText: (phone: string) => void;
    onCountryChange: (code: string) => void;
    placeholder?: string;
}

export function PhoneInput({ label, value, countryCode, onChangeText, onCountryChange, placeholder }: PhoneInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<any>(null);

    const selectedCountry = countries.find(c => c.code === countryCode) || countries[0];
    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search)
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

    const handleCountrySelect = (code: string) => {
        onCountryChange(code);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <View style={[styles.container, { zIndex: 999999, position: 'relative' as any }]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.inputRow}>
                {/* Country Code Selector */}
                <View ref={dropdownRef as any} style={{ position: 'relative' as any, zIndex: 999999 }}>
                    <TouchableOpacity 
                        style={styles.countryTrigger} 
                        onPress={() => setIsOpen(!isOpen)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.flag}>{selectedCountry.flag}</Text>
                        <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>

                    {isOpen && (
                        <View style={[styles.dropdown, { zIndex: 999999 }]}>
                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search..."
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
                                            country.code === countryCode && styles.optionSelected
                                        ]}
                                        onPress={() => handleCountrySelect(country.code)}
                                    >
                                        <Text style={styles.optionFlag}>{country.flag}</Text>
                                        <Text style={styles.optionName}>{country.name}</Text>
                                        <Text style={styles.optionDialCode}>{country.dialCode}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Phone Number Input */}
                <TextInput
                    style={styles.phoneInput}
                    placeholder={placeholder || 'Phone number'}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="phone-pad"
                />
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
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'stretch',
    },
    countryTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        minWidth: 100,
        // @ts-ignore
        cursor: 'pointer',
    },
    flag: {
        fontSize: 18,
    },
    dialCode: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: 14,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        color: '#0f172a',
        // @ts-ignore
        outline: 'none',
    },
    dropdown: {
        // @ts-ignore
        position: 'absolute',
        top: '100%',
        left: 0,
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
        minWidth: 250,
        opacity: 1,
    },
    searchContainer: {
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#ffffff',
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
        backgroundColor: '#ffffff',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        paddingHorizontal: 12,
        gap: 10,
        backgroundColor: '#ffffff',
        // @ts-ignore
        cursor: 'pointer',
    },
    optionSelected: {
        backgroundColor: '#EFF6FF',
    },
    optionFlag: {
        fontSize: 18,
    },
    optionName: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        fontWeight: '500',
    },
    optionDialCode: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
    },
});
