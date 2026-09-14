import { NextResponse } from 'next/server'
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
  const admin = createAdminClient()
  await admin.from('invites').delete().eq('token', token)
  return NextResponse.json({ success: true })
}