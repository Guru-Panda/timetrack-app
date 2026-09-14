import { NextResponse } from 'next/server'
import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'No profile' }, { status: 401 }) }

  return { user, profile, admin }
}

export function isAdmin(role: string) {
  return role === 'owner' || role === 'admin'
}
