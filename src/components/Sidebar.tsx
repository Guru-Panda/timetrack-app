'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Clock, LayoutDashboard, Timer, FolderOpen, Users, Users2,
  DollarSign, FileText, Tag, Target, Zap, Settings,
  LogOut, ChevronDown, Building2
} from 'lucide-react'
import { useState } from 'react'
import type { Profile, Organization } from '@/lib/types'

interface Props {
  profile: Profile
  org: Organization
}

export default function Sidebar({ profile, org }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const isAdmin = profile.role === 'owner' || profile.role === 'admin'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const trackLinks = [
    { href: '/overview', icon: LayoutDashboard, label: 'Overview' },
    { href: '/timer', icon: Timer, label: 'Timer' },
  ]

  const analyzeLinks = [
    { href: '/reports', icon: FileText, label: 'Reports' },
    { href: '/approvals', icon: Target, label: 'Approvals' },
  ]

  const manageLinks = [
    { href: '/projects', icon: FolderOpen, label: 'Projects' },
    { href: '/clients', icon: Building2, label: 'Clients' },
    { href: '/members', icon: Users2, label: 'Members' },
    { href: '/billable-rates', icon: DollarSign, label: 'Billable rates' },
    { href: '/invoices', icon: FileText, label: 'Invoices' },
    { href: '/tags', icon: Tag, label: 'Tags' },
    { href: '/goals', icon: Target, label: 'Goals' },
    { href: '/integrations', icon: Zap, label: 'Integrations', badge: 'NEW' },
  ]

  const adminLinks = [
    { href: '/subscription', icon: DollarSign, label: 'Subscription' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  function NavLink({ href, icon: Icon, label, badge }: { href: string; icon: React.ElementType; label: string; badge?: string }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
        <Icon size={16} />
        <span style={{ flex: 1 }}>{label}</span>
        {badge && (
          <span style={{ fontSize: '0.65rem', fontWeight: 600, background: 'var(--purple-bg)', color: 'var(--purple-pale)', border: '1px solid var(--purple-border)', borderRadius: '4px', padding: '1px 5px' }}>
            {badge}
          </span>
        )}
      </Link>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem 0.75rem 0.25rem', marginTop: '0.5rem' }}>
        {label}
      </div>
    )
  }

  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <aside style={{
      width: '220px', minWidth: '220px', height: '100vh', position: 'fixed', top: 0, left: 0,
      background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', zIndex: 40, overflow: 'hidden'
    }}>
      {/* Profile button — top left like Toggl */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
        <button
          onClick={() => { setShowProfileMenu(p => !p); setShowOrgMenu(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.375rem', borderRadius: '6px', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </div>
          </div>
          <ChevronDown size={13} color="var(--text-muted)" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {showProfileMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowProfileMenu(false)} />
            <div style={{
              position: 'absolute', top: '100%', left: '0.75rem', right: '0.75rem', zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
            }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{profile.full_name}</div>
                {profile.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>}
                <div style={{ fontSize: '0.7rem', color: 'var(--purple)', marginTop: '3px', fontWeight: 500, textTransform: 'capitalize' }}>{profile.role}</div>
              </div>
              <Link href="/settings" onClick={() => setShowProfileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', fontSize: '0.8rem', color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                <Settings size={13} /> Profile & Settings
              </Link>
              <button onClick={() => { setShowProfileMenu(false); handleSignOut() }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--red)', transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Org header */}
      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => { setShowOrgMenu(!showOrgMenu); setShowProfileMenu(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem 0.5rem', borderRadius: '6px', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ width: 28, height: 28, background: 'var(--purple)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={14} color="white" />
          </div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {org.name}
            </div>
          </div>
          <ChevronDown size={13} color="var(--text-muted)" />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        <SectionLabel label="Track" />
        {trackLinks.map(l => <NavLink key={l.href} {...l} />)}

        <SectionLabel label="Analyze" />
        {analyzeLinks.map(l => <NavLink key={l.href} {...l} />)}

        <SectionLabel label="Manage" />
        {manageLinks.map(l => <NavLink key={l.href} {...l} />)}

        {isAdmin && (
          <>
            <SectionLabel label="Admin" />
            {adminLinks.map(l => <NavLink key={l.href} {...l} />)}
          </>
        )}
      </nav>

    </aside>
  )
}
