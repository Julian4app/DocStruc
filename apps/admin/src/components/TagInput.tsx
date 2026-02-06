import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';
import { X, Plus, Check } from 'lucide-react';

interface TagInputProps {
    value: string[]; // Array of tag titles
    onChange: (tags: string[]) => void;
    availableTags?: any[]; // List of { title, color } from DB
    placeholder?: string;
    readonly?: boolean;
    onTagCreated?: () => void; // Callback to refresh available tags parent
}

export function TagInput({ value = [], onChange, availableTags = [], placeholder = "Add tags...", readonly = false, onTagCreated }: TagInputProps) {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [newTagColor, setNewTagColor] = useState('#EF4444'); // Default red or random
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Create Tag Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingTag, setPendingTag] = useState('');

    useEffect(() => {
        if (!readonly) {
            let filtered = availableTags;
            if (input.trim()) {
                filtered = filtered.filter(t => 
                    t.title.toLowerCase().includes(input.toLowerCase())
                );
            }
            // Exclude already selected
            filtered = filtered.filter(t => !value.includes(t.title));
            
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [input, availableTags, value, readonly]);

    const handleOpenCreateModal = () => {
        setPendingTag(input); // Use current input if any
        setNewTagColor('#3B82F6');
        setShowCreateModal(true);
        setShowDropdown(false);
    };
    
    const handleAdd = async (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !value.includes(trimmed)) {
            // Check if tag exists in the known list
            const exists = availableTags.some(t => t.title.toLowerCase() === trimmed.toLowerCase());
            
            if (!exists && !readonly) {
                // Open Modal for creation
                handleOpenCreateModal();
            } else {
                onChange([...value, trimmed]);
            }
        }
        setInput('');
        setShowDropdown(false);
    };

    const confirmCreateTag = async () => {
        try {
            const { error } = await supabase.from('tags').insert([{
                title: pendingTag,
                color: newTagColor
            }]);
            
            if (error) throw error;

            // Add to selection
            onChange([...value, pendingTag]);
            
            // Close modal
            setShowCreateModal(false);
            setPendingTag('');
            
            // Notify parent to refetch availableTags so color shows up correctly next time
            if (onTagCreated) onTagCreated();
            
        } catch (e) {
            console.error('Error creating tag', e);
            alert('Failed to create tag');
        }
    };

    const handleRemove = (tag: string) => {
        if (readonly) return;
        onChange(value.filter(t => t !== tag));
    };

    const getColor = (tagTitle: string) => {
        const found = availableTags.find(t => t.title === tagTitle);
        return found?.color || '#cbd5e1'; // Default slate-300
    };

    const getTextColor = (bgColor: string) => {
        // Just return dark for now as we use light transparent bgs often, or check luminance
        return '#1e293b';
    };

    const PRESET_COLORS = [
        '#ef4444', '#f97316', '#f59e0b', '#10b981', '#38bdf8', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
    ];

    return (
        <View style={styles.container}>
            <View style={styles.chipsRow}>
                {value.map(tag => (
                    <View key={tag} style={[styles.chip, { backgroundColor: getColor(tag), opacity: 0.9 }]}>
                        <Text style={[styles.chipText, { color: 'white', textShadowColor: 'rgba(0,0,0,0.1)', textShadowRadius: 1 }]}>{tag}</Text>
                        {!readonly && (
                            <TouchableOpacity onPress={() => handleRemove(tag)} style={styles.removeBtn}>
                                <X size={12} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
            
            {!readonly && (
            <View style={{ position: 'relative', zIndex: 10 }}>
                <View style={styles.inputContainer}>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            style={styles.input}
                            value={input}
                            onChangeText={setInput}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Delay to allow click
                            onSubmitEditing={() => handleAdd(input)}
                            placeholder={placeholder}
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                    <TouchableOpacity 
                        style={styles.addButton} 
                        onPress={handleOpenCreateModal}
                    >
                        <Plus size={18} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {showDropdown && (suggestions.length > 0 || input.trim().length > 0) && (
                    <View style={styles.suggestionsBox}>
                        {suggestions.map(s => (
                            <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => handleAdd(s.title)}>
                                <View style={[styles.dot, { backgroundColor: s.color }]} />
                                <Text style={styles.suggestionText}>{s.title}</Text>
                            </TouchableOpacity>
                        ))}
                        {input.trim().length > 0 && !suggestions.find(s => s.title.toLowerCase() === input.toLowerCase()) && (
                             <TouchableOpacity style={styles.suggestionItem} onPress={() => handleOpenCreateModal()}>
                                <Plus size={14} color="#3b82f6" />
                                <Text style={{ color: '#3b82f6', fontWeight: '600', marginLeft: 6 }}>Create "{input}"</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
            )}

            {/* Create Tag Modal */}
            <CustomModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="New Tag"
            >
                <View style={{ gap: 20, padding: 8 }}>
                    <View style={{ gap: 8 }}>
                        <Text style={styles.modalLabel}>Tag Title</Text>
                        <Input value={pendingTag} onChangeText={setPendingTag} placeholder="e.g. Urgent" />
                    </View>
                    
                    <View style={{ gap: 12 }}>
                        <Text style={styles.modalLabel}>Select Color</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {PRESET_COLORS.map(c => (
                                <TouchableOpacity 
                                    key={c}
                                    onPress={() => setNewTagColor(c)}
                                    style={{
                                        width: 36, height: 36, borderRadius: 18, backgroundColor: c,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: newTagColor === c ? 'white' : 'transparent',
                                        shadowColor: newTagColor === c ? '#000' : 'transparent',
                                        shadowOpacity: 0.3,
                                        shadowRadius: 4,
                                        elevation: newTagColor === c ? 4 : 0
                                    }} 
                                >
                                    {newTagColor === c && <Check size={16} color="white" strokeWidth={3} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                            <Text style={{ fontSize: 13, color: '#64748b' }}>Custom Hex:</Text>
                            <Input 
                                value={newTagColor} 
                                onChangeText={setNewTagColor} 
                                placeholder="#000000" 
                                style={{ height: 36, width: 100, fontSize: 13 }}
                            />
                        </View>
                    </View>

                    <Button onClick={confirmCreateTag} variant="primary" style={{ marginTop: 8 }}>
                        Create Tag
                    </Button>
                </View>
            </CustomModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 6,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 }
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600'
    },
    removeBtn: {
        padding: 2,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    inputContainer: {
        flexDirection: 'row', 
        gap: 8,
        alignItems: 'center'
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        backgroundColor: 'white',
        color: '#1e293b'
    },
    addButton: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        backgroundColor: 'white'
    },
    suggestionsBox: {
        position: 'absolute',
        top: '120%', // slightly lower
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        maxHeight: 220,
        overflow: 'scroll', 
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 50,
        paddingVertical: 4
    },
    suggestionItem: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    suggestionText: {
        color: '#1e293b',
        fontSize: 14
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 4
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600', 
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    }
});
