-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- USERS (managed by Supabase Auth, but we often need a public profile table)
-- We will just use the auth.users table for auth, and create a public.profiles table for app data.
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  first_name text,
  last_name text,
  company_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- PROJECTS
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) not null,
  name text not null,
  description text,
  address text,
  status text check (status in ('planning', 'active', 'completed', 'archived')) default 'planning',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

-- PROJECT MEMBERS & ROLES
create type public.app_role as enum ('owner', 'builder', 'trade', 'viewer');

create table public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  role public.app_role not null default 'viewer',
  invited_at timestamptz default now(),
  joined_at timestamptz,
  unique(project_id, user_id)
);

alter table public.project_members enable row level security;

-- BUILDINGS / STRUCTURE
create table public.buildings (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null, -- e.g. "Main House", "Garage"
  created_at timestamptz default now()
);

alter table public.buildings enable row level security;

create table public.floors (
  id uuid default uuid_generate_v4() primary key,
  building_id uuid references public.buildings(id) on delete cascade not null,
  name text not null, -- e.g. "Ground Floor", "1st Floor"
  level_index int not null default 0
);

alter table public.floors enable row level security;

create table public.rooms (
  id uuid default uuid_generate_v4() primary key,
  floor_id uuid references public.floors(id) on delete cascade not null,
  name text not null, -- e.g. "Kitchen", "Living Room"
  type text, -- e.g. "kitchen", "bedroom", "bath"
  area_sqm numeric
);

alter table public.rooms enable row level security;

-- TASKS / MEASURES (Maßnahmen)
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  room_id uuid references public.rooms(id), -- optional, task might be general
  creator_id uuid references public.profiles(id) not null,
  assigned_to uuid references public.profiles(id),
  title text not null,
  description text,
  status text check (status in ('open', 'in_progress', 'done', 'blocked')) default 'open',
  due_date timestamptz,
  planned_duration_minutes int,
  actual_duration_minutes int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

-- RLS POLICIES (Simplified for initial setup)

-- Projects: Owner can do everything. Members can view.
create policy "Project members can view project" on public.projects
  for select using (
    auth.uid() = owner_id or 
    exists (select 1 from public.project_members where project_id = public.projects.id and user_id = auth.uid())
  );

create policy "Owners can update project" on public.projects
  for update using (auth.uid() = owner_id);

create policy "Owners can delete project" on public.projects
  for delete using (auth.uid() = owner_id);

create policy "Users can create projects" on public.projects
  for insert with check (auth.uid() = owner_id);


-- Project Members:
create policy "Project members can view other members" on public.project_members
  for select using (
    exists (
      select 1 from public.project_members pm 
      where pm.project_id = public.project_members.project_id 
      and pm.user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.projects p
      where p.id = public.project_members.project_id
      and p.owner_id = auth.uid()
    )
  );

-- Helper function to check project access
create or replace function public.has_project_access(p_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.projects where id = p_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members where project_id = p_id and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Tasks:
create policy "Project members can view tasks" on public.tasks
  for select using (public.has_project_access(project_id));

create policy "Project members can create tasks" on public.tasks
  for insert with check (public.has_project_access(project_id));

create policy "Task creator or assignee or owner can update task" on public.tasks
  for update using (
    creator_id = auth.uid() or 
    assigned_to = auth.uid() or
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );

