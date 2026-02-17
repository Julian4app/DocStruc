/**
 * Explicit column lists for Supabase queries.
 * 
 * Using explicit columns instead of SELECT * provides:
 * - Reduced bandwidth (don't transfer unused columns)
 * - Better type safety  
 * - Protection against schema changes breaking queries
 * - Faster query execution with less I/O
 */

// Core project tables
export const COLS = {
  // Projects
  projects: 'id, owner_id, name, description, address, status, created_at, updated_at, subtitle, picture_url, detailed_address, start_date, target_end_date',
  projectsList: 'id, owner_id, name, status, created_at, picture_url, address',

  // Tasks
  tasks: 'id, project_id, room_id, creator_id, assigned_to, title, description, status, due_date, planned_duration_minutes, actual_duration_minutes, created_at, updated_at, images, task_type, priority',
  tasksList: 'id, project_id, creator_id, assigned_to, title, status, due_date, priority, created_at, task_type',

  // Project Members
  projectMembers: 'id, project_id, user_id, role, invited_at, joined_at, status, role_id',
  projectMembersWithProfile: `user_id, role, status, role_id, profiles:user_id(id, email, first_name, last_name, avatar_url)`,

  // Structure
  buildings: 'id, project_id, name, created_at',
  floors: 'id, building_id, name, level_index',
  rooms: 'id, floor_id, name, type, area_sqm',

  // Task sub-tables
  taskImages: 'id, task_id, image_url, display_order, created_at',
  taskDocumentation: 'id, task_id, user_id, type, content, created_at',

  // CRM / Admin
  companies: 'id, name, address, contact_person_id, status, employees_count, bought_accounts, superuser_id, logo_url, email, tax_id, created_at, updated_at',
  companiesList: 'id, name, status, employees_count, logo_url, email, created_at',
  
  crmContacts: 'id, type, first_name, last_name, email, phone, avatar_url, personal_number, detailed_address, notes, linked_user_id, created_at, updated_at',
  crmContactsList: 'id, type, first_name, last_name, email, phone, avatar_url',

  contactPersons: 'id, first_name, surname, company, department, email, created_at, updated_at',

  subcontractors: 'id, company_name, name, first_name, last_name, phone, notes, detailed_address, profile_picture_url, trade, street, zip, city, country, website, logo_url, created_at',
  subcontractorsList: 'id, company_name, name, trade, phone, logo_url',

  subcontractorContacts: 'id, subcontractor_id, first_name, last_name, email, phone, department, notes, created_at',

  // Notes, Files, Subscriptions
  crmNotes: 'id, company_id, content, created_by, created_at, updated_at',
  companyFiles: 'id, company_id, file_url, file_name, uploaded_at, tags',
  companySubscriptions: 'id, company_id, subscription_type_id, payment_cycle, payment_deadline_days, recipes_url, start_date, end_date, invoice_amount, status, created_at',
  subscriptionTypes: 'id, title, price, currency, discount, features, description, created_at',

  // Invoices
  invoices: 'id, subscription_id, company_id, amount, due_date, paid_at, status, period_start, period_end, created_at, notes, tags',

  // Tags
  tags: 'id, title, color, description, created_at',

  // History
  companyHistory: 'id, company_id, action, old_state, new_state, changed_by, created_at',

  // Feedback
  feedback: 'id, user_id, content, created_at',

  // Profiles
  profiles: 'id, email, first_name, last_name, company_name, avatar_url, phone, is_superuser, team_id, team_role',
  profilesMinimal: 'id, email, first_name, last_name, avatar_url',

  // Teams
  teams: 'id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at',
  teamInvitations: 'id, team_id, email, team_role, invited_by, token, status, invited_at, accepted_at',

  // Timeline
  timelineEvents: 'id, project_id, title, description, start_date, end_date, status, event_type, color, created_at',

  // Notifications
  notifications: 'id, user_id, type, title, body, data, read, created_at',

  // Project Files
  projectFolders: 'id, project_id, name, description, parent_folder_id, created_by, created_at',
  projectFiles: 'id, project_id, folder_id, file_name, file_url, file_size, mime_type, uploaded_by, created_at, updated_at',

  // Diary
  diaryEntries: 'id, project_id, user_id, content, weather, temperature, created_at, updated_at',

  // Reports
  projectReports: 'id, project_id, title, content, report_type, created_by, created_at',
} as const;
