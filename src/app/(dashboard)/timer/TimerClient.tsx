'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDuration, secondsToHours } from '@/lib/utils'
import type { TimeEntry, Project } from '@/lib/types'
import { Play, Square, Plus, Trash2, ChevronDown, DollarSign, Calendar, List, Clock, Pencil, X } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, differenceInSeconds } from 'date-fns'

interface Props {
  userId: string
  orgId: string
  projects: Project[]
  initialRunning: TimeEntry | null
  initialEntries: TimeEntry[]
  isAdmin: boolean
}

export default function TimerClient({ userId, orgId, projects, initialRunning, initialEntries, isAdmin }: Props) {
  const [description, setDescription] = useState(initialRunning?.description || '')
  const [selectedProject, setSelectedProject] = useState<string>(initialRunning?.project_id || '')
  const [isBillable, setIsBillable] = useState(initialRunning?.is_billable ?? true)
  const [running, setRunning] = useState<TimeEntry | null>(initialRunning)
  const [elapsed, setElapsed] = useState(0)
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  // Tick the running timer
  useEffect(() => {
    if (running) {
      const calc = () => {
        const secs = differenceInSeconds(new Date(), parseISO(running.start_time))
        setElapsed(secs)
      }
      calc()
      intervalRef.current = setInterval(calc, 1000)
    } else {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  // Real-time subscription — sync across all sessions
  useEffect(() => {
    const channel = supabase
      .channel(`timer:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'time_entries',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const entry = payload.new as TimeEntry
          if (entry.is_running) {
            setRunning(entry)
          } else {
            setEntries(prev => [entry, ...prev])
          }
        }
        if (payload.eventType === 'UPDATE') {
          const entry = payload.new as TimeEntry
          if (!entry.is_running) {
            setRunning(null)
            setEntries(prev => {
              const exists = prev.find(e => e.id === entry.id)
              if (exists) return prev.map(e => e.id === entry.id ? entry : e)
              return [entry, ...prev]
            })
          }
        }
        if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== (payload.old as TimeEntry).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function startTimer() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/time-entries/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, project_id: selectedProject || null, is_billable: isBillable, org_id: orgId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRunning(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }

  async function stopTimer() {
    if (!running || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/time-entries/${running.id}/stop`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRunning(null)
      setDescription('')
      setSelectedProject('')
      setEntries(prev => [data, ...prev])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop timer')
    } finally {
      setLoading(false)
    }
  }

  async function deleteEntry(id: string) {
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setEntries(prev => prev.filter(e => e.id !== id))
      toast.success('Entry deleted')
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  async function updateEntry(id: string, description: string) {
    try {
      const res = await fetch(`/api/time-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEntries(prev => prev.map(e => e.id === id ? { ...e, description } : e))
    } catch {
      toast.error('Failed to update entry')
    }
  }

  async function continueEntry(entry: TimeEntry) {
    setDescription(entry.description)
    setSelectedProject(entry.project_id || '')
    setIsBillable(entry.is_billable)
    if (!running) {
      await startTimer()
    }
  }

  const selectedProjectData = projects.find(p => p.id === selectedProject)

  // Group entries by date
  const grouped = entries.reduce((acc, entry) => {
    const date = format(parseISO(entry.start_time), 'yyyy-MM-dd')
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {} as Record<string, TimeEntry[]>)

  function groupLabel(dateStr: string) {
    const d = parseISO(dateStr)
    if (isToday(d)) return `Today – ${format(d, 'EEEE, d MMM')}`
    if (isYesterday(d)) return `Yesterday – ${format(d, 'EEEE, d MMM')}`
    return format(d, 'EEEE, d MMM')
  }

  function groupTotal(dayEntries: TimeEntry[]) {
    const total = dayEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
    return secondsToHours(total)
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Timer</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>
            <Calendar size={14} /> Week · W19
          </button>
          <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>
            <List size={14} /> Calendar
          </button>
        </div>
      </div>

      {/* Timer input bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: showManualEntry ? '0' : '1.5rem', borderBottomLeftRadius: showManualEntry ? 0 : undefined, borderBottomRightRadius: showManualEntry ? 0 : undefined, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1', minWidth: '200px', background: 'transparent', border: 'none', fontSize: '1rem', padding: '0.25rem 0' }}
          placeholder="What are you working on?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !running) startTimer() }}
        />

        {/* Project picker */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-secondary"
            style={{ padding: '0.375rem 0.625rem', fontSize: '0.8rem', gap: '0.375rem' }}
            onClick={() => setShowProjects(!showProjects)}
          >
            {selectedProjectData ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedProjectData.color, display: 'inline-block' }} />
                {selectedProjectData.name}
              </>
            ) : (
              <><FolderIcon size={14} />Project</>
            )}
            <ChevronDown size={12} />
          </button>
          {showProjects && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', minWidth: '200px', padding: '0.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <button
                className="sidebar-link"
                style={{ fontSize: '0.8rem' }}
                onClick={() => { setSelectedProject(''); setShowProjects(false) }}
              >
                No project
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  className="sidebar-link"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => { setSelectedProject(p.id); setShowProjects(false) }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                  <span>{p.name}</span>
                  {p.client && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.client.name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Billable */}
        <button
          onClick={() => setIsBillable(!isBillable)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isBillable ? 'var(--green)' : 'var(--text-muted)', padding: '0.375rem', borderRadius: '6px', transition: 'color 0.2s' }}
          title={isBillable ? 'Billable' : 'Non-billable'}
        >
          <DollarSign size={16} />
        </button>

        {/* Timer display when running */}
        {running && (
          <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: 'var(--purple-pale)', minWidth: '90px', textAlign: 'center' }}>
            {formatDuration(elapsed)}
          </div>
        )}

        {/* Start/Stop button */}
        <button
          className="btn-primary"
          onClick={running ? stopTimer : startTimer}
          disabled={loading}
          style={{ padding: '0.5rem 0.75rem', background: running ? 'var(--red)' : 'var(--purple)', minWidth: '44px', justifyContent: 'center' }}
        >
          {loading
            ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
            : running ? <Square size={16} fill="white" /> : <Play size={16} fill="white" />}
        </button>

        <button
          className="btn-secondary"
          style={{ padding: '0.5rem 0.75rem', background: showManualEntry ? 'var(--purple-bg)' : undefined }}
          title="Add manual entry"
          onClick={() => setShowManualEntry(v => !v)}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Manual entry panel */}
      {showManualEntry && (
        <ManualEntryPanel
          projects={projects}
          isAdmin={isAdmin}
          onClose={() => setShowManualEntry(false)}
          onSave={(entry) => {
            setEntries(prev => [entry, ...prev].sort((a, b) =>
              new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
            ))
            setShowManualEntry(false)
            toast.success('Entry added')
          }}
        />
      )}

      {/* Entries list */}
      {Object.keys(grouped).length === 0 && !running && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Clock size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>No time entries yet. Start your timer above!</p>
        </div>
      )}

      {Object.entries(grouped).map(([date, dayEntries]) => (
        <div key={date} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{groupLabel(date)}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{groupTotal(dayEntries)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {dayEntries.map(entry => (
              <EntryRow key={entry.id} entry={entry} onDelete={deleteEntry} onContinue={continueEntry} onUpdate={updateEntry} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Manual Entry Panel ──────────────────────────────────────────────────────

function ManualEntryPanel({ projects, isAdmin, onClose, onSave }: {
  projects: Project[]
  isAdmin: boolean
  onClose: () => void
  onSave: (entry: TimeEntry) => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const nowTime = format(new Date(), 'HH:mm')
  const minDate = format(new Date(Date.now() - 36 * 3600 * 1000), 'yyyy-MM-dd')

  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState('')
  const [billable, setBillable] = useState(true)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState(nowTime)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const [showProjects, setShowProjects] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedProj = projects.find(p => p.id === projectId)

  async function save() {
    if (hours === 0 && minutes === 0) {
      toast.error('Duration must be greater than 0')
      return
    }
    const startMs = new Date(`${date}T${startTime}`).getTime()
    if (!isAdmin && startMs < Date.now() - 36 * 3600 * 1000) {
      toast.error('You can only log time within the last 36 hours')
      return
    }
    setSaving(true)
    try {
      const durationSecs = hours * 3600 + minutes * 60
      const endMs = startMs + durationSecs * 1000
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          project_id: projectId || null,
          is_billable: billable,
          start_time: new Date(startMs).toISOString(),
          end_time: new Date(endMs).toISOString(),
          duration: durationSecs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Add manual entry</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {/* Description */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Description</label>
          <input
            className="input"
            placeholder="What did you work on?"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            style={{ width: '100%' }}
            autoFocus
          />
        </div>

        {/* Project */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Project</label>
          <button
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
            onClick={() => setShowProjects(v => !v)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {selectedProj ? (
                <><span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedProj.color, display: 'inline-block' }} />{selectedProj.name}</>
              ) : 'No project'}
            </span>
            <ChevronDown size={12} />
          </button>
          {showProjects && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', minWidth: '200px', padding: '0.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <button className="sidebar-link" style={{ fontSize: '0.8rem' }} onClick={() => { setProjectId(''); setShowProjects(false) }}>No project</button>
              {projects.map(p => (
                <button key={p.id} className="sidebar-link" style={{ fontSize: '0.8rem' }} onClick={() => { setProjectId(p.id); setShowProjects(false) }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                  <span>{p.name}</span>
                  {p.client && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.client.name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Billable */}
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Billable</label>
          <button
            onClick={() => setBillable(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.45rem 0.75rem', cursor: 'pointer', color: billable ? 'var(--green)' : 'var(--text-muted)', fontSize: '0.85rem', width: '100%' }}
          >
            <DollarSign size={14} /> {billable ? 'Billable' : 'Non-billable'}
          </button>
        </div>

        {/* Date */}
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Date</label>
          <input
            type="date"
            className="input"
            value={date}
            min={isAdmin ? undefined : minDate}
            max={today}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Start time */}
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Start time</label>
          <input
            type="time"
            className="input"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Duration */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Duration</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="input"
              min={0}
              max={23}
              value={hours}
              onChange={e => setHours(Math.max(0, Math.min(23, Number(e.target.value))))}
              style={{ width: '80px', textAlign: 'center' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>h</span>
            <input
              type="number"
              className="input"
              min={0}
              max={59}
              value={minutes}
              onChange={e => setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
              style={{ width: '80px', textAlign: 'center' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>min</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
              = {secondsToHours(hours * 3600 + minutes * 60)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
        <button className="btn-secondary" onClick={onClose} style={{ padding: '0.45rem 0.875rem', fontSize: '0.85rem' }}>Cancel</button>
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving}
          style={{ padding: '0.45rem 0.875rem', fontSize: '0.85rem' }}
        >
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FolderIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, onDelete, onContinue, onUpdate, isAdmin }: {
  entry: TimeEntry
  onDelete: (id: string) => void
  onContinue: (e: TimeEntry) => void
  onUpdate: (id: string, description: string) => void
  isAdmin: boolean
}) {
  const canEdit = isAdmin || new Date(entry.start_time).getTime() > Date.now() - 36 * 3600 * 1000
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(entry.description)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    setEditDesc(entry.description)
    setEditing(true)
  }

  function cancelEdit() {
    setEditDesc(entry.description)
    setEditing(false)
  }

  async function saveEdit() {
    setEditing(false)
    if (editDesc !== entry.description) {
      onUpdate(entry.id, editDesc)
    }
  }

  const duration = entry.duration ? secondsToHours(entry.duration) : '—'
  const startStr = entry.start_time ? format(parseISO(entry.start_time), 'HH:mm') : ''
  const endStr = entry.end_time ? format(parseISO(entry.end_time), 'HH:mm') : ''

  return (
    <div
      className="card card-hover"
      style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false) }}
    >
      {entry.project && (
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.project.color, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            style={{ fontSize: '0.875rem', color: 'var(--text-primary)', background: 'var(--bg-input, var(--bg-card))', border: '1px solid var(--purple)', borderRadius: '4px', padding: '0.2rem 0.4rem', width: '100%', outline: 'none' }}
          />
        ) : (
          <div style={{ fontSize: '0.875rem', color: entry.description ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.description || '(no description)'}
          </div>
        )}
        {entry.project && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {entry.project.name}{entry.project.client ? ` · ${entry.project.client.name}` : ''}
          </div>
        )}
      </div>
      {entry.is_billable && <DollarSign size={13} color="var(--green)" />}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {startStr} – {endStr}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '60px', textAlign: 'right' }}>
        {duration}
      </div>
      {hover && !editing && (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {canEdit && (
            <button
              onClick={startEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}
              title="Edit description"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={() => onContinue(entry)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}
            title="Continue"
          >
            <Play size={14} />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
