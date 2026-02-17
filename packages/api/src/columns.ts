/**
 * Explicit column lists for Supabase queries.
 * 
 * Using explicit columns instead of SELECT * provides:
 * - Reduced bandwidth (don't transfer unused columns)
 * - Better type safety  
 * - Protection against schema changes breaking queries
 * - Faster query execution with less I/O
 *
 * IMPORTANT: These columns are verified against the actual migration files.
 * Do NOT guess column names — always check supabase/migrations/ first.
 * 
 * Currently not actively used (queries use SELECT *), but kept as a
 * reference for future optimization.
 */

export const COLS = {
  // ─── profiles ────────────────────────────────────────────
  // Base: id, email, first_name, last_name, company_name, created_at, updated_at
  // Added: phone, position (fix_registration), team_id, team_role, joined_team_at (team_mgmt)
  // Added (UPDATE_SCHEMA_V4): is_superuser, avatar_url, detailed_address
  profiles: 'id, email, first_name, last_name, company_name, phone, position, avatar_url, is_superuser, team_id, team_role, joined_team_at, created_at, updated_at',
  profilesMinimal: 'id, email, first_name, last_name, avatar_url',

  // ─── projects ────────────────────────────────────────────
  // Base: id, owner_id, name, description, address, status, created_at, updated_at
  // Added: latitude, longitude, street, house_number, postal_code, city, country, project_number, start_date, target_end_date, actual_end_date, budget, color (general_info)
  // Added: settings (final_pages_crud), status_date (add_status_date)
  // Added (UPDATE_SCHEMA_V4): subtitle, picture_url, detailed_address
  projects: 'id, owner_id, name, description, address, status, created_at, updated_at, latitude, longitude, street, house_number, postal_code, city, country, project_number, start_date, target_end_date, actual_end_date, budget, color, settings, status_date, subtitle, picture_url, detailed_address',
  projectsList: 'id, owner_id, name, status, created_at, picture_url, address, color',

  // ─── project_members ────────────────────────────────────
  // Base: id, project_id, user_id, role, invited_at, joined_at
  // Added: role_id, custom_permissions, accessor_id, member_type (roles_permissions)
  // Added: status, accepted_at, invitation_token (member_status_invitations)
  // Added: member_team_id, added_by (team_mgmt)
  projectMembers: 'id, project_id, user_id, role, invited_at, joined_at, status, role_id, custom_permissions, accessor_id, member_type, accepted_at, invitation_token, member_team_id, added_by',

  // ─── tasks ───────────────────────────────────────────────
  // Base: id, project_id, room_id, creator_id, assigned_to, title, description, status, due_date, planned_duration_minutes, actual_duration_minutes, created_at, updated_at
  // Added: task_type, priority, completed_at, tags (general_info)
  // Added: story_points, sprint_id, labels, attachments, checklist, estimated_hours, actual_hours, board_position (scrum)
  tasks: 'id, project_id, room_id, creator_id, assigned_to, title, description, status, due_date, planned_duration_minutes, actual_duration_minutes, created_at, updated_at, task_type, priority, completed_at, tags, story_points, sprint_id, labels, attachments, checklist, estimated_hours, actual_hours, board_position',
  tasksList: 'id, project_id, creator_id, assigned_to, title, status, due_date, priority, created_at, task_type',

  // ─── task_images ─────────────────────────────────────────
  // NOTE: Has storage_path, NOT image_url!
  taskImages: 'id, task_id, project_id, uploaded_by, storage_path, file_name, file_size, mime_type, width, height, thumbnail_path, caption, description, display_order, created_at',

  // ─── task_documentation ──────────────────────────────────
  taskDocumentation: 'id, task_id, project_id, user_id, content, documentation_type, storage_path, file_name, file_size, mime_type, duration_seconds, thumbnail_path, metadata, created_at, updated_at',

  // ─── project_info ────────────────────────────────────────
  projectInfo: 'id, project_id, detailed_description, voice_message_url, voice_transcription, latitude, longitude, formatted_address, notes, created_at, updated_at',

  // ─── project_info_images ─────────────────────────────────
  // NOTE: Has storage_path, NOT image_url!
  projectInfoImages: 'id, project_info_id, storage_path, file_name, file_size, mime_type, caption, display_order, created_at',

  // ─── project_voice_messages ──────────────────────────────
  // NOTE: Has storage_path + transcription + duration_seconds, NOT audio_url/duration/transcript!
  projectVoiceMessages: 'id, project_info_id, storage_path, file_name, transcription, duration_seconds, created_at, updated_at',

  // ─── timeline_events ─────────────────────────────────────
  // Base: id, project_id, title, event_type, start_date, end_date, all_day, location, attendees, reminder_minutes, status, color, created_by, created_at, updated_at
  // Added: description, notes, is_completed (complete_pages_crud + enhanced_milestones)
  timelineEvents: 'id, project_id, title, description, event_type, start_date, end_date, all_day, location, attendees, reminder_minutes, status, color, created_by, notes, is_completed, created_at, updated_at',

  // ─── diary_entries ───────────────────────────────────────
  diaryEntries: 'id, project_id, entry_date, weather, temperature, workers_present, workers_list, contractors, work_performed, progress_notes, special_events, visitors, inspections, deliveries, materials_used, equipment_used, incidents, safety_notes, delays, delay_reasons, working_hours_start, working_hours_end, created_by, photos_attached, created_at, updated_at',

  // ─── project_messages ────────────────────────────────────
  projectMessages: 'id, project_id, user_id, content, message_type, is_pinned, pinned_by, pinned_at, parent_message_id, mentions, attachments, reactions, is_edited, edited_at, is_deleted, deleted_at, created_at, updated_at',

  // ─── activity_logs ───────────────────────────────────────
  activityLogs: 'id, project_id, user_id, action, entity_type, entity_id, entity_title, old_values, new_values, metadata, ip_address, user_agent, created_at',

  // ─── project_folders ─────────────────────────────────────
  projectFolders: 'id, project_id, parent_folder_id, name, description, color, created_by, created_at, updated_at',

  // ─── project_files ───────────────────────────────────────
  // NOTE: Has storage_path, NOT file_url!
  projectFiles: 'id, project_id, folder_id, name, description, storage_path, file_size, mime_type, version, is_latest_version, uploaded_by, uploaded_at, metadata, created_at, updated_at',

  // ─── project_file_versions ───────────────────────────────
  projectFileVersions: 'id, file_id, version, storage_path, file_size, uploaded_by, uploaded_at, change_notes',

  // ─── project_file_shares ─────────────────────────────────
  projectFileShares: 'id, file_id, folder_id, shared_with_user_id, shared_with_role, permission_level, can_download, can_edit, can_delete, can_share, shared_by, expires_at, created_at',

  // ─── notifications ───────────────────────────────────────
  notifications: 'id, user_id, type, title, message, data, is_read, created_at',

  // ─── Structure ───────────────────────────────────────────
  buildings: 'id, project_id, name, created_at',
  floors: 'id, building_id, name, level_index',
  rooms: 'id, floor_id, name, type, area_sqm',

  // ─── CRM / Admin (from UPDATE_SCHEMA files) ──────────────
  companies: 'id, name, address, contact_person_id, status, employees_count, bought_accounts, superuser_id, logo_url, email, tax_id, created_at, updated_at',
  companiesList: 'id, name, status, employees_count, logo_url, email, created_at',

  contactPersons: 'id, first_name, surname, company, department, email, phone, tags, notes, created_at, updated_at',

  crmContacts: 'id, type, first_name, last_name, email, phone, avatar_url, personal_number, detailed_address, notes, linked_user_id, created_at, updated_at',

  subcontractors: 'id, company_name, name, first_name, last_name, phone, notes, detailed_address, profile_picture_url, trade, street, zip, city, country, website, logo_url, created_at',

  subcontractorContacts: 'id, subcontractor_id, first_name, last_name, email, phone, department, notes, created_at',

  crmNotes: 'id, company_id, content, created_by, created_at, updated_at',
  companyFiles: 'id, company_id, file_url, file_name, uploaded_at, tags',
  companySubscriptions: 'id, company_id, subscription_type_id, payment_cycle, payment_deadline_days, recipes_url, start_date, end_date, invoice_amount, status, created_at',
  subscriptionTypes: 'id, title, price, currency, discount, features, description, created_at',

  invoices: 'id, subscription_id, company_id, amount, due_date, paid_at, status, period_start, period_end, created_at, notes, tags',

  tags: 'id, title, color, description, created_at',
  companyHistory: 'id, company_id, action, old_state, new_state, changed_by, created_at, details',
  feedback: 'id, user_id, content, created_at',

  // ─── Teams ───────────────────────────────────────────────
  teams: 'id, name, description, company_info, contact_email, contact_phone, address, logo_url, created_by, is_active, created_at, updated_at',
  teamInvitations: 'id, team_id, email, team_role, invited_by, token, status, invited_at, accepted_at, expires_at',
} as const;
