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
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');

  if (buildingsError || !buildings) throw buildingsError || new Error('No buildings found');

  // 2. Get Floors for these buildings
  const buildingIds = buildings.map(b => b.id);
  // If no buildings, return empty
  if (buildingIds.length === 0) return [];

  const { data: floors, error: floorsError } = await client
    .from('floors')
    .select('*')
    .in('building_id', buildingIds)
    .order('level_index');
  
  if (floorsError || !floors) throw floorsError;

  // 3. Get Rooms for these floors
  const floorIds = floors.map(f => f.id);
  let rooms: Room[] = [];
  if (floorIds.length > 0) {
    const { data: roomsData, error: roomsError } = await client
      .from('rooms')
      .select('*')
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
