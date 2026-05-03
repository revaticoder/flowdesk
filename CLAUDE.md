# RevFlow — Agency Operating System

## Project Overview
RevFlow is a Next.js 16 + React 19 + TypeScript SaaS for creative/digital agencies. It manages employees, clients, tasks, mandates, attendance, and gamified performance tracking.

**Stack:** Next.js App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase (PostgreSQL + Auth), Resend (email)

## Key Architecture Decisions
- **Next.js App Router** with file-based routing under `src/app/`
- **Server Components by default**; `"use client"` only for state/interactivity
- **Server Actions** in `actions.ts` files for mutations (login, logout, signup)
- **Supabase SSR** for auth — cookies managed by middleware at `src/lib/supabase/middleware.ts`
- Components are defined **inline in pages** (no separate `components/` directory in use)
- **No Redux/Context** — local `useState`/`useEffect` throughout
- Data fetching: server-side for dashboard counts, client-side Supabase for dynamic/filtered views

## Directory Structure
```
src/
├── app/
│   ├── (auth)/           # Login, signup, forgot-password
│   ├── reset-password/
│   ├── dashboard/
│   │   ├── layout.tsx    # App shell — sidebar nav, role-based menu, overdue badge
│   │   ├── page.tsx      # Dashboard home (Admin metrics vs Employee view)
│   │   ├── tasks/        # Task board, task detail, new task, leaderboard
│   │   ├── people/       # Employee directory + profiles
│   │   ├── clients/      # Client list + detail
│   │   ├── mandates/     # Mandate list + detail
│   │   ├── attendance/   # Check-in/out, leave, admin approval
│   │   ├── sow/          # SOW breakdown (in progress)
│   │   ├── settings/     # Office settings
│   │   └── admin-panel/
│   └── api/
│       ├── send-leave-email/route.ts   # Resend email notification
│       └── sow-breakdown/route.ts
├── lib/
│   ├── supabase/client.ts   # Browser Supabase client
│   ├── supabase/server.ts   # Server Supabase client (SSR cookies)
│   ├── supabase/middleware.ts
│   ├── tasks.ts             # Task constants, points logic, level thresholds
│   └── clients.ts
```

## Database Tables (Supabase/PostgreSQL)
| Table | Key Columns |
|-------|-------------|
| `employees` | id, email, full_name, role ("Admin" or employee) |
| `tasks` | id, title, status, priority, due_date, assigned_to, reporting_to, client_id, mandate_id, points, revision_count |
| `clients` | id, company_name |
| `mandates` | id, mandate_type, client_id |
| `employee_points` | employee_id, points, task_id, reason |
| `leaves` | employee_id, start_date, end_date, leave_type, status |
| attendance tables | check-in/out records, admin settings |

## Auth & Roles
- Supabase JWT auth; sessions via SSR cookies
- Two roles: **Admin** (full access) and regular employees (own-data access)
- Auth user email must match `employees.email` for profile linking

## Task Workflow
States: `Not Started → In Progress → In Review → Revision Requested → Completed`

**Points system:**
- Base points by priority: Low=5, Med=10, High=15, Urgent=20
- Bonus: +5 on-time, +10 zero revisions
- Penalty: -3 per revision request

**Levels:** Junior Agent → Rising Star → Senior Executor → Elite Performer → RevFlow Legend

## UI Conventions
- **Dark theme**: `bg-[#0d0d0d]`, zinc/neutral palette, vibrant color accents
- **Tailwind CSS 4** — mobile-first with `md:` breakpoints
- **No component library** — hand-rolled UI with Tailwind classes
- Form handling: native `FormData` (no React Hook Form or Zod)

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
FOUNDER_EMAIL=
ANTHROPIC_API_KEY=
```

## Dev Commands
```bash
npm run dev    # Start dev server (Next.js)
npm run build  # Production build
npm run lint   # ESLint
```

## Known Patterns & Gotchas
- PostgREST joins can be unreliable — the codebase fetches raw data then enriches client-side using lookup maps
- Attendance admin settings include per-employee timing and auto-checkout logic
- SOW breakdown page/API exists but is still in progress
- `src/components/`, `src/hooks/`, `src/types/`, `src/utils/` directories exist but are mostly empty — code lives inline in pages
