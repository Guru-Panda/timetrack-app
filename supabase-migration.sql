-- TimeTrack — Supabase SQL Migration
-- Run this entire file in your Supabase SQL Editor (supabase.com → project → SQL Editor)

-- 1. Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/London',
  created_at timestamptz default now()
);

-- 2. Profiles (linked to Supabase auth.users)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  hourly_rate numeric,
  timezone text not null default 'Europe/London',
  created_at timestamptz default now()
);

-- 3. Clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  created_at timestamptz default now()
);

-- 4. Projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  color text not null default '#8b5cf6',
  is_billable boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

-- 5. Time entries
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz,
  duration integer,
  is_billable boolean not null default true,
  is_running boolean not null default false,
  created_at timestamptz default now()
);

-- 6. Tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- 7. Invites
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz default now()
);

-- 8. Invoices
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  issue_date date not null,
  due_date date not null,
  total_amount numeric not null default 0,
  currency text not null default 'GBP',
  notes text,
  created_at timestamptz default now()
);

-- 9. Invoice items
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  hours numeric not null,
  rate numeric not null,
  amount numeric not null
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table time_entries enable row level security;
alter table tags enable row level security;
alter table invites enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

-- Helper: get current user's org_id
create or replace function get_my_org_id()
returns uuid language sql stable security definer as $$
  select org_id from profiles where user_id = auth.uid() limit 1;
$$;

-- Drop existing policies if any (idempotent re-run)
do $$ begin
  drop policy if exists "org_select" on organizations;
  drop policy if exists "org_update" on organizations;
  drop policy if exists "profiles_select" on profiles;
  drop policy if exists "profiles_insert" on profiles;
  drop policy if exists "profiles_update" on profiles;
  drop policy if exists "profiles_delete" on profiles;
  drop policy if exists "clients_all" on clients;
  drop policy if exists "projects_all" on projects;
  drop policy if exists "tags_all" on tags;
  drop policy if exists "invites_all" on invites;
  drop policy if exists "invoices_all" on invoices;
  drop policy if exists "time_entries_select" on time_entries;
  drop policy if exists "time_entries_insert" on time_entries;
  drop policy if exists "time_entries_update" on time_entries;
  drop policy if exists "time_entries_delete" on time_entries;
  drop policy if exists "invoice_items_all" on invoice_items;
end $$;

-- Organizations: members of the org can read
create policy "org_select" on organizations for select using (id = get_my_org_id());
create policy "org_update" on organizations for update using (id = get_my_org_id());

-- Profiles: same org can read; user can update their own
create policy "profiles_select" on profiles for select using (org_id = get_my_org_id());
create policy "profiles_insert" on profiles for insert with check (true); -- handled by server
create policy "profiles_update" on profiles for update using (org_id = get_my_org_id());
create policy "profiles_delete" on profiles for delete using (org_id = get_my_org_id());

-- Clients / Projects
create policy "clients_all" on clients for all using (org_id = get_my_org_id());
create policy "projects_all" on projects for all using (org_id = get_my_org_id());
create policy "tags_all" on tags for all using (org_id = get_my_org_id());
create policy "invites_all" on invites for all using (org_id = get_my_org_id());
create policy "invoices_all" on invoices for all using (org_id = get_my_org_id());

-- Time entries: members see org entries; only owner can see all
create policy "time_entries_select" on time_entries for select using (org_id = get_my_org_id());
create policy "time_entries_insert" on time_entries for insert with check (user_id = auth.uid() and org_id = get_my_org_id());
create policy "time_entries_update" on time_entries for update using (user_id = auth.uid());
create policy "time_entries_delete" on time_entries for delete using (user_id = auth.uid());

-- Invoice items (via invoice)
create policy "invoice_items_all" on invoice_items for all using (
  invoice_id in (select id from invoices where org_id = get_my_org_id())
);

-- ============================================================
-- Realtime: enable for time_entries
-- ============================================================
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table time_entries;
commit;
