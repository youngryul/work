# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean personal productivity & life-tracking web application. Single-developer full-stack project deployed on Vercel with Supabase (PostgreSQL) backend.

**Stack:** React 18 + Vite + Tailwind CSS + Supabase + Drizzle ORM

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally

npm run db:generate  # Generate Drizzle ORM migrations from schema changes
npm run db:push      # Apply schema to PostgreSQL
npm run db:studio    # Open Drizzle Studio (visual DB browser)

npm run announce     # Manually trigger announcement creation
```

## Architecture

### Routing
`App.jsx` is a large single component that controls view switching via state (no React Router). All views are rendered conditionally based on `currentView` state.

### Layers
1. **Components** (`src/components/`) — React UI, feature-based subdirectories
2. **Services** (`src/services/`) — All Supabase DB operations; one service file per feature
3. **Contexts** (`src/contexts/AuthContext.jsx`) — Supabase Auth state, available globally via `useAuth()`
4. **Hooks** (`src/hooks/`) — `useNotifications.js` for reminder modal logic
5. **Constants** (`src/constants/`) — Navigation items, record types, categories, country lists

### Data Access
- Services call Supabase JS client directly (`src/config/supabase.js`)
- Drizzle ORM (`src/db/schema.js`) is used for schema definition and migrations only — not for runtime queries
- Row Level Security (RLS) is enforced at the DB level; all queries are automatically user-scoped

### State Management
No Redux or Zustand. Uses React `useState`/`useContext` + `localStorage` for session persistence (last-viewed page, user preferences).

### AI & Edge Functions
- Diary image generation uses OpenAI DALL-E 3 via Supabase Edge Functions (`src/services/aiImageService.js`)
- Announcements are auto-created on deploy via GitHub Actions → Supabase Edge Function

## Key Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_URL
VITE_DATABASE_URL          # For Drizzle migrations
SUPABASE_SERVICE_ROLE_KEY  # Server-side / Edge Functions
ANNOUNCEMENT_API_KEY       # Edge Function auth
```

## Database

Schema is defined in `src/db/schema.js` (Drizzle). Additional tables are managed via SQL migration files in the repo root. When adding a new table:
1. Add to `src/db/schema.js`
2. Run `npm run db:generate` then `npm run db:push`
3. Set up RLS policies in Supabase dashboard

## Output Language

모든 응답, 주석, 커밋 메시지, 문서는 **한국어**로 작성한다. 코드 내 변수명·함수명은 영어를 유지하되, 설명이 필요한 주석은 한국어로 작성한다.

## Deployment

Pushes to `main` trigger:
1. Vercel auto-deploy
2. GitHub Actions workflow (`.github/workflows/auto-announcement.yml`) that creates a user-facing announcement from the commit message