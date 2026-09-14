import { NextResponse } from 'next/server'
import { Client } from 'pg'
import { readFileSync } from 'fs'
import path from 'path'

// One-shot endpoint that applies the HR migration.
// Guarded by a secret token. DELETE THIS FILE after running once.
const SECRET = process.env.HR_MIGRATION_SECRET || 'timetrack-hr-2026'

const SQL = `
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
`

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const provided = req.headers.get('x-migration-secret')
  if (provided !== SECRET) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return NextResponse.json({ error: 'DATABASE_URL missing' }, { status: 500 })

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  const results: { stmt: string; status: string; error?: string }[] = []
  try {
    await client.connect()
    const statements = SQL.split(';').map(s => s.trim()).filter(Boolean)
    for (const s of statements) {
      try {
        await client.query(s)
        results.push({ stmt: s.slice(0, 60), status: 'ok' })
      } catch (e: unknown) {
        const msg = String((e as Error).message || '')
        if (/already exists|duplicate/i.test(msg)) results.push({ stmt: s.slice(0, 60), status: 'skipped' })
        else results.push({ stmt: s.slice(0, 60), status: 'failed', error: msg })
      }
    }
    return NextResponse.json({ ok: true, results })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    try { await client.end() } catch {}
  }
}
