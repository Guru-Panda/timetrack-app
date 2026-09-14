import { requireUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import LeavesClient from './LeavesClient'

export default async function LeavesPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  const { admin, profile, user } = auth

  const [{ data: policies }, { data: myRequests }, { data: balances }, { data: teamRequests }] = await Promise.all([
    admin.from('leave_policies').select('*').eq('org_id', profile.org_id).order('name'),
    admin.from('leave_requests').select('*, policy:leave_policies(*)').eq('org_id', profile.org_id).eq('user_id', user.id).order('start_date', { ascending: false }),
    admin.from('leave_balances').select('*, policy:leave_policies(*)').eq('org_id', profile.org_id).eq('user_id', user.id).eq('year', new Date().getUTCFullYear()),
    admin.from('leave_requests').select('start_date, end_date, is_half_day, half_day_period, status, user_id, policy:leave_policies(color, name)').eq('org_id', profile.org_id).in('status', ['approved', 'pending']),
  ])

  const normalizedTeam = (teamRequests ?? []).map(t => ({
    start_date: t.start_date as string,
    end_date: t.end_date as string,
    is_half_day: t.is_half_day as boolean,
    status: t.status as string,
    policy: Array.isArray(t.policy) ? t.policy[0] : t.policy,
  }))

  return (
    <LeavesClient
      policies={policies ?? []}
      myRequests={(myRequests ?? []).map(r => ({ ...r, policy: Array.isArray(r.policy) ? r.policy[0] : r.policy }))}
      balances={(balances ?? []).map(b => ({ ...b, policy: Array.isArray(b.policy) ? b.policy[0] : b.policy }))}
      teamRequests={normalizedTeam}
      canAdmin={profile.role !== 'member'}
    />
  )
}
