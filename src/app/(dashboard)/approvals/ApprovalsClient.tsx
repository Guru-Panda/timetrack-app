'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Row {
  id: string
  start_date: string
  end_date: string
  days_count: number
  is_half_day: boolean
  half_day_period: string | null
  reason: string
  policy?: { name: string; color: string }
  profile?: { full_name: string }
}

export default function ApprovalsClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const router = useRouter()

  async function decide(id: string, status: 'approved' | 'rejected') {
    const note = status === 'rejected' ? prompt('Reason for rejection (optional)') ?? '' : ''
    const r = await fetch(`/api/leaves/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_note: note }),
    })
    if (!r.ok) { const j = await r.json(); toast.error(j.error || 'Failed'); return }
    setRows(rows.filter(r => r.id !== id))
    toast.success(`Leave ${status}`)
    router.refresh()
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Approvals</h1>
      {rows.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No pending requests. All caught up.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <div style={{ width: 6, height: 40, background: r.policy?.color ?? '#8b5cf6', borderRadius: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {r.profile?.full_name ?? 'Employee'} · {r.policy?.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {r.start_date}{r.start_date !== r.end_date ? ` → ${r.end_date}` : ''} · {r.days_count}d {r.is_half_day ? `(${r.half_day_period})` : ''}
                </div>
                {r.reason && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>“{r.reason}”</div>}
              </div>
              <button onClick={() => decide(r.id, 'approved')} style={{ padding: '0.4rem 0.9rem', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Approve</button>
              <button onClick={() => decide(r.id, 'rejected')} style={{ padding: '0.4rem 0.9rem', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Reject</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
