'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Action {
  id: string
  title: string
  status: 'unstarted' | 'in_progress' | 'blocked' | 'completed'
  project_id: string | null
  due_date: string | null
  hive_action_id: string | null
}
interface Project { id: string; name: string; color: string }

const COLUMNS: { key: Action['status']; label: string; dot: string }[] = [
  { key: 'unstarted', label: 'UNSTARTED', dot: '#6b7280' },
  { key: 'in_progress', label: 'IN PROGRESS', dot: '#8b5cf6' },
  { key: 'blocked', label: 'BLOCKED', dot: '#f59e0b' },
  { key: 'completed', label: 'COMPLETED', dot: '#22c55e' },
]

export default function StatusBoard({ initialActions, projects }: { initialActions: Action[]; projects: Project[] }) {
  const [actions, setActions] = useState<Action[]>(initialActions)
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [dragging, setDragging] = useState<string | null>(null)

  const filtered = projectFilter ? actions.filter(a => a.project_id === projectFilter) : actions
  const grouped = COLUMNS.map(c => ({ col: c, items: filtered.filter(a => a.status === c.key) }))

  async function addAction(status: Action['status'], title: string) {
    if (!title.trim()) return
    const r = await fetch('/api/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status, project_id: projectFilter || null }),
    })
    const j = await r.json()
    if (!r.ok) return toast.error(j.error || 'Failed')
    setActions(a => [...a, j.action])
  }

  async function moveTo(id: string, status: Action['status']) {
    setActions(a => a.map(x => x.id === id ? { ...x, status } : x))
    const r = await fetch(`/api/actions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!r.ok) toast.error('Failed to move')
  }

  async function del(id: string) {
    if (!confirm('Delete this action?')) return
    setActions(a => a.filter(x => x.id !== id))
    await fetch(`/api/actions/${id}`, { method: 'DELETE' })
  }

  return (
    <div style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Status board</h1>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13 }}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: 12, overflowX: 'auto' }}>
        {grouped.map(({ col, items }) => (
          <div key={col.key}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragging) moveTo(dragging, col.key); setDragging(null) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.dot }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5 }}>{col.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{items.length}</div>
            </div>
            <AddInput onAdd={t => addAction(col.key, t)} />
            {items.map(a => {
              const p = projects.find(x => x.id === a.project_id)
              return (
                <div key={a.id}
                  draggable onDragStart={() => setDragging(a.id)} onDragEnd={() => setDragging(null)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `3px solid ${p?.color ?? '#8b5cf6'}`, borderRadius: 6, padding: '0.6rem 0.75rem', cursor: 'grab', position: 'relative' }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    {a.due_date && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{a.due_date}</span>}
                    {a.hive_action_id && <span title="Synced from Hive" style={{ fontSize: 10, background: '#fbbf24', color: '#111', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>HIVE</span>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button onClick={() => del(a.id)} title="Delete" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>×</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function AddInput({ onAdd }: { onAdd: (t: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <input
      placeholder="Create new action"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { onAdd(value); setValue('') } }}
      style={{ padding: '0.5rem 0.6rem', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
    />
  )
}
