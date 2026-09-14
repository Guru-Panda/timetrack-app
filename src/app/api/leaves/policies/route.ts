import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  const { data } = await admin.from('leave_policies').select('*').eq('org_id', profile.org_id).order('name')
  return NextResponse.json({ policies: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await req.json()
  const { name, leave_type, annual_quota, allow_half_day, carry_forward, color } = body
  if (!name || !leave_type) return NextResponse.json({ error: 'name and leave_type required' }, { status: 400 })
  const { data, error } = await admin.from('leave_policies').insert({
    org_id: profile.org_id, name, leave_type,
    annual_quota: annual_quota ?? 0,
    allow_half_day: allow_half_day ?? true,
    carry_forward: carry_forward ?? false,
    color: color ?? '#8b5cf6',
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policy: data })
}
