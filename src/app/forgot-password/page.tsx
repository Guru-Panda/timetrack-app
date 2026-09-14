'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Clock, Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react'

type Step = 'email' | 'otp' | 'password' | 'done'

// ─── 6-box OTP input ────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const r0 = useRef<HTMLInputElement>(null)
  const r1 = useRef<HTMLInputElement>(null)
  const r2 = useRef<HTMLInputElement>(null)
  const r3 = useRef<HTMLInputElement>(null)
  const r4 = useRef<HTMLInputElement>(null)
  const r5 = useRef<HTMLInputElement>(null)
  const refs = [r0, r1, r2, r3, r4, r5]

  const digits = value.padEnd(6, ' ').split('').slice(0, 6)

  useEffect(() => { r0.current?.focus() }, [])

  function set(idx: number, char: string) {
    const arr = value.padEnd(6, ' ').split('').slice(0, 6)
    arr[idx] = char || ' '
    const next = arr.join('').trimEnd()
    onChange(next)
    if (char && idx < 5) refs[idx + 1].current?.focus()
  }

  function handleKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = value.padEnd(6, ' ').split('').slice(0, 6)
      if (arr[idx].trim()) {
        arr[idx] = ' '
        onChange(arr.join('').trimEnd())
      } else if (idx > 0) {
        arr[idx - 1] = ' '
        onChange(arr.join('').trimEnd())
        refs[idx - 1].current?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    if (pasted.length > 0) refs[Math.min(pasted.length, 5)].current?.focus()
  }

  const boxStyle = (filled: boolean): React.CSSProperties => ({
    width: 48, height: 56, textAlign: 'center', fontSize: '1.375rem',
    fontFamily: 'monospace', fontWeight: 700,
    background: filled ? 'var(--purple-bg)' : 'var(--bg-secondary)',
    border: `1.5px solid ${filled ? 'var(--purple)' : 'var(--border-color)'}`,
    borderRadius: 10, color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
    cursor: disabled ? 'not-allowed' : 'text',
  })

  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
      {refs.map((ref, i) => (
        <input
          key={i}
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i]?.trim() || ''}
          onChange={e => set(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={boxStyle(!!(digits[i]?.trim()))}
        />
      ))}
    </div>
  )
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'email', label: 'Email' },
    { key: 'otp', label: 'Verify' },
    { key: 'password', label: 'Reset' },
  ]
  const idx = steps.findIndex(s => s.key === current)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.75rem', justifyContent: 'center' }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i < idx ? 'var(--purple)' : i === idx ? 'var(--purple)' : 'var(--bg-secondary)',
              border: `2px solid ${i <= idx ? 'var(--purple)' : 'var(--border-color)'}`,
              fontSize: '0.75rem', fontWeight: 700, color: i <= idx ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.65rem', color: i === idx ? 'var(--purple-pale)' : 'var(--text-muted)', fontWeight: i === idx ? 600 : 400 }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 48, height: 2, background: i < idx ? 'var(--purple)' : 'var(--border-color)', marginBottom: '1rem', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── Step 1: send OTP ──
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('OTP sent! Check your inbox.')
      setOtp('')
      setStep('otp')
      setResendCooldown(60)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('New OTP sent!')
      setOtp('')
      setResendCooldown(60)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: verify OTP ──
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.replace(/\s/g, '').length < 6) {
      toast.error('Please enter all 6 digits')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: otp.replace(/\s/g, '') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Identity verified!')
      setStep('password')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: reset password ──
  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('done')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const Spinner = () => (
    <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--purple)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
              <Clock size={22} color="white" />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>TimeTrack</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {step === 'email' && 'Reset your password'}
            {step === 'otp' && 'Check your inbox'}
            {step === 'password' && 'Choose a new password'}
            {step === 'done' && 'Password updated!'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>

          {/* Done state */}
          {step === 'done' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{ background: 'rgba(34,197,94,0.12)', borderRadius: '50%', padding: '1rem', display: 'flex' }}>
                <CheckCircle2 size={36} color="var(--green)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Password changed successfully</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>You can now sign in with your new password.</p>
              </div>
              <Link
                href="/login"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'var(--purple)', color: 'white', borderRadius: '8px', padding: '0.625rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', width: '100%', marginTop: '0.5rem' }}
              >
                Go to Sign in
              </Link>
            </div>
          ) : (
            <>
              <Steps current={step} />

              {/* Step 1 — Email */}
              {step === 'email' && (
                <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--purple-bg)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '0.25rem' }}>
                    <Mail size={18} color="var(--purple-pale)" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Enter your account email and we&apos;ll send a 6-digit OTP to verify your identity.
                    </p>
                  </div>
                  <div>
                    <label className="label">Email address</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.625rem' }}>
                    {loading ? <Spinner /> : 'Send OTP'}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <Link href="/login" style={{ color: 'var(--purple-pale)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ArrowLeft size={13} /> Back to sign in
                    </Link>
                  </div>
                </form>
              )}

              {/* Step 2 — OTP */}
              {step === 'otp' && (
                <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: 'var(--purple-bg)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                      <KeyRound size={18} color="var(--purple-pale)" style={{ margin: '0 auto 0.35rem' }} />
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.<br />
                        It expires in 10 minutes.
                      </p>
                    </div>
                    <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
                  </div>

                  <button className="btn-primary" type="submit" disabled={loading || otp.replace(/\s/g, '').length < 6} style={{ width: '100%', justifyContent: 'center', padding: '0.625rem' }}>
                    {loading ? <Spinner /> : 'Verify OTP'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <button
                      type="button"
                      onClick={() => { setStep('email'); setOtp('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                    >
                      <ArrowLeft size={13} /> Change email
                    </button>
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={resendCooldown > 0 || loading}
                      style={{ background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--purple-pale)', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                    >
                      <RefreshCw size={13} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3 — New password */}
              {step === 'password' && (
                <form onSubmit={resetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--purple-bg)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '0.25rem' }}>
                    <Lock size={18} color="var(--purple-pale)" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Identity verified. Choose a strong new password for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="label">New password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={8}
                        autoFocus
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <PasswordStrength password={password} />
                    )}
                  </div>

                  <div>
                    <label className="label">Confirm password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        style={{ paddingRight: '2.5rem', borderColor: confirm.length > 0 && confirm !== password ? 'var(--red)' : undefined }}
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirm.length > 0 && confirm !== password && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.3rem' }}>Passwords do not match</p>
                    )}
                  </div>

                  <button className="btn-primary" type="submit" disabled={loading || password !== confirm || password.length < 8}
                    style={{ width: '100%', justifyContent: 'center', padding: '0.625rem' }}>
                    {loading ? <Spinner /> : 'Set new password'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Password strength bar ───────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['var(--red)', 'var(--red)', '#f97316', '#eab308', 'var(--green)']
  const labels = ['', 'Weak', 'Weak', 'Fair', 'Strong']

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.25rem' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : 'var(--border-color)', transition: 'background 0.2s' }} />
        ))}
      </div>
      <p style={{ fontSize: '0.7rem', color: colors[score] }}>{labels[score]}</p>
    </div>
  )
}
