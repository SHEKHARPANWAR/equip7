-- ==========================================
-- Cost Saving Dashboard - Supabase Schema Setup
-- Run this once in your Supabase project's SQL Editor
-- ==========================================

-- 1. Teams table
create table if not exists public.teams (
  code text primary key,
  name text not null,
  module text not null,
  leader text not null,
  fy25_expenses numeric not null default 0,
  target_reduction numeric not null default 0,
  cost_saved_25_26 numeric not null default 0,
  cost_saved_26_27 numeric not null default 0
);

-- 2. Tasks table (monthly cost saving records)
create table if not exists public.tasks (
  id text primary key,
  team_code text not null references public.teams(code) on delete cascade,
  team_name text not null,
  member text not null,
  title text not null,
  description text default '',
  month text not null,
  year integer not null,
  fy text not null,
  status text not null default 'In Progress',
  cost_saved numeric not null default 0,
  target_saving numeric not null default 0,
  remarks text default '',
  supporting_doc_name text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Indexes for filtering/searching
create index if not exists idx_tasks_team_code on public.tasks (team_code);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_fy on public.tasks (fy);
create index if not exists idx_tasks_year on public.tasks (year);

-- 4. Enable Row Level Security
alter table public.teams enable row level security;
alter table public.tasks enable row level security;

-- 5. RLS Policies - only authenticated (logged in) users can read/write
drop policy if exists "Authenticated read teams" on public.teams;
drop policy if exists "Authenticated write teams" on public.teams;
drop policy if exists "Authenticated read tasks" on public.tasks;
drop policy if exists "Authenticated write tasks" on public.tasks;

create policy "Authenticated read teams" on public.teams
  for select to authenticated using (true);

create policy "Authenticated write teams" on public.teams
  for all to authenticated using (true) with check (true);

create policy "Authenticated read tasks" on public.tasks
  for select to authenticated using (true);

create policy "Authenticated write tasks" on public.tasks
  for all to authenticated using (true) with check (true);

-- ==========================================
-- After running this:
-- Go to Authentication -> Users in your Supabase dashboard
-- and click "Add user" to create login accounts (email + password).
-- Those are the only accounts that can log in to the dashboard.
-- ==========================================
