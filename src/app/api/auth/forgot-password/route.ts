import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Sign a JSON payload with HMAC-SHA256. Returns "base64url_data.base64url_sig" */
export function signPayload(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const admin = createAdminClient()

  // Find the user in Supabase Auth
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  // Always return success to not reveal if email exists
  if (!user) return NextResponse.json({ ok: true, otpToken: '' })

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

  // Sign: {email, otp, userId, expires}
  const otpToken = signPayload({ email: email.toLowerCase(), otp, userId: user.id, expires })

  // Send OTP via Gmail
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  await transporter.sendMail({
    from: `TimeTrack <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your TimeTrack password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f13;color:#e2e8f0;border-radius:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">⏱</div>
          <span style="font-size:1.2rem;font-weight:700;color:#fff">TimeTrack</span>
        </div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#fff;margin:0 0 8px">Password reset request</h2>
        <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
          Use the code below to reset your password. It expires in <strong style="color:#e2e8f0">10 minutes</strong>.
        </p>
        <div style="background:#1e1b2e;border:1.5px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <div style="font-size:2.5rem;font-weight:800;letter-spacing:0.5em;color:#a78bfa;font-family:monospace">
            ${otp}
          </div>
        </div>
        <p style="color:#475569;font-size:0.8rem;line-height:1.5">
          If you didn't request a password reset, you can safely ignore this email.<br>
          Never share this code with anyone.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, otpToken })
}
