import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: invite } = await admin.from('invites')
    .select('email, organization:organizations(name)')
    .eq('token', token).eq('used', false).gt('expires_at', now).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 })
  const org = invite.organization as unknown as { name: string } | null
  return NextResponse.json({ email: invite.email, org_name: org?.name })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the invite belongs to the caller's org
  const { data: profile } = await admin.from('profiles').select('org_id, role').eq('user_id', user.id).single()
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: invite } = await admin.from('invites').select('org_id').eq('token', token).maybeSingle()
  if (!invite || invite.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('invites').delete().eq('token', token)
  return NextResponse.json({ success: true })
}
