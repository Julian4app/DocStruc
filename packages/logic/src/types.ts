export type User = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
};

export type AppRole = 'owner' | 'builder' | 'trade' | 'viewer';

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  address?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: AppRole;
  joined_at?: string;
}

export interface Building {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}

export interface Floor {
  id: string;
  building_id: string;
  name: string;
  level_index: number;
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  type?: string;
  area_sqm?: number;
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  project_id: string;
  room_id?: string;
  creator_id: string;
  assigned_to?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string;
  planned_duration_minutes?: number;
  actual_duration_minutes?: number;
  created_at: string;
  images?: string[]; // Array of image URLs
}

