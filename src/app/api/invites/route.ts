import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  return data
}

export async function POST(req: Request) {
  const profile = await getProfile()
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role, org_id } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: existing } = await admin.from('invites')
    .select('id').eq('email', email).eq('org_id', org_id).eq('used', false).gt('expires_at', now).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Active invite already exists for this email' }, { status: 400 })

  // Fetch org name for the email
  const { data: org } = await admin.from('organizations').select('name').eq('id', org_id).single()

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invite, error } = await admin.from('invites')
    .insert({ email, role: role || 'member', org_id, expires_at: expires }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send invite email via Gmail SMTP
  let emailSent = false
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const inviteUrl = `${appUrl}/invite/${invite.token}`
      const orgName = org?.name || 'your team'
      const inviterName = profile.full_name || 'Someone'

      await transporter.sendMail({
        from: `TimeTrack <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `${inviterName} invited you to join ${orgName} on TimeTrack`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f13;color:#e2e8f0;border-radius:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
              <div style="width:36px;height:36px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">⏱</div>
              <span style="font-size:1.2rem;font-weight:700;color:#fff">TimeTrack</span>
            </div>
            <h2 style="font-size:1.25rem;font-weight:700;color:#fff;margin:0 0 8px">You've been invited!</h2>
            <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
              <strong style="color:#e2e8f0">${inviterName}</strong> has invited you to join
              <strong style="color:#e2e8f0"> ${orgName}</strong> on TimeTrack as a <strong style="color:#e2e8f0">${role || 'member'}</strong>.
            </p>
            <a href="${inviteUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:0.95rem">
              Accept invitation
            </a>
            <p style="color:#475569;font-size:0.8rem;margin:24px 0 0;line-height:1.5">
              This invite expires in 7 days. If you weren't expecting this, you can safely ignore it.<br>
              Or copy this link: <a href="${inviteUrl}" style="color:#7c3aed">${inviteUrl}</a>
            </p>
          </div>
        `,
      })
      emailSent = true
    } catch (emailErr) {
      console.error('Email send failed:', emailErr)
      return NextResponse.json(
        { error: 'Invite created but email failed to send. Check your SMTP settings.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ...invite, email_sent: emailSent })
}