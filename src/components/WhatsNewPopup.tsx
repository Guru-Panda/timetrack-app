'use client'

import { useEffect, useState } from 'react'
import { X, Clock, AlertCircle } from 'lucide-react'

const ANNOUNCEMENT_KEY = 'ann_36h_v1'
const EXPIRY = new Date('2026-07-03T23:59:59').getTime()

export default function WhatsNewPopup({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Date.now() > EXPIRY) return
    const key = `${ANNOUNCEMENT_KEY}:${userId}`
    if (!localStorage.getItem(key)) {
      setVisible(true)
    }
  }, [userId])

  function dismiss() {
    const key = `${ANNOUNCEMENT_KEY}:${userId}`
    localStorage.setItem(key, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '4px', borderRadius: '6px', display: 'flex',
          }}
        >
          <X size={16} />
        </button>

        {/* Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'var(--purple-bg, rgba(124,58,237,0.15))',
            color: 'var(--purple, #7c3aed)',
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
            padding: '0.2rem 0.6rem', borderRadius: '99px', textTransform: 'uppercase',
          }}>
            What&apos;s new
          </div>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          Time entry window — updated
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          A new policy is now in effect for all team members.
        </p>

        {/* Change card */}
        <div style={{
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: '10px', padding: '1rem 1.125rem',
          display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}>
          <Clock size={18} style={{ color: 'var(--purple, #7c3aed)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              36-hour logging window
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Members can only log time entries within the <strong style={{ color: 'var(--text-secondary)' }}>last 36 hours</strong>.
              For example, if today is Wednesday, you can log work back to Monday evening — but nothing before that.
            </div>
          </div>
        </div>

        {/* Note for admins */}
        <div style={{
          display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
          fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: 1.5,
          marginBottom: '1.75rem',
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--text-muted)' }} />
          <span>Admins are not affected by this restriction and can log entries for any date.</span>
        </div>

        <button
          onClick={dismiss}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
