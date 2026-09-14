import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  return data
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, client_id, color, is_billable, org_id } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: project, error } = await admin.from('projects').insert({
    name, client_id: client_id || null, color: color || '#8b5cf6', is_billable: is_billable ?? true, org_id,
  }).select('*, client:clients(*)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(project)
}