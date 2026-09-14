import Link from 'next/link'
import { requireUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'

export default async function IntegrationsPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  const { admin, profile } = auth
  const { data: integrations } = await admin.from('integrations').select('*').eq('org_id', profile.org_id)
  const hive = (integrations ?? []).find(i => i.provider === 'hive')

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Integrations</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Connect external tools to TimeTrack.</p>

      <Link href="/integrations/hive" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1rem', border: '1px solid var(--border-color)',
          borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer'
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#111" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Hive.com</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sync actions & push approved leaves as OOO items in Hive.</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: hive?.enabled ? 'var(--green)' : 'var(--text-muted)' }}>
            {hive?.enabled ? 'CONNECTED' : 'CONNECT'}
          </div>
        </div>
      </Link>
    </div>
  )
}
