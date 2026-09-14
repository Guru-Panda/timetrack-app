import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-helpers'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  const body = await req.json()
  const allowed = ['title', 'description', 'status', 'assignee_id', 'due_date', 'project_id', 'position']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]
  patch.updated_at = new Date().toISOString()
  const { data, error } = await admin.from('actions').update(patch).eq('id', id).eq('org_id', profile.org_id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  await admin.from('actions').delete().eq('id', id).eq('org_id', profile.org_id)
  return NextResponse.json({ ok: true })
}
