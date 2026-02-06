# DocStruc Monorepo

This project is a monorepo containing the web and mobile applications for DocStruc, along with shared packages.

## Structure

- **apps/admin**: Internal Admin Dashboard (React + Vite)
- **apps/web**: React Web Application (Vite + TypeScript)
- **apps/mobile**: iOS & Android Application (React Native + Expo)
- **packages/ui**: Shared UI components
- **packages/theme**: Shared design tokens (colors, spacing)
- **packages/logic**: Shared business logic and types
- **packages/api**: Supabase client and API definitions

## Database Setup
The root directory contains several SQL scripts used to set up and patch the database:
- `20240204_initial_schema.sql`: Initial Setup
- `ADMIN_CRM_SCHEMA.sql`: CRM tables setup
- `ADD_TAGS_SCHEMA.sql` & `ADD_COLOR_COLUMN.sql`: Tags system configuration
- `FIX_*.sql`: Various fixes for RLS policies and database logic

## Getting Started

1.  **Install tools**:
    Make sure you have Node.js installed.

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run Development Servers**:
    ```bash
    npm run dev
    ```
    This will start both the web and mobile development servers using Turborepo.

## Environment Variables

Create a `.env` file in `apps/web` and `apps/mobile` with your Supabase credentials:

**apps/web/.env**:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

**apps/mobile/.env**:
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

## Architecture

- **Supabase**: Backend-as-a-Service for Auth, Database, and Storage.
- **TurboRepo**: Build system for the monorepo.
- **TypeScript**: Used across all generic packages and apps.
