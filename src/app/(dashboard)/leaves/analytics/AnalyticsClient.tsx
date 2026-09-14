'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, LineChart, Line } from 'recharts'

interface Stats {
  totalRequests: number
  approved: number
  pending: number
  rejected: number
  totalDaysTaken: number
  halfDayCount: number
  byType: { type: string; days: number; color: string }[]
  byMonth: { month: string; days: number; halfDays: number }[]
  byMember: { name: string; days: number; halfDays: number }[]
}

export default function AnalyticsClient() {
  const [year, setYear] = useState(new Date().getUTCFullYear())
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/leaves/analytics?year=${year}`).then(r => r.json()).then(j => {
      if (alive) { setStats(j.stats); setLoading(false) }
    })
    return () => { alive = false }
  }, [year])

  const kpi = (label: string, value: string | number, color = 'var(--purple)') => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Leave analytics</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading || !stats ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {kpi('Total days taken', stats.totalDaysTaken)}
            {kpi('Half days', stats.halfDayCount, 'var(--green)')}
            {kpi('Pending', stats.pending, '#f59e0b')}
            {kpi('Approved', stats.approved, 'var(--green)')}
            {kpi('Rejected', stats.rejected, 'var(--red)')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <Card title="Days by month">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                  <Bar dataKey="days" fill="#8b5cf6" name="Days" />
                  <Bar dataKey="halfDays" fill="#22c55e" name="Half days" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="By leave type">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.byType} dataKey="days" nameKey="type" outerRadius={90} label>
                    {stats.byType.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Monthly trend">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                  <Line type="monotone" dataKey="days" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="By member">
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {stats.byMember.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No approved leaves this year.</div>}
                {stats.byMember.map(m => (
                  <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)' }}>
                    <span>{m.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{m.days} days · {m.halfDays} half</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}
