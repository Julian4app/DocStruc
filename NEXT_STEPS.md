# DocStruc Web System Setup - Next Steps

Great progress! The core Web System features are now implemented in the codebase. 

## 1. Database Update (CRITICAL)
You must apply the new database schema to support Room Components, Variants, and Timelines.
Run the SQL in `UPDATE_SCHEMA_V3_WEB_FEATURES.sql` in your Supabase SQL Editor.

This creates the following tables:
- `room_components`: For defining "Bauteile" (Walls, Floors).
- `planning_variants`: For "Varianten- und Entscheidungsmanagement".
- `project_timeline`: For the "Unveränderbare Projekt-Timeline".

## 2. Features Implemented & Ready to Test
Once the SQL is applied, you can use these features in the Web App:

### Project Detail
- **Timeline**: A new card on the right side shows Milestones. You can add default milestones (Milestone, Deadline).
- **Members**: You can see project members and an Invite placeholder.

### Room Detail (Room Planning)
- **Planning Tab**: Open any room. You will see a "Planning" tab.
- **Components**: You can add components (e.g., "Parkett Eiche", "Wandfarbe Weiß").
- **Recommendations**: The system automatically suggests "4 sockets" for standard rooms.

## 3. What's Next (Gap Analysis)
To fully complete the system "so the whole system works properly":

1. **Variants UI**: Currently, you can see `comp.type` but the detailed "Variant Selection" (Option A vs Option B) needs a dedicated UI in `RoomDetailView`.
2. **Invite Logic**: The `handleAddMember` function in `ProjectDetail.tsx` currently just alerts. You likely want to integrate this with Supabase Edge Functions to send real emails.
3. **Timeline**: The UI allows adding milestones. Consider restricting this to just 'Owner' role (permission check is already there for `canEdit`).

## Summary
The codebase is now aligned with your detailed requirements document (Roles, Structure, Planning, Timeline). 
**Action:** Run the SQL file immediately to activate these features.
