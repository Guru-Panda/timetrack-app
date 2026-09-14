'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, FileText, X, Trash2, Send, CheckCircle, Download } from 'lucide-react'
import type { Invoice, Client, InvoiceItem } from '@/lib/types'
import { format, parseISO } from 'date-fns'

interface Props {
  orgId: string
  isAdmin: boolean
  initialInvoices: Invoice[]
  clients: Client[]
}

const statusColors = { draft: '#64748b', sent: '#3b82f6', paid: '#22c55e', overdue: '#ef4444' }
const statusIcons = { draft: FileText, sent: Send, paid: CheckCircle, overdue: FileText }

export default function InvoicesClient({ orgId, isAdmin, initialInvoices, clients }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    client_id: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
    currency: 'GBP',
    notes: '',
    items: [{ description: '', hours: 0, rate: 0, amount: 0 }] as InvoiceItem[],
  })

  function updateItem(index: number, field: string, value: string | number) {
    setForm(f => {
      const items = [...f.items] as InvoiceItem[]
      items[index] = { ...items[index], [field]: value }
      if (field === 'hours' || field === 'rate') {
        const h = field === 'hours' ? Number(value) : Number(items[index].hours)
        const r = field === 'rate' ? Number(value) : Number(items[index].rate)
        items[index].amount = Math.round(h * r * 100) / 100
      }
      return { ...f, items }
    })
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { description: '', hours: 0, rate: 0, amount: 0 } as InvoiceItem] }))
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  }

  const total = form.items.reduce((s, i) => s + Number(i.amount), 0)

  async function handleCreate() {
    if (!form.client_id) return toast.error('Select a client')
    if (form.items.some(i => !i.description)) return toast.error('All line items need a description')
    setLoading(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, org_id: orgId, total_amount: total }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInvoices(prev => [data, ...prev])
      setShowModal(false)
      toast.success('Invoice created')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: status as Invoice['status'] } : inv))
      toast.success('Status updated')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice?')) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { setInvoices(prev => prev.filter(i => i.id !== id)); toast.success('Invoice deleted') }
  }

  const currencySymbol = (c: string) => ({ GBP: '£', USD: '$', EUR: '€' }[c] || c)

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Invoices</h1>
        {isAdmin && <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New invoice</button>}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {(['draft', 'sent', 'paid', 'overdue'] as const).map(s => {
          const StatusIcon = statusIcons[s]
          const amount = invoices.filter(i => i.status === s).reduce((sum, i) => sum + i.total_amount, 0)
          return (
            <div key={s} className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <StatusIcon size={14} color={statusColors[s]} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColors[s], textTransform: 'capitalize' }}>{s}</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                £{amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{invoices.filter(i => i.status === s).length} invoice{invoices.filter(i => i.status === s).length !== 1 ? 's' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['Invoice #', 'Client', 'Issue date', 'Due date', 'Amount', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} /><p>No invoices yet</p>
              </td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--purple-pale)', fontWeight: 500 }}>#{inv.invoice_number}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{inv.client?.name}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{format(parseISO(inv.issue_date), 'd MMM yyyy')}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{format(parseISO(inv.due_date), 'd MMM yyyy')}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currencySymbol(inv.currency)}{inv.total_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  {isAdmin ? (
                    <select
                      value={inv.status}
                      onChange={e => updateStatus(inv.id, e.target.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: statusColors[inv.status as keyof typeof statusColors], outline: 'none', textTransform: 'capitalize' }}
                    >
                      {['draft', 'sent', 'paid', 'overdue'].map(s => <option key={s} value={s} style={{ color: 'var(--text-primary)', background: 'var(--bg-card)', textTransform: 'capitalize' }}>{s}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: statusColors[inv.status as keyof typeof statusColors], textTransform: 'capitalize' }}>{inv.status}</span>
                  )}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }} title="Download PDF">
                      <Download size={14} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create invoice modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-fadein" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>New invoice</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Client *</label>
                <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={{ appearance: 'none' }}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Issue date</label>
                <input className="input" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={{ appearance: 'none' }}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Line items</label>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input className="input" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ padding: '0.375rem 0.5rem', fontSize: '0.8rem' }} />
                  <input className="input" type="number" placeholder="Hours" value={item.hours || ''} onChange={e => updateItem(i, 'hours', e.target.value)} style={{ padding: '0.375rem 0.5rem', fontSize: '0.8rem' }} />
                  <input className="input" type="number" placeholder="Rate" value={item.rate || ''} onChange={e => updateItem(i, 'rate', e.target.value)} style={{ padding: '0.375rem 0.5rem', fontSize: '0.8rem' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {currencySymbol(form.currency)}{Number(item.amount).toFixed(2)}
                  </div>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}><X size={14} /></button>
                  )}
                </div>
              ))}
              <button className="btn-secondary" onClick={addItem} style={{ padding: '0.25rem 0.625rem', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                <Plus size={13} /> Add line
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currencySymbol(form.currency)}{total.toFixed(2)}
              </span>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" placeholder="Payment terms, notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={loading}>{loading ? 'Creating…' : 'Create invoice'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
