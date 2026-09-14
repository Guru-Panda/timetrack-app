import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description, project_id, is_billable } = await req.json()
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('org_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()

  // Stop any currently running timer
  const { data: running } = await admin.from('time_entries')
    .select('id, start_time').eq('user_id', user.id).eq('is_running', true).maybeSingle()

  if (running) {
    const duration = Math.round((now.getTime() - new Date(running.start_time).getTime()) / 1000)
    await admin.from('time_entries')
      .update({ is_running: false, end_time: now.toISOString(), duration })
      .eq('id', running.id)
  }

  const { data: entry, error } = await admin.from('time_entries').insert({
    user_id: user.id,
    org_id: profile.org_id,
    project_id: project_id || null,
    description: description || '',
    start_time: now.toISOString(),
    is_billable: is_billable ?? true,
    is_running: true,
  }).select('*, project:projects(*, client:clients(*))').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(entry)
}