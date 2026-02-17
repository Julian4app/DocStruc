import { SupabaseClient } from '@supabase/supabase-js';
import { Building, Floor, Room } from '@docstruc/logic';

export interface FloorWithRooms extends Floor {
  rooms: Room[];
}

export interface BuildingWithFloors extends Building {
  floors: FloorWithRooms[];
}

export const getProjectStructure = async (client: SupabaseClient, projectId: string): Promise<BuildingWithFloors[]> => {
  // 1. Get Buildings
  const { data: buildings, error: buildingsError } = await client
    .from('buildings')
    .select('id, project_id, name, created_at')
    .eq('project_id', projectId)
    .order('created_at');

  if (buildingsError || !buildings) throw buildingsError || new Error('No buildings found');

  // 2. Get Floors for these buildings
  const buildingIds = buildings.map(b => b.id);
  // If no buildings, return empty
  if (buildingIds.length === 0) return [];

  const { data: floors, error: floorsError } = await client
    .from('floors')
    .select('id, building_id, name, level_index')
    .in('building_id', buildingIds)
    .order('level_index');
  
  if (floorsError || !floors) throw floorsError;

  // 3. Get Rooms for these floors
  const floorIds = floors.map(f => f.id);
  let rooms: Room[] = [];
  if (floorIds.length > 0) {
    const { data: roomsData, error: roomsError } = await client
      .from('rooms')
      .select('id, floor_id, name, type, area_sqm')
      .in('floor_id', floorIds)
      .order('name');
    
    if (roomsError) throw roomsError;
    rooms = roomsData || [];
  }

  // 4. Assemble Tree
  const structure = buildings.map(building => {
    const buildingFloors = floors
      .filter(f => f.building_id === building.id)
      .map(floor => ({
        ...floor,
        rooms: rooms.filter(r => r.floor_id === floor.id)
      }));
    
    return {
      ...building,
      floors: buildingFloors
    };
  });

  return structure;
};

export const createBuilding = async (client: SupabaseClient, projectId: string, name: string) => {
  return client.from('buildings').insert({ project_id: projectId, name }).select().single();
};

export const createFloor = async (client: SupabaseClient, buildingId: string, name: string, levelIndex: number) => {
  return client.from('floors').insert({ building_id: buildingId, name, level_index: levelIndex }).select().single();
};

export const createRoom = async (client: SupabaseClient, floorId: string, name: string, type: string = 'generic') => {
  return client.from('rooms').insert({ floor_id: floorId, name, type }).select().single();
};

export const getRoomComponents = async (client: SupabaseClient, roomId: string): Promise<any[]> => {
  const { data, error } = await client
    .from('room_components')
    .select('id, room_id, name, type, description, status, created_at')
    .eq('room_id', roomId)
    .order('created_at');

  if (error) throw error;
  return data || [];
};

export const createRoomComponent = async (client: SupabaseClient, roomId: string, name: string, type: string) => {
  const { data, error } = await client
    .from('room_components')
    .insert([{ room_id: roomId, name, type }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export interface TimelineEvent {
  id: string;
  project_id: string;
  title: string;
  event_date: string;
  eventType: 'milestone' | 'deadline' | 'meeting' | 'delivery';
  completed: boolean;
}

export const getProjectTimeline = async (client: SupabaseClient, projectId: string): Promise<TimelineEvent[]> => {
  const { data, error } = await client
    .from('project_timeline')
    .select('id, project_id, title, event_date, eventType, completed')
    .eq('project_id', projectId)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createTimelineEvent = async (client: SupabaseClient, event: Omit<TimelineEvent, 'id' | 'completed'>) => {
  return await client.from('project_timeline').insert(event);
};

export const toggleTimelineEvent = async (client: SupabaseClient, id: string, completed: boolean) => {
  return await client.from('project_timeline').update({ completed }).eq('id', id);
};
