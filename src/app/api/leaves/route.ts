import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'

function countDays(start: string, end: string, isHalf: boolean) {
  if (isHalf) return 0.5
  const a = new Date(start + 'T00:00:00Z').getTime()
  const b = new Date(end + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile, user } = auth
  const url = new URL(req.url)
  const scope = url.searchParams.get('scope') // 'mine' | 'all' | 'pending'
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let q = admin.from('leave_requests')
    .select('*, policy:leave_policies(*)')
    .eq('org_id', profile.org_id)
    .order('start_date', { ascending: false })
    .limit(500)

  const admn = isAdmin(profile.role)
  if (!admn || scope === 'mine') q = q.eq('user_id', user.id)
  if (scope === 'pending') q = q.eq('status', 'pending')
  if (from) q = q.gte('start_date', from)
  if (to) q = q.lte('end_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))]
  const { data: profiles } = await admin.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
  const pmap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]))
  const enriched = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, profile: pmap[r.user_id as string] || null }))
  return NextResponse.json({ requests: enriched })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile, user } = auth
  const body = await req.json()
  const { policy_id, start_date, end_date, is_half_day, half_day_period, reason } = body

  if (!policy_id || !start_date || !end_date) return NextResponse.json({ error: 'policy_id, start_date, end_date required' }, { status: 400 })
  if (is_half_day && start_date !== end_date) return NextResponse.json({ error: 'Half day must be a single date' }, { status: 400 })

  const days = countDays(start_date, end_date, !!is_half_day)

  const { data, error } = await admin.from('leave_requests').insert({
    org_id: profile.org_id,
    user_id: user.id,
    policy_id,
    start_date,
    end_date,
    is_half_day: !!is_half_day,
    half_day_period: is_half_day ? (half_day_period ?? 'morning') : null,
    days_count: days,
    reason: reason ?? '',
    status: 'pending',
  }).select('*, policy:leave_policies(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data }, { status: 201 })
}
