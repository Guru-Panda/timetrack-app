import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import TimerClient from './TimerClient'

export default async function TimerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const [projectsRes, runningRes, recentRes] = await Promise.all([
    admin.from('projects').select('*, client:clients(*)').eq('org_id', profile.org_id).eq('is_archived', false).order('name'),
    admin.from('time_entries').select('*, project:projects(*, client:clients(*))').eq('user_id', user.id).eq('is_running', true).maybeSingle(),
    admin.from('time_entries').select('*, project:projects(*, client:clients(*))').eq('user_id', user.id).eq('org_id', profile.org_id).eq('is_running', false).order('start_time', { ascending: false }).limit(50),
  ])

  return (
    <TimerClient
      userId={user.id}
      orgId={profile.org_id}
      projects={projectsRes.data || []}
      initialRunning={runningRes.data || null}
      initialEntries={recentRes.data || []}
    />
  )
}