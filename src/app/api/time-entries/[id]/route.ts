import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('time_entries').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Whitelist only safe, user-editable fields
  const allowed: Record<string, unknown> = {}
  if ('description' in body) allowed.description = body.description
  if ('project_id' in body) allowed.project_id = body.project_id || null
  if ('is_billable' in body) allowed.is_billable = Boolean(body.is_billable)
  if ('start_time' in body) allowed.start_time = body.start_time
  if ('end_time' in body) allowed.end_time = body.end_time
  if ('duration' in body) allowed.duration = body.duration

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: entry, error } = await admin.from('time_entries')
    .update(allowed).eq('id', id).eq('user_id', user.id)
    .select('*, project:projects(*, client:clients(*))').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(entry)
}
