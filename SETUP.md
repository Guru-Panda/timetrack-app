# TimeTrack — Setup & Deployment Guide

## Step 1: Supabase Setup (5 min)

1. Go to **supabase.com** → your project → **SQL Editor**
2. Paste the entire contents of `supabase-migration.sql` and click **Run**
3. Go to **Project Settings → API**:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Database → Connection string → URI** (Transaction pooler):
   - Copy it → `DATABASE_URL` (add `?pgbouncer=true` at end if not present)
   - Copy the **Direct connection** URI → `DIRECT_URL`

## Step 2: Local .env.local

Edit the file `timetrack-app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxx:password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 3: Generate Prisma Client & Run Locally

```bash
cd timetrack-app
npx prisma generate
npm run dev
```

Open http://localhost:3000 → click "Create workspace" to register your admin account.

## Step 4: Deploy to Vercel (Free)

### Option A — Vercel CLI (fastest)
```bash
npm install -g vercel
vercel
# Follow prompts — link to your Vercel account
```

### Option B — GitHub + Vercel Dashboard
1. Push to GitHub: `git init && git add . && git commit -m "init" && git remote add origin <your-repo> && git push -u origin main`
2. Go to **vercel.com** → New Project → Import your repo
3. Add all environment variables from `.env.local` PLUS:
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL (e.g. `https://timetrack.vercel.app`)

## Step 5: After Deployment

1. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to your live URL
2. In Supabase → **Authentication → URL Configuration**:
   - Add your Vercel URL to **Allowed Redirect URLs**: `https://your-app.vercel.app/**`
3. Redeploy (Vercel will auto-redeploy on env var changes)

## Features Reference

| Feature | Who | Where |
|---|---|---|
| Create workspace | Owner (first user) | /register |
| Invite team | Admin/Owner | /members → Invite members |
| Accept invite | New member | /invite/[token] (link sent) |
| Track time | All members | /timer |
| View reports | All (own data) / Admin (all) | /reports |
| Manage projects | Admin/Owner | /projects |
| Manage clients | Admin/Owner | /clients |
| Create invoices | Admin/Owner | /invoices |
| Change org settings | Admin/Owner | /settings |
| Remove members | Admin/Owner | /members |

## Roles

- **Owner** — full access, cannot be removed
- **Admin** — manage projects, clients, members, invoices, reports for all
- **Member** — track own time, view own reports only
