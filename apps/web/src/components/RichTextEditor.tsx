import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Heading1, Heading2, Heading3, Strikethrough, Link } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedFont, setSelectedFont] = React.useState('Poppins');
  const [selectedSize, setSelectedSize] = React.useState('14px');
  const [selectedColor, setSelectedColor] = React.useState('#2563eb');
  const [showColorPicker, setShowColorPicker] = React.useState(false);

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

  const createLink = () => {
    const url = prompt('URL eingeben:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertHeading = (level: number) => {
    execCommand('formatBlock', `h${level}`);
  };

  const changeFontFamily = (font: string) => {
    setSelectedFont(font);
    execCommand('fontName', font);
  };

  const changeFontSize = (size: string) => {
    setSelectedSize(size);
    // Convert px to font size number (1-7)
    const sizeMap: {[key: string]: string} = {
      '12px': '2',
      '14px': '3',
      '16px': '4',
      '18px': '5',
      '20px': '6',
      '24px': '7'
    };
    execCommand('fontSize', sizeMap[size] || '3');
  };

  const changeColor = (color: string) => {
    setSelectedColor(color);
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const buttons = [
    { icon: Bold, command: 'bold', label: 'Fett' },
    { icon: Italic, command: 'italic', label: 'Kursiv' },
    { icon: Underline, command: 'underline', label: 'Unterstrichen' },
    { icon: Strikethrough, command: 'strikeThrough', label: 'Durchgestrichen' },
    { icon: List, command: 'insertUnorderedList', label: 'Aufzählung' },
    { icon: ListOrdered, command: 'insertOrderedList', label: 'Nummerierung' },
    { icon: Heading1, command: 'h1', label: 'Überschrift 1' },
    { icon: Heading2, command: 'h2', label: 'Überschrift 2' },
    { icon: Heading3, command: 'h3', label: 'Überschrift 3' },
    { icon: AlignLeft, command: 'justifyLeft', label: 'Linksbündig' },
    { icon: AlignCenter, command: 'justifyCenter', label: 'Zentriert' },
    { icon: AlignRight, command: 'justifyRight', label: 'Rechtsbündig' },
    { icon: Link, command: 'link', label: 'Link einfügen' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <select 
          value={selectedFont}
          onChange={(e) => changeFontFamily(e.target.value)}
          disabled={disabled}
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            fontWeight: '500',
            color: '#475569',
            backgroundColor: '#fff',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="Poppins">Poppins</option>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times</option>
          <option value="Courier New">Courier</option>
          <option value="Georgia">Georgia</option>
        </select>
        <View style={styles.separator} />
        <select
          value={selectedSize}
          onChange={(e) => changeFontSize(e.target.value)}
          disabled={disabled}
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            fontWeight: '500',
            color: '#475569',
            backgroundColor: '#fff',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
        </select>
        <View style={styles.separator} />
        
        <div style={{ position: 'relative' }}>
          <TouchableOpacity 
            style={styles.colorPicker}
            onPress={() => setShowColorPicker(!showColorPicker)}
            disabled={disabled}
          >
            <View style={[styles.colorCircle, { backgroundColor: selectedColor }]} />
          </TouchableOpacity>
          {showColorPicker && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1000,
              backgroundColor: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 32px)',
              gap: 4,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              {['#000000', '#DC2626', '#EA580C', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#2563eb', '#7C3AED', '#DB2777', '#64748b', '#ffffff'].map(color => (
                <button
                  key={color}
                  onClick={() => changeColor(color)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: '2px solid #E2E8F0',
                    backgroundColor: color,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>
        
        <View style={styles.separator} />
        
        {buttons.map((btn, index) => {
          const Icon = btn.icon;
          return (
            <button
              key={index}
              type="button"
              title={btn.label}
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
                transition: 'background-color 0.2s',
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent losing focus
                if (btn.command === 'link') {
                  createLink();
                } else if (btn.command === 'h1') {
                  insertHeading(1);
                } else if (btn.command === 'h2') {
                  insertHeading(2);
                } else if (btn.command === 'h3') {
                  insertHeading(3);
                } else {
                  execCommand(btn.command);
                }
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.backgroundColor = '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
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
        .rich-text-editor h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 16px 0 8px 0;
          color: #0f172a;
        }
        .rich-text-editor h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 14px 0 6px 0;
          color: #0f172a;
        }
        .rich-text-editor h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 12px 0 6px 0;
          color: #0f172a;
        }
        .rich-text-editor ul, .rich-text-editor ol {
          margin: 8px 0;
          padding-left: 24px;
        }
        .rich-text-editor li {
          margin: 4px 0;
        }
        .rich-text-editor a {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        .rich-text-editor a:hover {
          color: #1d4ed8;
        }
        .rich-text-editor strike,
        .rich-text-editor s {
          text-decoration: line-through;
          opacity: 0.7;
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
