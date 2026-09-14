'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, Download, Settings, Calendar } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, getWeek, getYear } from 'date-fns'
import { secondsToHours } from '@/lib/utils'
import type { Project, Client, Profile, TimeEntry } from '@/lib/types'

interface Props {
  orgId: string
  isAdmin: boolean
  currentUserId: string
  projects: Project[]
  clients: Client[]
  members: Profile[]
}

type ViewMode = 'summary' | 'detailed' | 'calendar'

export default function ReportsClient({ orgId, isAdmin, currentUserId, projects, clients, members }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [view, setView] = useState<ViewMode>('summary')
  const [weekDate, setWeekDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterMember, setFilterMember] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterBillable, setFilterBillable] = useState('')

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 })
  const weekNum = getWeek(weekDate, { weekStartsOn: 1 })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
        ...(filterMember && { user_id: filterMember }),
        ...(filterProject && { project_id: filterProject }),
        ...(filterClient && { client_id: filterClient }),
        ...(filterBillable && { is_billable: filterBillable }),
      })
      const res = await fetch(`/api/time-entries?${params}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch { setEntries([]) } finally { setLoading(false) }
  }, [orgId, weekStart.toISOString(), weekEnd.toISOString(), filterMember, filterProject, filterClient, filterBillable])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const totalSecs = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const billableSecs = entries.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
  const billablePct = totalSecs > 0 ? Math.round(billableSecs / totalSecs * 100) : 0

  // Daily breakdown for bar chart
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const ds = format(d, 'yyyy-MM-dd')
    const dayEntries = entries.filter(e => format(parseISO(e.start_time), 'yyyy-MM-dd') === ds)
    return {
      day: format(d, 'EEE'),
      date: format(d, 'MM/dd'),
      billable: Math.round(dayEntries.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 36) / 100,
      nonBillable: Math.round(dayEntries.filter(e => !e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 36) / 100,
    }
  })

  // Project breakdown
  const projectBreakdown = projects.map(p => {
    const pEntries = entries.filter(e => e.project_id === p.id)
    const secs = pEntries.reduce((s, e) => s + (e.duration || 0), 0)
    return { ...p, secs, pct: totalSecs > 0 ? Math.round(secs / totalSecs * 100 * 10) / 10 : 0 }
  }).filter(p => p.secs > 0).sort((a, b) => b.secs - a.secs)

  const noProjectEntries = entries.filter(e => !e.project_id)
  const noProjectSecs = noProjectEntries.reduce((s, e) => s + (e.duration || 0), 0)

  const CalendarView = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return (
      <div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '1px', marginBottom: '1px' }}>
          <div />
          {days.map((d, i) => {
            const date = new Date(weekStart)
            date.setDate(weekStart.getDate() + i)
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={d} style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: isToday ? 'var(--purple-pale)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>
                <div>{d}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{format(date, 'd')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(() => {
                    const ds = format(date, 'yyyy-MM-dd')
                    const secs = entries.filter(e => format(parseISO(e.start_time), 'yyyy-MM-dd') === ds).reduce((s, e) => s + (e.duration || 0), 0)
                    return secs > 0 ? secondsToHours(secs) : ''
                  })()}
                </div>
              </div>
            )
          })}
        </div>
        {/* Hours grid */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {Array.from({ length: 14 }, (_, h) => h + 7).map(hour => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '1px', borderBottom: '1px solid var(--border-color)', minHeight: '48px', alignItems: 'start' }}>
              <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', paddingTop: '0.375rem' }}>
                {hour.toString().padStart(2, '0')}:00
              </div>
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date(weekStart)
                date.setDate(weekStart.getDate() + i)
                const ds = format(date, 'yyyy-MM-dd')
                const hourEntries = entries.filter(e => {
                  const st = parseISO(e.start_time)
                  return format(st, 'yyyy-MM-dd') === ds && st.getHours() === hour
                })
                return (
                  <div key={i} style={{ padding: '2px', minHeight: '48px' }}>
                    {hourEntries.map(e => (
                      <div key={e.id} style={{
                        background: e.project?.color || 'var(--purple)',
                        borderRadius: '4px', padding: '2px 6px', marginBottom: '1px',
                        fontSize: '0.7rem', color: 'white', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9
                      }}>
                        {e.description || e.project?.name || 'No description'}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reports</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}><Download size={13} /> Export</button>
          <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}><Settings size={13} /> Settings</button>
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        {(['summary', 'detailed', 'calendar'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '0.375rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, background: view === v ? 'var(--bg-card)' : 'transparent', color: view === v ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s', textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Week nav + Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.25rem' }}>
          <button onClick={() => setWeekDate(subWeeks(weekDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', borderRadius: '4px' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', padding: '0 0.5rem' }}>
            This week · W{weekNum}
          </span>
          <button onClick={() => setWeekDate(addWeeks(weekDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', borderRadius: '4px' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {isAdmin && (
          <select className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.375rem 0.625rem' }} value={filterMember} onChange={e => setFilterMember(e.target.value)}>
            <option value="">All members</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
          </select>
        )}
        <select className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.375rem 0.625rem' }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.375rem 0.625rem' }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.375rem 0.625rem' }} value={filterBillable} onChange={e => setFilterBillable(e.target.value)}>
          <option value="">All</option>
          <option value="true">Billable</option>
          <option value="false">Non-billable</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--purple)', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
        </div>
      ) : view === 'calendar' ? (
        <CalendarView />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Total hours', value: secondsToHours(totalSecs) },
                { label: 'Billable hours', value: `${secondsToHours(billableSecs)} (${billablePct}%)` },
                { label: 'Avg daily hours', value: secondsToHours(Math.round(totalSecs / 7)) },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Duration by day</h3>
              {mounted ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} cursor={{ fill: 'rgba(147,51,234,0.06)' }} />
                    <Bar dataKey="billable" name="Billable" stackId="a" fill="#9333ea" />
                    <Bar dataKey="nonBillable" name="Non-billable" stackId="a" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 200 }} />}
            </div>

            {/* Project breakdown table */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Project &amp; member breakdown</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Project', 'Duration', '%', 'Amount'].map(h => (
                      <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {noProjectSecs > 0 && (
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Without project</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{secondsToHours(noProjectSecs)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{totalSecs > 0 ? Math.round(noProjectSecs / totalSecs * 100) : 0}%</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>—</td>
                    </tr>
                  )}
                  {projectBreakdown.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{secondsToHours(p.secs)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.pct}%</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Pie */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Project distribution</h3>
              {projectBreakdown.length > 0 ? (
                <>
                  {mounted ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={projectBreakdown} dataKey="secs" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                          {projectBreakdown.map((p, i) => <Cell key={i} fill={p.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => secondsToHours(Number(v))} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 180 }} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {projectBreakdown.slice(0, 5).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{p.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
