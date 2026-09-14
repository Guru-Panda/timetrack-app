'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Organization, Profile } from '@/lib/types'

const TIMEZONES = [
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'UTC',
]

interface Props { org: Organization; profile: Profile }

export default function SettingsClient({ org, profile }: Props) {
  const [orgName, setOrgName] = useState(org.name)
  const [timezone, setTimezone] = useState(org.timezone)
  const [loading, setLoading] = useState(false)

  async function saveOrgSettings() {
    setLoading(true)
    const res = await fetch('/api/settings/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName, timezone }),
    })
    if (res.ok) toast.success('Settings saved')
    else toast.error('Failed to save')
    setLoading(false)
  }

  const isAdmin = profile.role === 'owner' || profile.role === 'admin'

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Settings</h1>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Organisation</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Organisation name</label>
            <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label">Default timezone</label>
            <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)} disabled={!isAdmin} style={{ appearance: 'none' }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={saveOrgSettings} disabled={loading} style={{ width: 'fit-content' }}>
              {loading ? 'Saving…' : 'Save settings'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
