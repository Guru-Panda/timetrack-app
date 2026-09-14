import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'

export async function GET(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const url = new URL(req.url)
  const year = Number(url.searchParams.get('year') ?? new Date().getUTCFullYear())
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const { data: rows } = await admin
    .from('leave_requests')
    .select('id, start_date, end_date, is_half_day, days_count, status, user_id, policy:leave_policies(name, color, leave_type)')
    .eq('org_id', profile.org_id)
    .gte('start_date', from).lte('start_date', to)

  const userIds = [...new Set((rows ?? []).map(r => r.user_id))]
  const { data: profiles } = await admin.from('profiles').select('user_id, full_name').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
  const nameOf = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]))

  const stats = {
    totalRequests: rows?.length ?? 0,
    approved: rows?.filter(r => r.status === 'approved').length ?? 0,
    pending: rows?.filter(r => r.status === 'pending').length ?? 0,
    rejected: rows?.filter(r => r.status === 'rejected').length ?? 0,
    totalDaysTaken: 0,
    halfDayCount: 0,
    byType: [] as { type: string; days: number; color: string }[],
    byMonth: [] as { month: string; days: number; halfDays: number }[],
    byMember: [] as { name: string; days: number; halfDays: number }[],
  }

  const typeMap = new Map<string, { days: number; color: string }>()
  const monthMap = new Map<string, { days: number; halfDays: number }>()
  const memberMap = new Map<string, { days: number; halfDays: number }>()

  for (let m = 0; m < 12; m++) {
    const label = new Date(Date.UTC(year, m, 1)).toLocaleString(undefined, { month: 'short' })
    monthMap.set(label, { days: 0, halfDays: 0 })
  }

  for (const r of rows ?? []) {
    if (r.status !== 'approved') continue
    stats.totalDaysTaken += Number(r.days_count)
    if (r.is_half_day) stats.halfDayCount++

    // Fix: Supabase returns policy as an array from foreign key select
    const pol = Array.isArray(r.policy) ? r.policy[0] : r.policy
    const typeName = pol?.name ?? 'Other'
    const color = pol?.color ?? '#8b5cf6'
    const cur = typeMap.get(typeName) ?? { days: 0, color }
    cur.days += Number(r.days_count); cur.color = color
    typeMap.set(typeName, cur)

    const monthLabel = new Date(r.start_date + 'T00:00:00Z').toLocaleString(undefined, { month: 'short' })
    const mv = monthMap.get(monthLabel) ?? { days: 0, halfDays: 0 }
    mv.days += Number(r.days_count); if (r.is_half_day) mv.halfDays++
    monthMap.set(monthLabel, mv)

    const name = nameOf[r.user_id] ?? 'Unknown'
    const mem = memberMap.get(name) ?? { days: 0, halfDays: 0 }
    mem.days += Number(r.days_count); if (r.is_half_day) mem.halfDays++
    memberMap.set(name, mem)
  }

  stats.byType = [...typeMap.entries()].map(([type, v]) => ({ type, ...v }))
  stats.byMonth = [...monthMap.entries()].map(([month, v]) => ({ month, ...v }))
  stats.byMember = [...memberMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.days - a.days)

  return NextResponse.json({ stats, year })
}
