import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BuildingWithFloors } from '@docstruc/api';
import { colors, spacing } from '@docstruc/theme';
import { Button } from './Button';
import { CustomModal } from './Modal';
import { Input } from './Input';

interface StructureListProps {
  structure: BuildingWithFloors[];
  onAddBuilding: (name: string) => void;
  onAddFloor: (buildingId: string, name: string) => void;
  onAddRoom: (floorId: string, name: string) => void;
  onRoomPress?: (room: any) => void;
  canEdit?: boolean;
}

export function StructureList({ structure, onAddBuilding, onAddFloor, onAddRoom, onRoomPress, canEdit = true }: StructureListProps) {
  const [addingType, setAddingType] = useState<'building' | 'floor' | 'room' | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>({});

  const toggleBuilding = (id: string) => {
    setExpandedBuildings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFloor = (id: string) => {
    setExpandedFloors(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddStart = (type: 'building' | 'floor' | 'room', id: string | null) => {
    setAddingType(type);
    setParentId(id);
    setNewItemName('');
  };

  const handleSave = () => {
    if (!newItemName.trim()) return;
    
    if (addingType === 'building') {
      onAddBuilding(newItemName);
    } else if (addingType === 'floor' && parentId) {
      onAddFloor(parentId, newItemName);
    } else if (addingType === 'room' && parentId) {
      onAddRoom(parentId, newItemName);
    }
    
    setAddingType(null);
    setParentId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gebäudeübersicht</Text>
        {canEdit && <Button variant="outline" onClick={() => handleAddStart('building', null)}>+ Gebäude</Button>}
      </View>

      {structure.map((building) => (
        <View key={building.id} style={styles.buildingItem}>
          <TouchableOpacity onPress={() => toggleBuilding(building.id)} style={styles.row}>
             <Text style={styles.icon}>{expandedBuildings[building.id] ? '🏢' : '🏬'}</Text>
             <Text style={styles.buildingName}>{building.name}</Text>
             <Text style={styles.expandIcon}>{expandedBuildings[building.id] ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {expandedBuildings[building.id] && (
            <View style={styles.floorsContainer}>
              {building.floors.map((floor) => (
                <View key={floor.id} style={styles.floorItem}>
                   <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.row}>
                      <Text style={styles.icon}>📑</Text>
                      <Text style={styles.floorName}>{floor.name}</Text>
                      <Text style={styles.expandIcon}>{expandedFloors[floor.id] ? '▼' : '▶'}</Text>
                   </TouchableOpacity>

                   {expandedFloors[floor.id] && (
                     <View style={styles.roomsContainer}>
                        {floor.rooms.map((room) => (
                          <TouchableOpacity 
                            key={room.id} 
                            style={styles.roomItem}
                            onPress={() => onRoomPress && onRoomPress(room)}
                          >
                             <Text style={styles.icon}>🚪</Text>
                             <Text style={styles.roomName}>{room.name}</Text>
                             {onRoomPress && <Text style={styles.expandIcon}>›</Text>}
                          </TouchableOpacity>
                        ))}
                        {canEdit && (
                          <TouchableOpacity style={styles.addButton} onPress={() => handleAddStart('room', floor.id)}>
                             <Text style={styles.addButtonText}>+ Raum hinzufügen</Text>
                          </TouchableOpacity>
                        )}
                     </View>
                   )}
                </View>
              ))}
              {canEdit && (
                <TouchableOpacity style={styles.addButton} onPress={() => handleAddStart('floor', building.id)}>
                    <Text style={styles.addButtonText}>+ Geschoss hinzufügen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      {structure.length === 0 && (
        <Text style={styles.emptyText}>Keine Gebäude vorhanden.</Text>
      )}

      <CustomModal
        visible={!!addingType}
        onClose={() => setAddingType(null)}
        title={
          addingType === 'building' ? 'Neues Gebäude' :
          addingType === 'floor' ? 'Neues Geschoss' : 'Neuer Raum'
        }
      >
        <Input 
          label="Bezeichnung" 
          value={newItemName} 
          onChangeText={setNewItemName}
          placeholder="z.B. Haupthaus, Erdgeschoss, Küche..." 
        />
        <View style={{ marginTop: 20 }}>
          <Button onClick={handleSave}>Speichern</Button>
        </View>
      </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  buildingItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.s,
    marginBottom: spacing.s,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floorsContainer: {
    paddingLeft: spacing.l,
    paddingTop: spacing.s,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginLeft: 10,
  },
  floorItem: {
    marginBottom: spacing.s,
  },
  roomsContainer: {
    paddingLeft: spacing.l,
    paddingTop: spacing.s,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    marginLeft: 8,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  icon: {
    marginRight: 8,
    fontSize: 16,
  },
  buildingName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  floorName: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  roomName: {
    fontSize: 14,
    color: colors.text,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  addButton: {
    paddingVertical: 8,
    marginTop: 4,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  }
});
