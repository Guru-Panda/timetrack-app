import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const [projectsRes, clientsRes, membersRes] = await Promise.all([
    admin.from('projects').select('*, client:clients(*)').eq('org_id', profile.org_id).order('name'),
    admin.from('clients').select('*').eq('org_id', profile.org_id).order('name'),
    admin.from('profiles').select('*').eq('org_id', profile.org_id),
  ])

  return (
    <ReportsClient
      orgId={profile.org_id}
      isAdmin={profile.role === 'owner' || profile.role === 'admin'}
      currentUserId={user.id}
      projects={projectsRes.data || []}
      clients={clientsRes.data || []}
      members={membersRes.data || []}
    />
  )
}