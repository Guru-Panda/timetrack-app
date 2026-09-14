import { requireUser, isAdmin } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) redirect('/leaves')

  const { data: pending } = await admin
    .from('leave_requests')
    .select('*, policy:leave_policies(*)')
    .eq('org_id', profile.org_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((pending ?? []).map(r => r.user_id))]
  const { data: profiles } = await admin.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
  const pmap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]))

  const enriched = (pending ?? []).map(r => ({ ...r, profile: pmap[r.user_id] || null }))
  return <ApprovalsClient initial={enriched} />
}
