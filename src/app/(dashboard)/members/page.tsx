import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MembersClient from './MembersClient'
import type { Profile } from '@/lib/types'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const now = new Date().toISOString()
  const [membersRes, invitesRes, authUsersRes] = await Promise.all([
    admin.from('profiles').select('*').eq('org_id', profile.org_id).order('created_at'),
    admin.from('invites').select('*').eq('org_id', profile.org_id).eq('used', false).gt('expires_at', now).order('created_at', { ascending: false }),
    admin.auth.admin.listUsers(),
  ])

  const emailMap = Object.fromEntries(
    (authUsersRes.data?.users || []).map((u: { id: string; email?: string }) => [u.id, u.email])
  )
  const membersWithEmail = (membersRes.data || []).map((m: Profile) => ({ ...m, email: emailMap[m.user_id] || '' }))

  return (
    <MembersClient
      currentUserId={user.id}
      orgId={profile.org_id}
      isAdmin={profile.role === 'owner' || profile.role === 'admin'}
      initialMembers={membersWithEmail as (Profile & { email: string })[]}
      initialInvites={invitesRes.data || []}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
    />
  )
}