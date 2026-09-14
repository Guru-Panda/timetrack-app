import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile, user } = auth
  const body = await req.json()

  const { data: existing } = await admin.from('leave_requests').select('*').eq('id', id).eq('org_id', profile.org_id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admn = isAdmin(profile.role)
  // Owner can cancel their own pending; admin can approve/reject
  if (!admn && existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const patch: Record<string, unknown> = {}
  if (body.status && ['approved', 'rejected'].includes(body.status)) {
    if (!admn) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
    patch.status = body.status
    patch.reviewer_id = user.id
    patch.reviewed_at = new Date().toISOString()
    patch.review_note = body.review_note ?? null

    if (body.status === 'approved') {
      const year = new Date(existing.start_date).getUTCFullYear()
      const { data: bal } = await admin.from('leave_balances').select('*').eq('user_id', existing.user_id).eq('policy_id', existing.policy_id).eq('year', year).maybeSingle()
      if (bal) {
        await admin.from('leave_balances').update({ used: Number(bal.used) + Number(existing.days_count) }).eq('id', bal.id)
      } else {
        const { data: pol } = await admin.from('leave_policies').select('annual_quota').eq('id', existing.policy_id).single()
        await admin.from('leave_balances').insert({
          org_id: profile.org_id,
          user_id: existing.user_id,
          policy_id: existing.policy_id,
          year,
          allocated: pol?.annual_quota ?? 0,
          used: existing.days_count,
        })
      }
    }
  }
  if (body.status === 'cancelled') patch.status = 'cancelled'
  if (body.reason !== undefined) patch.reason = body.reason

  const { data, error } = await admin.from('leave_requests').update(patch).eq('id', id).select('*, policy:leave_policies(*)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile, user } = auth
  const { data: existing } = await admin.from('leave_requests').select('user_id, status').eq('id', id).eq('org_id', profile.org_id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.user_id !== user.id && !isAdmin(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await admin.from('leave_requests').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
