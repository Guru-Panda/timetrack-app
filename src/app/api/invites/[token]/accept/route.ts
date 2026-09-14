import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { name, password } = await req.json()

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: invite } = await admin.from('invites')
    .select('*, organization:organizations(*)')
    .eq('token', token).eq('used', false).gt('expires_at', now).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 })

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: invite.email, password, email_confirm: true,
  })
  if (authError || !authData.user) return NextResponse.json({ error: authError?.message || 'Auth failed' }, { status: 400 })

  const org = invite.organization as { timezone: string } | null
  const { error: profileError } = await admin.from('profiles').insert({
    user_id: authData.user.id,
    full_name: name,
    org_id: invite.org_id,
    role: invite.role,
    timezone: org?.timezone || 'Europe/London',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await admin.from('invites').update({ used: true }).eq('id', invite.id)
  return NextResponse.json({ success: true })
}