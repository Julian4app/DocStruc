import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = (command: string, value: string | boolean = false) => {
    // Save current selection
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    document.execCommand(command, false, value as string);
    
    // Restore selection
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    editorRef.current?.focus();
    handleInput();
  };

  const buttons = [
    { icon: Bold, command: 'bold', label: 'Fett' },
    { icon: Italic, command: 'italic', label: 'Kursiv' },
    { icon: Underline, command: 'underline', label: 'Unterstrichen' },
    { icon: AlignLeft, command: 'justifyLeft', label: 'Linksbündig' },
    { icon: AlignCenter, command: 'justifyCenter', label: 'Zentriert' },
    { icon: AlignRight, command: 'justifyRight', label: 'Rechtsbündig' },
    { icon: List, command: 'insertUnorderedList', label: 'Aufzählung' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>Poppins</Text>
        <View style={styles.separator} />
        <Text style={styles.toolbarLabel}>14px</Text>
        <View style={styles.separator} />
        
        <View style={styles.colorPicker}>
          <View style={[styles.colorCircle, { backgroundColor: colors.primary }]} />
        </View>
        
        <View style={styles.separator} />
        
        {buttons.map((btn, index) => {
          const Icon = btn.icon;
          return (
            <button
              key={index}
              type="button"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent losing focus
                execCommand(btn.command);
              }}
              disabled={disabled}
            >
              <Icon size={18} color={disabled ? '#94A3B8' : '#475569'} />
            </button>
          );
        })}
        
        <View style={styles.separator} />
        
        <TouchableOpacity style={styles.toolbarButton} disabled={disabled}>
          <Text style={styles.moreIcon}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.editorContainer}>
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onBlur={handleInput}
          style={{
            minHeight: '200px',
            padding: '16px',
            outline: 'none',
            fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#0f172a',
          }}
          data-placeholder={placeholder}
          className="rich-text-editor"
        />
      </ScrollView>

      <style>{`
        .rich-text-editor:empty:before {
          content: attr(data-placeholder);
          color: #94A3B8;
          pointer-events: none;
        }
        .rich-text-editor p {
          margin: 0 0 8px 0;
        }
        .rich-text-editor ul {
          margin: 8px 0;
          padding-left: 24px;
        }
        .rich-text-editor li {
          margin: 4px 0;
        }
      `}</style>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  toolbarLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  colorPicker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  toolbarButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  moreIcon: {
    fontSize: 20,
    color: '#475569',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  editorContainer: {
    minHeight: 200,
    maxHeight: 400,
    backgroundColor: '#fff',
  },
});
