import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface StatusOption {
    value: string;
    label: string;
    color: string;
    bgColor: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
    { value: 'Angefragt', label: 'Angefragt', color: '#0ea5e9', bgColor: '#e0f2fe' },
    { value: 'In Planung', label: 'In Planung', color: '#8b5cf6', bgColor: '#f3e8ff' },
    { value: 'Genehmigt', label: 'Genehmigt', color: '#10b981', bgColor: '#d1fae5' },
    { value: 'In Ausführung', label: 'In Ausführung', color: '#f59e0b', bgColor: '#fef3c7' },
    { value: 'Abgeschlossen', label: 'Abgeschlossen', color: '#059669', bgColor: '#d1fae5' },
    { value: 'Pausiert', label: 'Pausiert', color: '#64748b', bgColor: '#f1f5f9' },
    { value: 'Abgebrochen', label: 'Abgebrochen', color: '#ef4444', bgColor: '#fee2e2' },
    { value: 'Nachbesserung', label: 'Nachbesserung', color: '#f97316', bgColor: '#ffedd5' },
];

interface StatusSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
}

export function StatusSelect({ label, value, onChange }: StatusSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<any>(null);
    const triggerRef = useRef<any>(null);
    const portalRef = useRef<HTMLDivElement | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    const selectedStatus = STATUS_OPTIONS.find(s => s.value === value) || STATUS_OPTIONS[0];

    useEffect(() => {
        if (typeof document === 'undefined') return;
        
        if (!portalRef.current) {
            portalRef.current = document.createElement('div');
            portalRef.current.id = 'status-select-portal';
        }
        
        if (isOpen) {
            document.body.appendChild(portalRef.current);
        }
        
        return () => {
            if (portalRef.current && document.body.contains(portalRef.current)) {
                document.body.removeChild(portalRef.current);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                triggerRef.current && !triggerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelect = (statusValue: string) => {
        onChange(statusValue);
        setIsOpen(false);
    };

    const dropdownContent = isOpen && portalRef.current ? createPortal(
        <View 
            ref={dropdownRef as any}
            style={[
                styles.dropdown,
                {
                    position: 'fixed' as any,
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    zIndex: 999999
                }
            ]}
        >
            <ScrollView style={styles.list} nestedScrollEnabled>
                {STATUS_OPTIONS.map(status => (
                    <TouchableOpacity
                        key={status.value}
                        style={[
                            styles.option,
                            status.value === value && styles.optionSelected
                        ]}
                        onPress={() => handleSelect(status.value)}
                    >
                        <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}>
                            <Text style={[styles.statusText, { color: status.color }]}>
                                {status.label}
                            </Text>
                        </View>
                        {status.value === value && <Check size={16} color={status.color} />}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>,
        portalRef.current
    ) : null;

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                    ref={triggerRef as any}
                    style={styles.trigger} 
                    onPress={() => setIsOpen(!isOpen)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statusPill, { backgroundColor: selectedStatus.bgColor }]}>
                        <Text style={[styles.statusText, { color: selectedStatus.color }]}>
                            {selectedStatus.label}
                        </Text>
                    </View>
                    <ChevronDown size={18} color="#94a3b8" />
                </TouchableOpacity>
                {dropdownContent}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    dropdownContainer: {
        position: 'relative' as any,
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
    statusPill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    dropdown: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        maxHeight: 320,
        overflow: 'hidden',
    },
    list: {
        maxHeight: 320,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        // @ts-ignore
        cursor: 'pointer',
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    optionSelected: {
        backgroundColor: '#F8FAFC',
    },
});
