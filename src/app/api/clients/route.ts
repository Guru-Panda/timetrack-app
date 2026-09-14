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
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: client, error } = await admin.from('clients').insert({ name, color: color || '#3b82f6', org_id: profile.org_id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(client)
}
