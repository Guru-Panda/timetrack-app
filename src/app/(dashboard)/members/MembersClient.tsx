'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Users2, Trash2, X, Copy, Check, UserMinus, Mail } from 'lucide-react'
import type { Profile, Invite } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface Props {
  currentUserId: string
  orgId: string
  isAdmin: boolean
  initialMembers: (Profile & { email: string })[]
  initialInvites: Invite[]
  appUrl: string
}

export default function MembersClient({ currentUserId, orgId, isAdmin, initialMembers, initialInvites, appUrl }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [invites, setInvites] = useState(initialInvites)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [loading, setLoading] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  async function sendInvite() {
    if (!inviteEmail.trim()) return toast.error('Email required')
    setLoading(true)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, org_id: orgId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInvites(prev => [data, ...prev])
      setInviteEmail('')
      setShowInviteModal(false)
      toast.success('Invite sent!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  async function revokeInvite(token: string) {
    const res = await fetch(`/api/invites/${token}`, { method: 'DELETE' })
    if (res.ok) { setInvites(prev => prev.filter(i => i.token !== token)); toast.success('Invite revoked') }
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the organisation?')) return
    const res = await fetch(`/api/members/${userId}`, { method: 'DELETE' })
    if (res.ok) { setMembers(prev => prev.filter(m => m.user_id !== userId)); toast.success('Member removed') }
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch(`/api/members/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    if (res.ok) { setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: role as 'owner' | 'admin' | 'member' } : m)); toast.success('Role updated') }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appUrl}/invite/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
    toast.success('Invite link copied!')
  }

  const roleColors = { owner: '#9333ea', admin: '#3b82f6', member: '#64748b' }
  const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Members</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
            <Plus size={16} /> Invite members
          </button>
        )}
      </div>

      {/* Members table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['Name', 'Email', 'Role', 'Joined'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
              {isAdmin && <th style={{ padding: '0.75rem 1rem', width: 60 }} />}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {getInitials(m.full_name)}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.full_name}</span>
                    {m.user_id === currentUserId && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px' }}>You</span>}
                  </div>
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{m.email}</td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  {isAdmin && m.user_id !== currentUserId && m.role !== 'owner' ? (
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.user_id, e.target.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: roleColors[m.role as keyof typeof roleColors], fontWeight: 600, fontSize: '0.875rem', outline: 'none' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: roleColors[m.role as keyof typeof roleColors] }}>
                      {roleLabel[m.role as keyof typeof roleLabel]}
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                {isAdmin && (
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {m.user_id !== currentUserId && m.role !== 'owner' && (
                      <button onClick={() => removeMember(m.user_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                        <UserMinus size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {isAdmin && invites.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Pending invites</h2>
          <div className="card" style={{ overflow: 'hidden' }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                <Mail size={16} color="var(--text-muted)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{inv.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expires {new Date(inv.expires_at).toLocaleDateString('en-GB')}</div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>{inv.role}</span>
                <button onClick={() => copyLink(inv.token)} className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', gap: '0.375rem' }}>
                  {copiedToken === inv.token ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                </button>
                <button onClick={() => revokeInvite(inv.token)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInviteModal(false)}>
          <div className="modal animate-fadein">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Invite team member</h2>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Email address *</label>
                <input className="input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'member')} style={{ appearance: 'none' }}>
                  <option value="member">Member — can track time</option>
                  <option value="admin">Admin — can manage projects & members</option>
                </select>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                They&apos;ll receive a unique invite link to join your workspace.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={sendInvite} disabled={loading}>
                  {loading ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
