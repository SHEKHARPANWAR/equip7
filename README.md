# Cost Saving Dashboard — Static HTML/CSS/JS Version

A plain HTML/CSS/JS conversion of the original Vite + React + Express "Cost
Saving Dashboard" project. No build step, no Node server — deploys directly
to GitHub Pages. Data lives in Supabase; authentication uses Supabase Auth.

## Files

- `index.html` — page shell
- `style.css` — all styling
- `app.js` — UI rendering, login screen, dashboard, CRUD wiring
- `auth.js` — Supabase Auth session handling (login/logout)
- `data.js` — all Supabase reads/writes for teams and tasks (mirrors the
  logic that used to live in `server.ts`)
- `supabase-client.js` — Supabase project URL/key and client setup
- `seed-data.js` — the original 6 teams and 73 historical monthly task
  records from `server.ts`, used to seed the database on first run
- `supabase_schema.sql` — run this once in your Supabase SQL Editor

## Setup

1. **Create a Supabase project** (or use an existing one).
2. **Run the schema**: open `supabase_schema.sql`, copy it into your
   Supabase project's SQL Editor, and click Run. This creates the `teams`
   and `tasks` tables with row-level security restricted to logged-in users.
3. **Add your project credentials**: open `supabase-client.js` and replace
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your own project's values
   (Project Settings → API in the Supabase dashboard).
4. **Create login accounts**: in Supabase, go to Authentication → Users →
   Add user, and create an email/password account for each person who
   should be able to log in. There is no self-registration — accounts are
   only created by you, in Supabase.
5. **Push to GitHub** and enable Pages: Settings → Pages → Source → branch
   `main`, folder `/ (root)` → Save. Visit your Pages URL after a minute or two.

## First run

The first time anyone logs in, the app checks if the `teams` table is
empty — if so, it automatically seeds it with the original 6 teams and all
73 historical monthly savings records, so the dashboard immediately matches
what the original app showed.

## What this preserves from the original

- The same 6 teams, leaders, modules, FY25 expense baselines, and target
  reduction figures
- The same 73 historical monthly task records (April 2025 through May 2026)
- The same fiscal-year bucketing logic (FY 2025-26 / FY 2026-27 / Future
  Planned) based on month + year
- Add / edit / delete tasks, CSV bulk import, and "reset to seed data"

## What's different from the original

- The original used a Node/Express backend (`server.ts`) talking to
  Supabase server-side. This version talks to Supabase directly from the
  browser using the public anon key, which is the standard approach for a
  static site with no server — row-level security policies (in
  `supabase_schema.sql`) are what keep the data protected, not the backend.
- Login uses Supabase Auth (email/password accounts you create yourself in
  the Supabase dashboard) rather than any custom auth system.
- The login screen is lamp-themed: a dark room with a single hanging lamp.
  Pulling the cord turns the light on, and the sign-in form fades in once
  it's lit.
- The rest of the visual design is new — built fresh for this static
  version rather than converted from the original React components (which
  weren't available to convert from).
