-- TimeTrack HR + Hive migration (run in Supabase SQL Editor after the base migration).

-- Leave policies
create table if not exists leave_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  leave_type text not null check (leave_type in ('annual','sick','casual','unpaid','maternity','paternity','wfh','other')),
  annual_quota numeric not null default 0,
  allow_half_day boolean not null default true,
  carry_forward boolean not null default false,
  color text not null default '#8b5cf6',
  created_at timestamptz default now()
);
create index if not exists idx_leave_policies_org on leave_policies(org_id);

-- Leave balances (per user, per policy, per year)
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references leave_policies(id) on delete cascade,
  year int not null,
  used numeric not null default 0,
  allocated numeric not null default 0,
  updated_at timestamptz default now(),
  unique (user_id, policy_id, year)
);
create index if not exists idx_leave_balances_org on leave_balances(org_id);

-- Leave requests
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references leave_policies(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  is_half_day boolean not null default false,
  half_day_period text check (half_day_period in ('morning','afternoon')),
  days_count numeric not null default 1,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  hive_action_id text,
  created_at timestamptz default now()
);
create index if not exists idx_leave_requests_org on leave_requests(org_id);
create index if not exists idx_leave_requests_user on leave_requests(user_id);
create index if not exists idx_leave_requests_status on leave_requests(status);
create index if not exists idx_leave_requests_dates on leave_requests(start_date, end_date);

-- Integrations (Hive + future providers)
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  api_key text,
  external_id text,
  workspace_id text,
  config jsonb,
  enabled boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  unique (org_id, provider)
);

-- Actions (kanban tasks mirroring Hive actions)
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'unstarted' check (status in ('unstarted','in_progress','blocked','completed')),
  due_date date,
  hive_action_id text,
  position numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_actions_org on actions(org_id);
create index if not exists idx_actions_project on actions(project_id);
create index if not exists idx_actions_status on actions(status);

-- Seed default leave policies helper (call per org)
-- select seed_default_leave_policies('<org-uuid>');
create or replace function seed_default_leave_policies(p_org uuid) returns void
language plpgsql as $$
begin
  insert into leave_policies (org_id, name, leave_type, annual_quota, allow_half_day, color)
  values
    (p_org, 'Annual leave', 'annual', 20, true, '#8b5cf6'),
    (p_org, 'Sick leave',   'sick',   10, true, '#ef4444'),
    (p_org, 'Casual leave', 'casual', 6,  true, '#f59e0b'),
    (p_org, 'Work from home','wfh',   0,  false,'#22c55e'),
    (p_org, 'Unpaid leave', 'unpaid', 0,  true, '#6b7280')
  on conflict do nothing;
end $$;
