# ⚡ Performance & Scalability Audit Report — DocStruc

**Date:** 2025-02-19  
**Scope:** Full repository  

---

## Executive Summary

| Category | Issues Found |
|----------|-------------|
| 🔴 N+1 Queries | 1 critical (nested 4-level loop) |
| 🟠 Bundle Size | 621KB single JS bundle, no code splitting |
| 🟠 Over-fetching | 87× SELECT * queries |
| 🟡 Missing Optimization | No React.lazy, no Suspense, no memoization audit |
| ✅ Good | 121 database indexes defined, 0 npm vulnerabilities |

---

## 🔴 CRITICAL: N+1 Query in ProjectObjektplan

**Location:** `apps/web/src/pages/project/ProjectObjektplan.tsx:950-980`  
**Impact:** For a building with 5 staircases × 10 floors × 4 apartments = **200+ sequential Supabase API calls**

```
for (staircase in staircases)          → 1 query per staircase
  for (floor in staircase.floors)      → 1 query per floor  
    for (apt in floor.apartments)      → 1 query per apartment
      get attachments                  → 1 query per apartment
```

**Fix:** Replace with JOINs or batch queries. The staircase→floor→apartment→attachment hierarchy should be fetched with a single RPC call or nested select:

```typescript
// BEFORE: 200+ queries
for (const sc of scData) {
  const { data: flData } = await supabase.from('building_floors').select('*').eq('staircase_id', sc.id);
  for (const fl of flData) { ... }
}

// AFTER: 1 query with nested select
const { data } = await supabase
  .from('building_staircases')
  .select(`
    *,
    building_floors (
      *,
      building_apartments (
        *,
        building_attachments (*)
      )
    )
  `)
  .eq('project_id', projectId)
  .order('name');
```

---

## 🟠 HIGH: No Code Splitting (621KB Single Bundle)

**Location:** `apps/web/vite.config.ts`, `apps/web/src/App.tsx`  
**Impact:** Users download 621KB+ JS on first load, even for a single page

**Findings:**
- No `React.lazy()` usage anywhere
- No `Suspense` boundaries
- No dynamic `import()` for route-based splitting
- Single `index-BgjR_17H.js` (621KB) contains ALL routes and components
- Admin bundle: 584KB (same issue)

**Fix:** Add route-based code splitting (see fix below)

---

## 🟠 HIGH: 87× SELECT * Queries

**Location:** Throughout codebase (87 occurrences)  
**Impact:** Over-fetching columns increases payload size, bandwidth, and parse time

Top offenders:
- `packages/api/src/structure.ts` — 5× `.select('*')`
- `apps/web/src/pages/project/*` — dozens of `.select('*')` calls

**Recommendation:** Replace `.select('*')` with explicit column lists for tables with many columns, especially those containing large text/JSON fields.

---

## 🟡 MEDIUM: N+1 in ProjectParticipants

**Location:** `apps/web/src/pages/project/ProjectParticipants.tsx:711`  
**Impact:** Loop of individual upserts for content defaults

```typescript
for (const cd of contentDefaults) {
  const { error } = await supabase
    .from('project_content_defaults')
    .upsert(cd);
}
```

**Fix:** Use batch upsert: `await supabase.from('project_content_defaults').upsert(contentDefaults)`

---

## 🟡 MEDIUM: No Pagination on Large Lists

**Location:** Multiple pages  
**Impact:** Loading all records at once will degrade as data grows

Tables likely to grow large:
- `tasks` — per project
- `diary_entries` — daily entries
- `project_messages` — chat messages
- `project_files` — file records

**Recommendation:** Add `.range(offset, offset + limit)` pagination or cursor-based pagination.

---

## 🟡 MEDIUM: 327 Console Statements in Production

**Location:** All source files  
**Impact:** Browser console noise, minor performance overhead, PII risk

**Fix:** Add Vite plugin to strip `console.log` in production builds:

```typescript
// vite.config.ts
export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})
```

---

## Scalability Risks

### 1. No Connection Pooling Configuration
Supabase handles this server-side, but no client-side connection reuse patterns observed.

### 2. No Caching Layer
- No React Query / SWR / TanStack Query for data caching
- Every navigation re-fetches all data
- No stale-while-revalidate pattern

### 3. No Optimistic Updates
All mutations wait for server response before updating UI.

### 4. Real-time Subscriptions
No Supabase Realtime subscriptions observed — all data is fetched on mount/navigation. For collaborative features, this means users see stale data until refresh.

---

## Recommended Architecture Improvements

| Improvement | Impact | Effort |
|-------------|--------|--------|
| Route-based code splitting | 40-60% smaller initial bundle | 🟡 Medium |
| Replace N+1 with JOINs | 99% fewer API calls in Objektplan | 🟢 Easy |
| Add TanStack Query for caching | 50%+ fewer redundant fetches | 🟠 High |
| Batch upserts | Fewer API round-trips | 🟢 Easy |
| Production console strip | Cleaner production builds | 🟢 Easy |
| SELECT column lists | Smaller payloads | 🟡 Medium |
| Pagination on large lists | Constant load time as data grows | 🟡 Medium |

---

## Bundle Analysis

| App | JS Bundle | CSS | Total |
|-----|-----------|-----|-------|
| web | 621KB | 1.1KB | 622KB |
| admin | 584KB | 0.3KB | 584KB |

**Target after code splitting:** Initial load < 200KB, route chunks 50-100KB each
