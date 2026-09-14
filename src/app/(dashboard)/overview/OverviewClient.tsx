'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, Clock, FolderOpen, TrendingUp, RefreshCw, ChevronDown } from 'lucide-react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears,
  eachDayOfInterval, eachMonthOfInterval,
  format, parseISO,
} from 'date-fns'

type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year'
type PeriodType = 'week' | 'month' | 'year'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
]

interface ChartRow { dateLabel: string; billable: number; nonBillable: number }
interface RawEntry { user_id: string; start_time: string; is_billable: boolean; duration: number | null; project_id: string | null; project?: { name: string; color: string } | null }

interface Props {
  orgName: string
  isAdmin: boolean
  stats: {
    totalHours: number
    billableHours: number
    totalMembers: number
    activeProjects: number
    weeklyData: ChartRow[]
    projectDistribution: { name: string; hours: number; color: string }[]
    memberActivity: { id: string; name: string; hours: number; is_tracking: boolean }[]
  }
}

function getPeriodRange(period: Period): { start: Date; end: Date; type: PeriodType } {
  const now = new Date()
  switch (period) {
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), type: 'week' }
    case 'last_week': {
      const prev = subWeeks(now, 1)
      return { start: startOfWeek(prev, { weekStartsOn: 1 }), end: endOfWeek(prev, { weekStartsOn: 1 }), type: 'week' }
    }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now), type: 'month' }
    case 'last_month': {
      const prev = subMonths(now, 1)
      return { start: startOfMonth(prev), end: endOfMonth(prev), type: 'month' }
    }
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now), type: 'year' }
    case 'last_year': {
      const prev = subYears(now, 1)
      return { start: startOfYear(prev), end: endOfYear(prev), type: 'year' }
    }
  }
}

function buildChartData(entries: RawEntry[], start: Date, end: Date, type: PeriodType): ChartRow[] {
  if (type === 'year') {
    return eachMonthOfInterval({ start, end }).map(month => {
      const monthStr = format(month, 'yyyy-MM')
      const me = entries.filter(e => format(parseISO(e.start_time), 'yyyy-MM') === monthStr)
      return {
        dateLabel: format(month, 'MMM'),
        billable: Math.round(me.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 3600 * 100) / 100,
        nonBillable: Math.round(me.filter(e => !e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 3600 * 100) / 100,
      }
    })
  }
  return eachDayOfInterval({ start, end }).map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const de = entries.filter(e => format(parseISO(e.start_time), 'yyyy-MM-dd') === dateStr)
    return {
      dateLabel: type === 'week' ? format(day, 'MM/dd') : format(day, 'd'),
      billable: Math.round(de.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 3600 * 100) / 100,
      nonBillable: Math.round(de.filter(e => !e.is_billable).reduce((s, e) => s + (e.duration || 0), 0) / 3600 * 100) / 100,
    }
  })
}

function computeStats(entries: RawEntry[], baseMembers: Props['stats']['memberActivity']) {
  const totalSecs = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const billableSecs = entries.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
  const projectHours: Record<string, { name: string; seconds: number; color: string }> = {}
  entries.forEach(e => {
    const key = e.project_id || 'no-project'
    if (!projectHours[key]) projectHours[key] = { name: e.project?.name || 'Without project', seconds: 0, color: e.project?.color || '#64748b' }
    projectHours[key].seconds += e.duration || 0
  })
  const projectDistribution = Object.values(projectHours)
    .sort((a, b) => b.seconds - a.seconds)
    .map(p => ({ name: p.name, hours: Math.round(p.seconds / 3600 * 100) / 100, color: p.color }))
  const memberActivity = baseMembers.map(m => {
    const secs = entries.filter(e => e.user_id === m.id).reduce((s, e) => s + (e.duration || 0), 0)
    return { ...m, hours: Math.round(secs / 3600 * 100) / 100 }
  })
  return {
    totalHours: Math.round(totalSecs / 3600 * 100) / 100,
    billableHours: Math.round(billableSecs / 3600 * 100) / 100,
    projectDistribution,
    memberActivity,
  }
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((s, p) => s + p.value, 0)
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: '0.875rem', color: p.fill, fontWeight: 500 }}>
            {p.name}: {p.value.toFixed(2)}h
          </p>
        ))}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Total: {total.toFixed(2)}h</p>
      </div>
    )
  }
  return null
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ background: 'var(--purple-bg)', borderRadius: '8px', padding: '0.5rem', display: 'flex' }}>
          <Icon size={18} color="var(--purple-pale)" />
        </div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--purple-pale)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

