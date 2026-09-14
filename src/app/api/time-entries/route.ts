import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const userId = searchParams.get('user_id')
  const projectId = searchParams.get('project_id')
  const clientId = searchParams.get('client_id')
  const isBillable = searchParams.get('is_billable')
  const isAdmin = profile.role !== 'member'

  let query = admin.from('time_entries')
    .select('*, project:projects(*, client:clients(*))')
    .eq('org_id', profile.org_id)
    .eq('is_running', false)
    .order('start_time', { ascending: false })
    .limit(500)

  if (from && to) query = query.gte('start_time', from).lte('start_time', to)
  if (!isAdmin) query = query.eq('user_id', user.id)
  else if (userId) query = query.eq('user_id', userId)
  if (projectId) query = query.eq('project_id', projectId)
  if (isBillable !== null && isBillable !== '') query = query.eq('is_billable', isBillable === 'true')

  if (clientId) {
    const { data: clientProjects } = await admin.from('projects').select('id').eq('client_id', clientId)
    const ids = (clientProjects || []).map((p: { id: string }) => p.id)
    if (ids.length === 0) return NextResponse.json({ entries: [] })
    query = query.in('project_id', ids)
  }

  const { data: entries, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch profiles for member info
  const userIds = [...new Set((entries || []).map((e: { user_id: string }) => e.user_id))]
  const { data: profiles } = await admin.from('profiles').select('*').in('user_id', userIds)
  const profileMap = Object.fromEntries((profiles || []).map((p: { user_id: string }) => [p.user_id, p]))
  const enriched = (entries || []).map((e: Record<string, unknown>) => ({ ...e, profile: profileMap[e.user_id as string] || null }))

  return NextResponse.json({ entries: enriched })
}