import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: entry } = await admin.from('time_entries')
    .select('id, start_time').eq('id', id).eq('user_id', user.id).eq('is_running', true).maybeSingle()
  if (!entry) return NextResponse.json({ error: 'No running timer found' }, { status: 404 })

  const now = new Date()
  const duration = Math.round((now.getTime() - new Date(entry.start_time).getTime()) / 1000)

  const { data: updated, error } = await admin.from('time_entries')
    .update({ is_running: false, end_time: now.toISOString(), duration })
    .eq('id', id)
    .select('*, project:projects(*, client:clients(*))').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}