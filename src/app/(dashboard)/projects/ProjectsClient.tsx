'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, FolderOpen, Archive, Pencil, Trash2, X } from 'lucide-react'
import type { Project, Client } from '@/lib/types'
import { PROJECT_COLORS, randomColor } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface Props {
  orgId: string
  isAdmin: boolean
  initialProjects: Project[]
  clients: Client[]
}

export default function ProjectsClient({ orgId, isAdmin, initialProjects, clients }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({ name: '', client_id: '', color: randomColor(), is_billable: true })
  const [loading, setLoading] = useState(false)

  const visible = projects.filter(p => showArchived ? true : !p.is_archived)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', client_id: '', color: randomColor(), is_billable: true })
    setShowModal(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({ name: p.name, client_id: p.client_id || '', color: p.color, is_billable: p.is_billable })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Project name required')
    setLoading(true)
    try {
      if (editing) {
        const res = await fetch(`/api/projects/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProjects(prev => prev.map(p => p.id === editing.id ? { ...p, ...data } : p))
        toast.success('Project updated')
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, org_id: orgId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProjects(prev => [data, ...prev])
        toast.success('Project created')
      }
      setShowModal(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive(id: string, archive: boolean) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: archive }),
    })
    if (res.ok) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, is_archived: archive } : p))
      toast.success(archive ? 'Project archived' : 'Project restored')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? All time entries will be unlinked.')) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success('Project deleted')
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Projects</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} style={{ accentColor: 'var(--purple)' }} />
            Show archived
          </label>
          {isAdmin && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> New project
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['Project', 'Client', 'Time status', 'Billable', 'Team'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
              <th style={{ padding: '0.75rem 1rem', width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FolderOpen size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  <p>No projects yet</p>
                </td>
              </tr>
            )}
            {visible.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: p.is_archived ? 'var(--text-muted)' : 'var(--purple-pale)', textDecoration: p.is_archived ? 'line-through' : 'none' }}>{p.name}</span>
                  </div>
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{p.client?.name || '—'}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {format(parseISO(p.created_at), 'MMM d')}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px', background: p.is_billable ? 'rgba(34,197,94,0.12)' : 'var(--bg-secondary)', color: p.is_billable ? 'var(--green)' : 'var(--text-muted)' }}>
                    {p.is_billable ? 'Billable' : 'Non-billable'}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleArchive(p.id, !p.is_archived)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                        <Archive size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal animate-fadein">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editing ? 'Edit project' : 'New project'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Project name *</label>
                <input className="input" placeholder="Project name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Client</label>
                <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={{ appearance: 'none' }}>
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Colour</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PROJECT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_billable} onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked }))} style={{ accentColor: 'var(--purple)' }} />
                Billable project
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
