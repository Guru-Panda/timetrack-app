import { requireUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import StatusBoard from './StatusBoard'

export default async function StatusPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  const { admin, profile } = auth
  const [{ data: actions }, { data: projects }] = await Promise.all([
    admin.from('actions').select('*').eq('org_id', profile.org_id).order('position'),
    admin.from('projects').select('id, name, color').eq('org_id', profile.org_id).eq('is_archived', false).order('name'),
  ])
  return <StatusBoard initialActions={actions ?? []} projects={projects ?? []} />
}
