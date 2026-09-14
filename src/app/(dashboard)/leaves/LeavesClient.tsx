'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Policy { id: string; name: string; leave_type: string; annual_quota: number; allow_half_day: boolean; color: string }
interface Balance { id: string; policy_id: string; year: number; used: number; allocated: number; policy?: Policy }
interface LeaveRow {
  id: string
  user_id: string
  start_date: string
  end_date: string
  is_half_day: boolean
  half_day_period: string | null
  days_count: number
  reason: string
  status: string
  policy?: Policy
}
interface Props {
  policies: Policy[]
  myRequests: LeaveRow[]
  balances: Balance[]
  teamRequests: { start_date: string; end_date: string; is_half_day: boolean; status: string; policy?: { color: string; name: string } }[]
  canAdmin: boolean
}

const DAY = 86400000
function iso(d: Date) { return d.toISOString().slice(0, 10) }
function inRange(day: string, start: string, end: string) { return day >= start && day <= end }

export default function LeavesClient({ policies, myRequests, balances, teamRequests, canAdmin }: Props) {
  const router = useRouter()
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setUTCDate(1); return d })
  const [selected, setSelected] = useState<{ start: string; end: string } | null>(null)
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? '')
  const [isHalf, setIsHalf] = useState(false)
  const [period, setPeriod] = useState<'morning' | 'afternoon'>('morning')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
    const startDow = first.getUTCDay()
    const daysInMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), d)))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  async function seedPolicies() {
    setBusy(true)
    const r = await fetch('/api/leaves/seed', { method: 'POST' })
    setBusy(false)
    if (r.ok) { toast.success('Default policies added'); router.refresh() }
    else toast.error('Failed to seed')
  }

  function toggleDay(day: string) {
    if (!selected) { setSelected({ start: day, end: day }); return }
    if (day < selected.start) setSelected({ start: day, end: selected.end })
    else setSelected({ start: selected.start, end: day })
  }

  async function submit() {
    if (!selected || !policyId) { toast.error('Pick dates and a policy'); return }
    setBusy(true)
    const r = await fetch('/api/leaves', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_id: policyId, start_date: selected.start, end_date: selected.end,
        is_half_day: isHalf && selected.start === selected.end,
        half_day_period: period, reason,
      }),
    })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) return toast.error(j.error || 'Failed')
    toast.success('Leave requested')
    setSelected(null); setReason(''); setIsHalf(false)
    router.refresh()
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this leave?')) return
    const r = await fetch(`/api/leaves/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    if (r.ok) { toast.success('Cancelled'); router.refresh() } else toast.error('Failed')
  }

  // Build map of day → colored slice for team leaves
  const dayColor: Record<string, { color: string; label: string; approved: boolean }[]> = {}
  for (const t of teamRequests) {
    for (let d = new Date(t.start_date + 'T00:00:00Z').getTime(); d <= new Date(t.end_date + 'T00:00:00Z').getTime(); d += DAY) {
      const key = iso(new Date(d))
      ;(dayColor[key] ??= []).push({ color: t.policy?.color ?? '#8b5cf6', label: t.policy?.name ?? '', approved: t.status === 'approved' })
    }
  }

  const cell: React.CSSProperties = { minHeight: 68, border: '1px solid var(--border-color)', padding: 4, borderRadius: 4, background: 'var(--bg-card)', fontSize: 12, cursor: 'pointer', position: 'relative' }
  const box: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1rem' }

  return (
    <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '1rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Leaves</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))} style={btn}>‹</button>
            <div style={{ minWidth: 160, textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>{monthLabel}</div>
            <button onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))} style={btn}>›</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', padding: 4 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />
            const dayISO = iso(d)
            const isSelected = selected && inRange(dayISO, selected.start, selected.end)
            const marks = dayColor[dayISO] ?? []
            return (
              <div key={i} style={{ ...cell, outline: isSelected ? '2px solid var(--purple)' : 'none' }} onClick={() => toggleDay(dayISO)}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.getUTCDate()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {marks.slice(0, 2).map((m, k) => (
                    <div key={k} style={{ background: m.color, opacity: m.approved ? 0.9 : 0.4, color: 'white', borderRadius: 3, padding: '1px 4px', fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.label}</div>
                  ))}
                  {marks.length > 2 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{marks.length - 2}</div>}
                </div>
              </div>
            )
          })}
        </div>

        <h2 style={{ marginTop: '1.5rem', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>My requests</h2>
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {myRequests.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No requests yet.</div>}
          {myRequests.map(r => (
            <div key={r.id} style={{ ...box, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 6, height: 32, background: r.policy?.color ?? '#8b5cf6', borderRadius: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                  {r.policy?.name} · {r.start_date}{r.start_date !== r.end_date ? ` → ${r.end_date}` : ''} · {r.days_count}d {r.is_half_day ? `(${r.half_day_period})` : ''}
                </div>
                {r.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.reason}</div>}
              </div>
              <StatusBadge status={r.status} />
              {['pending', 'approved'].includes(r.status) && (
                <button onClick={() => cancel(r.id)} style={{ ...btn, color: 'var(--red)', borderColor: 'var(--red)' }}>Cancel</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {policies.length === 0 ? (
          <div style={box}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No leave policies yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Seed the defaults (Annual, Sick, Casual, WFH, Unpaid) to get started.</div>
            {canAdmin && <button disabled={busy} onClick={seedPolicies} style={{ ...btn, background: 'var(--purple)', color: 'white', borderColor: 'var(--purple)' }}>Add default policies</button>}
          </div>
        ) : (
          <div style={box}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Request leave</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              {selected ? `${selected.start}${selected.start !== selected.end ? ` → ${selected.end}` : ''}` : 'Click a day on the calendar'}
            </div>
            <label style={lbl}>Policy</label>
            <select style={inp} value={policyId} onChange={e => setPolicyId(e.target.value)}>
              {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selected && selected.start === selected.end && policies.find(p => p.id === policyId)?.allow_half_day && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={isHalf} onChange={e => setIsHalf(e.target.checked)} /> Half day
                </label>
                {isHalf && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => setPeriod('morning')} style={{ ...btn, background: period === 'morning' ? 'var(--purple)' : 'transparent', color: period === 'morning' ? 'white' : 'var(--text-primary)' }}>Morning</button>
                    <button onClick={() => setPeriod('afternoon')} style={{ ...btn, background: period === 'afternoon' ? 'var(--purple)' : 'transparent', color: period === 'afternoon' ? 'white' : 'var(--text-primary)' }}>Afternoon</button>
                  </div>
                )}
              </div>
            )}
            <label style={lbl}>Reason (optional)</label>
            <textarea style={{ ...inp, minHeight: 60 }} value={reason} onChange={e => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button disabled={busy || !selected} onClick={submit} style={{ ...btn, background: 'var(--purple)', color: 'white', borderColor: 'var(--purple)' }}>Request</button>
              {selected && <button onClick={() => setSelected(null)} style={btn}>Clear</button>}
            </div>
          </div>
        )}

        <div style={box}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Balances · {new Date().getUTCFullYear()}</div>
          {policies.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>}
          {policies.map(p => {
            const b = balances.find(x => x.policy_id === p.id)
            const used = b?.used ?? 0
            const allocated = b?.allocated ?? p.annual_quota
            const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-primary)' }}>
                  <span>{p.name}</span>
                  <span>{used} / {allocated || '∞'}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: p.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', cancelled: '#6b7280' }
  return <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'white', background: colors[status] ?? '#6b7280', padding: '2px 8px', borderRadius: 4 }}>{status}</span>
}

const btn: React.CSSProperties = { padding: '0.4rem 0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }
const inp: React.CSSProperties = { width: '100%', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }
const lbl: React.CSSProperties = { display: 'block', marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }
