import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ClientsClient from './ClientsClient'
import type { Client } from '@/lib/types'

interface ProjectRow { id: string; is_archived: boolean; [key: string]: unknown }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: rawClients } = await admin.from('clients')
    .select('*, projects:projects(*)')
    .eq('org_id', profile.org_id).order('name')

  const clients = ((rawClients || []) as (Client & { projects: ProjectRow[] })[]).map(c => ({
    ...c,
    projects: c.projects.filter(p => !p.is_archived) as { id: string }[],
  }))

  return (
    <ClientsClient
      orgId={profile.org_id}
      isAdmin={profile.role === 'owner' || profile.role === 'admin'}
      initialClients={clients}
    />
  )
}