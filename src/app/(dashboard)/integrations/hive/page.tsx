import { requireUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import HiveClient from './HiveClient'

export default async function HiveIntegrationPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  const { admin, profile } = auth
  const { data: integ } = await admin.from('integrations').select('*').eq('org_id', profile.org_id).eq('provider', 'hive').maybeSingle()
  const canEdit = profile.role === 'owner' || profile.role === 'admin'
  return <HiveClient initial={integ} canEdit={canEdit} />
}
