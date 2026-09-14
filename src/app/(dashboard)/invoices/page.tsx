import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InvoicesClient from './InvoicesClient'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const [invoicesRes, clientsRes] = await Promise.all([
    admin.from('invoices').select('*, client:clients(*), items:invoice_items(*)').eq('org_id', profile.org_id).order('created_at', { ascending: false }),
    admin.from('clients').select('*').eq('org_id', profile.org_id).order('name'),
  ])

  return (
    <InvoicesClient
      orgId={profile.org_id}
      isAdmin={profile.role === 'owner' || profile.role === 'admin'}
      initialInvoices={invoicesRes.data || []}
      clients={clientsRes.data || []}
    />
  )
}