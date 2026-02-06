import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';

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
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Create Tag Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingTag, setPendingTag] = useState('');
    const [newTagColor, setNewTagColor] = useState('#EF4444'); // Default red or random

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
        return found?.color || '#E5E7EB'; // Default gray
    };

    const getTextColor = (bgColor: string) => {
        // Simple check for light/dark bg could go here, for now default to dark text unless extremely dark
        return '#374151';
    };

    const PRESET_COLORS = [
        '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'
    ];

    return (
        <View style={styles.container}>
            <View style={styles.chipsRow}>
                {value.map(tag => (
                    <View key={tag} style={[styles.chip, { backgroundColor: getColor(tag) }]}>
                        <Text style={[styles.chipText, { color: getTextColor(getColor(tag)) }]}>{tag}</Text>
                        {!readonly && (
                            <TouchableOpacity onPress={() => handleRemove(tag)}>
                                <Text style={styles.chipRemove}>×</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
            
            {!readonly && (
            <View style={{ position: 'relative', zIndex: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput
                            style={styles.input}
                            value={input}
                            onChangeText={setInput}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Delay to allow click
                            onSubmitEditing={() => handleAdd(input)}
                            placeholder={placeholder}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                    <TouchableOpacity 
                        style={styles.addButton} 
                        onPress={handleOpenCreateModal}
                        title="Create new tag"
                    >
                        <Text style={{ fontSize: 20, color: '#6B7280', fontWeight: 'bold' }}>+</Text>
                    </TouchableOpacity>
                </View>

                {showDropdown && (suggestions.length > 0 || input.trim().length > 0) && (
                    <View style={styles.suggestionsBox}>
                        {suggestions.map(s => (
                            <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => handleAdd(s.title)}>
                                <View style={[styles.dot, { backgroundColor: s.color }]} />
                                <Text>{s.title}</Text>
                            </TouchableOpacity>
                        ))}
                        {input.trim().length > 0 && !suggestions.find(s => s.title.toLowerCase() === input.toLowerCase()) && (
                             <TouchableOpacity style={styles.suggestionItem} onPress={() => handleOpenCreateModal()}>
                                <Text style={{ color: '#3B82F6', fontWeight: '500' }}>+ Create "{input}"</Text>
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
                title="Create New Tag"
            >
                <View style={{ gap: 16, padding: 16 }}>
                    <View style={{ gap: 8 }}>
                        <Text style={styles.modalLabel}>Tag Title</Text>
                        <Input value={pendingTag} onChangeText={setPendingTag} />
                    </View>
                    
                    <View style={{ gap: 8 }}>
                        <Text style={styles.modalLabel}>Select Color</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {PRESET_COLORS.map(c => (
                                <TouchableOpacity 
                                    key={c}
                                    onPress={() => setNewTagColor(c)}
                                    style={{
                                        width: 32, height: 32, borderRadius: 16, backgroundColor: c,
                                        borderWidth: newTagColor === c ? 2 : 0, borderColor: '#111827'
                                    }} 
                                />
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 12 }}>Or Hex:</Text>
                            <Input 
                                value={newTagColor} 
                                onChangeText={setNewTagColor} 
                                placeholder="#000000" 
                                style={{ height: 36, width: 100 }}
                            />
                        </View>
                    </View>

                    <Button onClick={confirmCreateTag} variant="primary" style={{ marginTop: 8 }}>
                        Create & Add Tag
                    </Button>
                </View>
            </CustomModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 8
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 6
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500'
    },
    chipRemove: {
        fontSize: 16,
        fontWeight: 'bold',
        opacity: 0.6
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        backgroundColor: 'white'
    },
    addButton: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#F9FAFB'
    },
    suggestionsBox: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 200,
        overflow: 'scroll', // Allow vertical scrolling
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        zIndex: 50
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '500', 
        color: '#374151'
    }
});
