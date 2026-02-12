import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePicker({ label, value, onChange, placeholder = 'TT.MM.JJJJ', disabled = false }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split('-');
      return new Date(parseInt(year), parseInt(month) - 1);
    }
    return new Date();
  });

  const formatDateToDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  const formatDateToValue = (displayStr: string) => {
    const match = displayStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return displayStr;
  };

  const handleInputChange = (text: string) => {
    // Allow typing in DD.MM.YYYY format
    onChange(formatDateToValue(text));
  };

  const handleDateSelect = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Adjust so Monday is 0
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth();
  const days = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
  }
  
  // Add days of month
  const today = new Date();
  const selectedDate = value ? new Date(value) : null;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
    
    days.push(
      <TouchableOpacity
        key={day}
        style={[
          styles.calendarDay,
          isToday && styles.calendarDayToday,
          isSelected && styles.calendarDaySelected
        ]}
        onPress={() => handleDateSelect(day)}
      >
        <Text style={[
          styles.calendarDayText,
          isToday && styles.calendarDayTextToday,
          isSelected && styles.calendarDayTextSelected
        ]}>
          {day}
        </Text>
      </TouchableOpacity>
    );
  }

  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, disabled && styles.disabled]}
          value={value ? formatDateToDisplay(value) : ''}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          editable={!disabled}
        />
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => !disabled && setIsOpen(true)}
          disabled={disabled}
        >
          <Calendar size={18} color={disabled ? '#94a3b8' : colors.primary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsOpen(false)}
        >
          <TouchableOpacity 
            style={styles.calendarModal} 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                style={styles.navButton}
              >
                <ChevronLeft size={20} color={colors.primary} />
              </TouchableOpacity>
              
              <Text style={styles.monthYearText}>
                {currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </Text>
              
              <TouchableOpacity
                onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                style={styles.navButton}
              >
                <ChevronRight size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Weekdays */}
            <View style={styles.weekdaysRow}>
              {weekdays.map(day => (
                <View key={day} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {days}
            </View>

            {/* Today Button */}
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => {
                const today = new Date();
                handleDateSelect(today.getDate());
                setCurrentMonth(today);
              }}
            >
              <Text style={styles.todayButtonText}>Heute</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    paddingRight: 48,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  disabled: {
    backgroundColor: '#F8FAFC',
    color: '#94a3b8',
  },
  calendarButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  calendarModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calendarDay: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  calendarDayToday: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#0f172a',
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todayButton: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
