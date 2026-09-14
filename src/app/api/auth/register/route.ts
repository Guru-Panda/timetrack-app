import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const { name, orgName, email, password, timezone } = await req.json()
    if (!name || !orgName || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError || !authData.user) return NextResponse.json({ error: authError?.message || 'Auth failed' }, { status: 400 })

    const tz = timezone || 'Europe/London'

    const { data: org, error: orgError } = await admin.from('organizations').insert({ name: orgName, timezone: tz }).select().single()
    if (orgError || !org) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: orgError?.message || 'Failed to create org' }, { status: 500 })
    }

    const { error: profileError } = await admin.from('profiles').insert({
      user_id: authData.user.id,
      full_name: name,
      org_id: org.id,
      role: 'owner',
      timezone: tz,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      await admin.from('organizations').delete().eq('id', org.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
