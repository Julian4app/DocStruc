import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { colors } from '@docstruc/theme';
import { 
  User, 
  Settings, 
  FileText, 
  LogOut, 
  MessageSquare, 
  HelpCircle,
  ChevronDown 
} from 'lucide-react';

interface ProfileDropdownProps {
  userName: string;
  userEmail: string;
  userAvatar?: string;
}

export function ProfileDropdown({ userName, userEmail, userAvatar }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const displayName = userName || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const menuItems = [
    { icon: User, label: 'Profil', path: '/profile' },
    { icon: Settings, label: 'Einstellungen', path: '/settings' },
    { 
      icon: FileText, 
      label: 'Rechtliches', 
      path: '#', 
      submenu: [
        { label: 'Datenschutz', path: '/datenschutz' },
        { label: 'Impressum', path: '/impressum' }
      ]
    },
    { icon: MessageSquare, label: 'Feedback', path: '/feedback' },
    { icon: HelpCircle, label: 'Hilfe Center', path: '/help' },
  ];

  return (
    <View ref={dropdownRef} style={{ position: 'relative' as any }}>
      <TouchableOpacity 
        style={styles.trigger} 
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
      >
        {userAvatar ? (
          <img 
            src={userAvatar} 
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              objectFit: 'cover' as any,
            }} 
            alt="Profile"
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
        </View>
        <ChevronDown 
          size={16} 
          color="#94a3b8" 
          style={{ 
            transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
            transition: 'transform 0.2s ease'
          } as any} 
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdown}>
          {/* User Info Header */}
          <View style={styles.dropdownHeader}>
            {userAvatar ? (
              <img 
                src={userAvatar} 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  objectFit: 'cover' as any,
                }} 
                alt="Profile"
              />
            ) : (
              <View style={[styles.avatar, { width: 48, height: 48 }]}>
                <Text style={[styles.avatarText, { fontSize: 18 }]}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.dropdownName}>{displayName}</Text>
              <Text style={styles.dropdownEmail}>{userEmail}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Menu Items */}
          <View style={styles.menuList}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              
              if (item.submenu) {
                return (
                  <View key={index}>
                    <View style={styles.menuItem}>
                      <Icon size={18} color="#64748b" strokeWidth={2} />
                      <Text style={styles.menuText}>{item.label}</Text>
                    </View>
                    <View style={styles.submenu}>
                      {item.submenu.map((subItem, subIndex) => (
                        <TouchableOpacity
                          key={subIndex}
                          style={styles.submenuItem}
                          onPress={() => handleNavigate(subItem.path)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.submenuText}>{subItem.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => handleNavigate(item.path)}
                  activeOpacity={0.7}
                >
                  <Icon size={18} color="#64748b" strokeWidth={2} />
                  <Text style={styles.menuText}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutItem}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={18} color="#ef4444" strokeWidth={2} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    cursor: 'pointer' as any,
    transition: 'background-color 0.2s ease' as any,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  emailText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dropdown: {
    position: 'absolute' as any,
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    zIndex: 10000,
    overflow: 'hidden' as any,
    elevation: 10000,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  dropdownEmail: {
    fontSize: 13,
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  menuList: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    cursor: 'pointer' as any,
    transition: 'background-color 0.15s ease' as any,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    flex: 1,
  },
  submenu: {
    paddingLeft: 46,
    paddingVertical: 4,
  },
  submenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    cursor: 'pointer' as any,
  },
  submenuText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    cursor: 'pointer' as any,
    transition: 'background-color 0.15s ease' as any,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});
