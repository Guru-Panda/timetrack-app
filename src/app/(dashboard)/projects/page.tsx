import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const [projectsRes, clientsRes] = await Promise.all([
    admin.from('projects').select('*, client:clients(*)').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
    admin.from('clients').select('*').eq('org_id', profile.org_id).order('name'),
  ])

  return (
    <ProjectsClient
      orgId={profile.org_id}
      isAdmin={profile.role === 'owner' || profile.role === 'admin'}
      initialProjects={projectsRes.data || []}
      clients={clientsRes.data || []}
    />
  )
}