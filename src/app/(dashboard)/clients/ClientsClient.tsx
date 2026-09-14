'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Building2, Pencil, Trash2, X } from 'lucide-react'
import type { Client } from '@/lib/types'
import { PROJECT_COLORS, randomColor } from '@/lib/utils'

interface Props { orgId: string; isAdmin: boolean; initialClients: (Client & { projects: { id: string }[] })[] }

export default function ClientsClient({ orgId, isAdmin, initialClients }: Props) {
  const [clients, setClients] = useState(initialClients)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', color: randomColor() })
  const [loading, setLoading] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', color: randomColor() })
    setShowModal(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, color: c.color })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Client name required')
    setLoading(true)
    try {
      if (editing) {
        const res = await fetch(`/api/clients/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c))
        toast.success('Client updated')
      } else {
        const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, org_id: orgId }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setClients(prev => [...prev, { ...data, projects: [] }])
        toast.success('Client created')
      }
      setShowModal(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client?')) return
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Client deleted')
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Clients</h1>
        {isAdmin && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New client</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {clients.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Building2 size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p>No clients yet</p>
          </div>
        )}
        {clients.map(c => (
          <div key={c.id} className="card card-hover" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '8px', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.projects.length} project{c.projects.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-fadein">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{editing ? 'Edit client' : 'New client'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Client name *</label>
                <input className="input" placeholder="Acme Ltd" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Colour</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PROJECT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : editing ? 'Save' : 'Create client'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
