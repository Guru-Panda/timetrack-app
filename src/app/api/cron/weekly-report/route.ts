import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns'

// Vercel calls cron routes with a secret header — block unauthorized calls
function isAuthorized(req: Request) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

function secondsToReadable(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

  // Last week range (Mon–Sun)
  const lastWeekDate = subWeeks(new Date(), 1)
  const weekStart = startOfWeek(lastWeekDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 })
  weekEnd.setHours(23, 59, 59, 999)
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`

  // Fetch all orgs
  const { data: orgs } = await admin.from('organizations').select('id, name')
  if (!orgs?.length) return NextResponse.json({ ok: true, message: 'No orgs' })

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  const results: string[] = []

  for (const org of orgs) {
    // Get admin/owner profile (first found)
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('user_id, full_name')
      .eq('org_id', org.id)
      .in('role', ['admin', 'owner'])
      .limit(1)
      .single()

    if (!adminProfile) continue

    // Get admin email from Supabase auth
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const adminUser = users.find(u => u.id === adminProfile.user_id)
    if (!adminUser?.email) continue

    // Get all members
    const { data: members } = await admin
      .from('profiles')
      .select('user_id, full_name, role')
      .eq('org_id', org.id)
    if (!members?.length) continue

    // Get last week's entries for all members
    const { data: entries } = await admin
      .from('time_entries')
      .select('user_id, description, duration, is_billable, start_time, project:projects(name)')
      .eq('org_id', org.id)
      .eq('is_running', false)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString())
    if (!entries) continue

    // Build per-member summary for the AI prompt
    const memberSummaries = members.map(m => {
      const me = entries.filter(e => e.user_id === m.user_id)
      const totalSecs = me.reduce((s, e) => s + (e.duration || 0), 0)
      const billableSecs = me.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
      const tasks = me
        .filter(e => e.description)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(e => `- ${e.description}${e.project ? ` [${(e.project as any).name}]` : ''}`)
        .slice(0, 20)
      return {
        name: m.full_name,
        role: m.role,
        totalSecs,
        billableSecs,
        entryCount: me.length,
        tasks,
      }
    })

    const orgTotalSecs = entries.reduce((s, e) => s + (e.duration || 0), 0)

    // Build the data section for Claude
    const dataText = memberSummaries.map(m => `
Member: ${m.name} (${m.role})
Total time: ${secondsToReadable(m.totalSecs)}
Billable time: ${secondsToReadable(m.billableSecs)}
Entries logged: ${m.entryCount}
Tasks worked on:
${m.tasks.length > 0 ? m.tasks.join('\n') : '  (no descriptions logged)'}
`.trim()).join('\n\n---\n\n')

    // Ask Gemini to write the report
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const aiResult = await model.generateContent(`You are a professional productivity analyst. Write a concise weekly team report for the admin of "${org.name}".

Week: ${weekLabel}
Organisation total: ${secondsToReadable(orgTotalSecs)} logged

MEMBER DATA:
${dataText}

Write a professional report with:
1. A brief executive summary (2-3 sentences on the week overall)
2. A section per member: highlight what they worked on, their hours, and a one-line observation (e.g. strong output, light week, no entries)
3. A closing note with any patterns or suggestions

Keep it factual, concise, and professional. Use plain text with clear section headings. No markdown symbols like ** or ##.`)

    const reportText = aiResult.response.text()

    // Build the HTML email
    const html = `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;background:#0f0f13;color:#e2e8f0;border-radius:12px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <div style="width:36px;height:36px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">⏱</div>
    <span style="font-size:1.2rem;font-weight:700;color:#fff">TimeTrack</span>
  </div>
  <h2 style="font-size:1.1rem;font-weight:700;color:#fff;margin:0 0 4px">Weekly Team Report — ${org.name}</h2>
  <p style="color:#94a3b8;margin:0 0 24px;font-size:0.85rem">${weekLabel}</p>
  <div style="background:#1e1b2e;border:1px solid #2d2a45;border-radius:10px;padding:20px 24px;margin-bottom:24px">
    <div style="display:flex;gap:32px;flex-wrap:wrap">
      <div>
        <div style="font-size:1.5rem;font-weight:700;color:#a78bfa">${secondsToReadable(orgTotalSecs)}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:2px">Total hours logged</div>
      </div>
      <div>
        <div style="font-size:1.5rem;font-weight:700;color:#a78bfa">${members.length}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:2px">Team members</div>
      </div>
      <div>
        <div style="font-size:1.5rem;font-weight:700;color:#a78bfa">${entries.length}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:2px">Entries logged</div>
      </div>
    </div>
  </div>
  <div style="background:#161623;border:1px solid #2d2a45;border-radius:10px;padding:20px 24px;white-space:pre-line;font-size:0.875rem;line-height:1.75;color:#cbd5e1">
${reportText}
  </div>
  <p style="color:#475569;font-size:0.75rem;margin-top:24px;line-height:1.5">
    This report was automatically generated by TimeTrack every Monday for the week of ${weekLabel}.
  </p>
</div>`

    await transporter.sendMail({
      from: `TimeTrack Reports <${process.env.GMAIL_USER}>`,
      to: adminUser.email,
      subject: `Weekly Team Report — ${org.name} · ${weekLabel}`,
      html,
    })

    results.push(`${org.name} → ${adminUser.email}`)
  }

  return NextResponse.json({ ok: true, sent: results })
}
