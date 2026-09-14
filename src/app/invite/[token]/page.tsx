'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Clock, CheckCircle } from 'lucide-react'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [invite, setInvite] = useState<{ email: string; org_name: string } | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { toast.error(data.error); router.push('/login') }
        else setInvite(data)
      })
      .finally(() => setChecking(false))
  }, [token, router])

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const { error } = await supabase.auth.signInWithPassword({ email: invite!.email, password })
      if (error) throw error

      toast.success('Welcome to the team!')
      router.push('/overview')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite')
      setLoading(false)
    }
  }

  if (checking) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--purple)', borderTop: '3px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
    </div>
  )

  if (!invite) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--purple)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
              <Clock size={22} color="white" />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>TimeTrack</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <CheckCircle size={18} color="var(--green)" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>You&apos;ve been invited!</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Join <strong style={{ color: 'var(--purple-pale)' }}>{invite.org_name}</strong> on TimeTrack
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Email</label>
              <input className="input" value={invite.email} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label className="label">Your name</label>
              <input className="input" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Set a password</label>
              <input className="input" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.625rem' }}>
              {loading
                ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
                : 'Accept & join workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
