import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'

const DEFAULTS = [
  { name: 'Annual leave', leave_type: 'annual', annual_quota: 20, color: '#8b5cf6' },
  { name: 'Sick leave',   leave_type: 'sick',   annual_quota: 10, color: '#ef4444' },
  { name: 'Casual leave', leave_type: 'casual', annual_quota: 6,  color: '#f59e0b' },
  { name: 'Work from home', leave_type: 'wfh',  annual_quota: 0,  color: '#22c55e', allow_half_day: false },
  { name: 'Unpaid leave', leave_type: 'unpaid', annual_quota: 0,  color: '#6b7280' },
]

export async function POST() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { data: existing } = await admin.from('leave_policies').select('leave_type').eq('org_id', profile.org_id)
  const have = new Set((existing ?? []).map(p => p.leave_type))
  const rows = DEFAULTS.filter(d => !have.has(d.leave_type)).map(d => ({ ...d, org_id: profile.org_id, allow_half_day: d.allow_half_day ?? true }))
  if (rows.length) await admin.from('leave_policies').insert(rows)
  return NextResponse.json({ inserted: rows.length })
}
