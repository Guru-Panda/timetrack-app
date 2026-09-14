'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  initial: {
    id?: string
    api_key?: string
    external_id?: string
    workspace_id?: string
    enabled?: boolean
    last_sync_at?: string
    config?: { workspaces?: { id: string; name: string }[] }
  } | null
  canEdit: boolean
}

export default function HiveClient({ initial, canEdit }: Props) {
  const [apiKey, setApiKey] = useState(initial?.api_key ?? '')
  const [externalId, setExternalId] = useState(initial?.external_id ?? '')
  const [workspaceId, setWorkspaceId] = useState(initial?.workspace_id ?? '')
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>(initial?.config?.workspaces ?? [])
  const [connected, setConnected] = useState(Boolean(initial?.id))
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const r = await fetch('/api/integrations/hive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, external_id: externalId, workspace_id: workspaceId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setWorkspaces(j.workspaces ?? [])
      if (!workspaceId && j.workspaces?.[0]) setWorkspaceId(j.workspaces[0].id)
      setConnected(true)
      toast.success('Hive connected')
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  async function sync(direction: 'pull' | 'push-leaves') {
    setBusy(true)
    try {
      const r = await fetch('/api/integrations/hive/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      toast.success(direction === 'pull' ? `Imported ${j.imported} of ${j.total} actions` : `Pushed ${j.pushed} leaves to Hive`)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  async function disconnect() {
    if (!confirm('Disconnect Hive?')) return
    setBusy(true)
    await fetch('/api/integrations/hive', { method: 'DELETE' })
    setConnected(false)
    setApiKey(''); setExternalId(''); setWorkspaceId(''); setWorkspaces([])
    toast.success('Disconnected')
    setBusy(false)
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)',
    fontSize: 14,
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Hive.com</h1>
        {connected && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>● CONNECTED</span>}
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Merges Hive projects and actions into TimeTrack. Approved leaves also push into Hive as OOO items.
      </p>

      <div style={{ display: 'grid', gap: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1.25rem' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>API key</label>
          <input type="password" style={field} value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={!canEdit || busy} placeholder="hive_api_..." />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Get this from Hive → Profile → API keys.</div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hive user ID</label>
          <input style={field} value={externalId} onChange={e => setExternalId(e.target.value)} disabled={!canEdit || busy} placeholder="Hive user id" />
        </div>
        {workspaces.length > 0 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Workspace</label>
            <select style={field} value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} disabled={!canEdit || busy}>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button disabled={!canEdit || busy || !apiKey || !externalId} onClick={save}
            style={{ padding: '0.5rem 1rem', background: 'var(--purple)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {connected ? 'Update connection' : 'Connect Hive'}
          </button>
          {connected && (
            <>
              <button disabled={busy} onClick={() => sync('pull')}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Pull actions from Hive
              </button>
              <button disabled={busy} onClick={() => sync('push-leaves')}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Push approved leaves
              </button>
              <button disabled={!canEdit || busy} onClick={disconnect}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Disconnect
              </button>
            </>
          )}
        </div>
        {initial?.last_sync_at && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last sync: {new Date(initial.last_sync_at).toLocaleString()}</div>
        )}
      </div>
    </div>
  )
}