export default function OverviewClient({ orgName, isAdmin, stats }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [period, setPeriod] = useState<Period>('this_week')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [dynamicStats, setDynamicStats] = useState<{
    totalHours: number; billableHours: number; projectDistribution: typeof stats.projectDistribution; memberActivity: typeof stats.memberActivity; weeklyData: ChartRow[]
  } | null>(null)

  useEffect(() => setMounted(true), [])

  const loadPeriod = useCallback(async (p: Period) => {
    setFetching(true)
    try {
      const { start, end, type } = getPeriodRange(p)
      const res = await fetch(`/api/time-entries?from=${start.toISOString()}&to=${end.toISOString()}`)
      const { entries } = await res.json() as { entries: RawEntry[] }
      const computed = computeStats(entries, stats.memberActivity)
      setDynamicStats({
        ...computed,
        weeklyData: buildChartData(entries, start, end, type),
      })
    } catch {
      // keep existing data on error
    } finally {
      setFetching(false)
    }
  }, [stats.memberActivity])

  const handlePeriodSelect = (p: Period) => {
    setPeriod(p)
    setShowPeriodMenu(false)
    if (p === 'this_week') {
      setDynamicStats(null) // revert to server-rendered initial data
      return
    }
    loadPeriod(p)
  }

  const active = dynamicStats ?? { ...stats, weeklyData: stats.weeklyData }
  const billablePct = active.totalHours > 0 ? Math.round((active.billableHours / active.totalHours) * 100) : 0
  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label ?? 'This week'
  const { type: periodType } = getPeriodRange(period)
  const xAxisInterval = periodType === 'month' ? 4 : 0

  const formatHours = (h: number) => {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    return mins > 0 ? `${hrs}:${String(mins).padStart(2, '0')}:00` : `${hrs}:00:00`
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{isAdmin ? 'Admin Overview' : 'My Overview'}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAdmin ? 'Set up your organisation and keep your team on track' : 'Your tracked time this week'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }} onClick={() => loadPeriod(period)}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <StatCard icon={Clock} label={`Total hours (${periodLabel.toLowerCase()})`} value={formatHours(active.totalHours)} />
            <StatCard icon={TrendingUp} label="Billable hours" value={formatHours(active.billableHours)} sub={`${billablePct}% billable`} />
            <StatCard icon={Users} label="Team members" value={String(stats.totalMembers)} />
            <StatCard icon={FolderOpen} label="Active projects" value={String(stats.activeProjects)} />
          </div>

          {/* Chart with period filter */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{periodLabel} summary</h2>
                {fetching && (
                  <span style={{ width: 14, height: 14, border: '2px solid var(--purple)', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 10, height: 10, background: '#9333ea', borderRadius: '2px' }} /> Billable
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 10, height: 10, background: '#c084fc', borderRadius: '2px' }} /> Non-billable
                  </span>
                </div>
                {/* Period selector */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.3rem 0.625rem', fontSize: '0.75rem', gap: '0.25rem' }}
                    onClick={() => setShowPeriodMenu(v => !v)}
                  >
                    {periodLabel} <ChevronDown size={11} />
                  </button>
                  {showPeriodMenu && (
                    <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', minWidth: '140px', padding: '0.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                      {PERIOD_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          className="sidebar-link"
                          style={{ fontSize: '0.8rem', fontWeight: o.value === period ? 600 : 400, color: o.value === period ? 'var(--purple-pale)' : 'var(--text-primary)' }}
                          onClick={() => handlePeriodSelect(o.value)}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {mounted ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={active.weeklyData} barGap={2}>
                  <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} interval={xAxisInterval} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(147,51,234,0.06)' }} />
                  <Bar dataKey="billable" name="Billable" stackId="a" fill="#9333ea" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="nonBillable" name="Non-billable" stackId="a" fill="#c084fc" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading chart…</div>
            )}
          </div>

          {/* Team activity */}
          {isAdmin && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Team activity</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-pale)', cursor: 'pointer' }} onClick={() => router.push('/reports')}>View team activity →</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border-color)" strokeWidth="10" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--purple)" strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 38}`}
                      strokeDashoffset={`${2 * Math.PI * 38 * (1 - (active.memberActivity.filter(m => m.hours > 0).length / Math.max(active.memberActivity.length, 1)))}`}
                      strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {active.memberActivity.filter(m => m.hours > 0).length}/{active.memberActivity.length}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>tracked</span>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {active.memberActivity.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {(m.name || '?').split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.hours > 0 ? `${formatHours(m.hours)} — ${periodLabel.toLowerCase()}` : `No time — ${periodLabel.toLowerCase()}`}
                        </div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.is_tracking ? 'var(--green)' : 'var(--text-muted)' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top projects */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Top projects — {periodLabel.toLowerCase()}</h2>
            </div>
            {active.projectDistribution.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No data yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {active.projectDistribution.slice(0, 6).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatHours(p.hours)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie chart */}
          {active.projectDistribution.length > 0 && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Project distribution</h2>
              {mounted ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={active.projectDistribution} dataKey="hours" innerRadius={55} outerRadius={80} paddingAngle={2}>
                      {active.projectDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}h`, 'Hours']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          )}

          {/* Time tracked % */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Billable time</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 100, height: 100 }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border-color)" strokeWidth="12" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#eab308" strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - billablePct / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{billablePct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
