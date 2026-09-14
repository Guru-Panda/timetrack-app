import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  return data
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { org_id, client_id, issue_date, due_date, currency, notes, items, total_amount } = await req.json()

  const admin = createAdminClient()
  const { count } = await admin.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org_id)
  const invoice_number = String((count || 0) + 1).padStart(4, '0')

  const { data: invoice, error: invError } = await admin.from('invoices').insert({
    org_id, client_id, invoice_number,
    issue_date, due_date,
    currency: currency || 'GBP',
    notes, total_amount,
  }).select('*, client:clients(*)').single()
  if (invError || !invoice) return NextResponse.json({ error: invError?.message || 'Failed' }, { status: 500 })

  const { data: invoiceItems } = await admin.from('invoice_items').insert(
    (items as { description: string; hours: number; rate: number; amount: number }[]).map(item => ({
      invoice_id: invoice.id,
      description: item.description,
      hours: Number(item.hours),
      rate: Number(item.rate),
      amount: Number(item.amount),
    }))
  ).select()

  return NextResponse.json({ ...invoice, items: invoiceItems || [] })
}