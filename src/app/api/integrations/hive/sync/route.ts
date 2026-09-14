import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'
import { hiveListActions, hiveCreateAction, fromHiveStatus } from '@/lib/hive/client'

// POST /api/integrations/hive/sync
// direction: "pull" imports Hive actions into local actions;
// direction: "push-leaves" creates Hive OOO actions for approved leaves that don't have hive_action_id.
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { direction } = await req.json().catch(() => ({ direction: 'pull' }))

  const { data: integ } = await admin.from('integrations').select('*').eq('org_id', profile.org_id).eq('provider', 'hive').maybeSingle()
  if (!integ || !integ.api_key || !integ.external_id || !integ.workspace_id) {
    return NextResponse.json({ error: 'Hive not configured' }, { status: 400 })
  }
  const creds = { apiKey: integ.api_key as string, userId: integ.external_id as string }
  const wsId = integ.workspace_id as string

  try {
    if (direction === 'push-leaves') {
      const { data: leaves } = await admin
        .from('leave_requests')
        .select('*, profile:profiles!leave_requests_user_id_fkey(full_name)')
        .eq('org_id', profile.org_id)
        .eq('status', 'approved')
        .is('hive_action_id', null)

      let pushed = 0
      for (const l of leaves ?? []) {
        const title = `OOO — ${(l as { profile?: { full_name?: string } }).profile?.full_name ?? 'Employee'} (${l.start_date} → ${l.end_date})`
        const created = await hiveCreateAction(creds, wsId, {
          title,
          description: l.reason || 'Leave approved via TimeTrack',
          due_date: l.start_date,
          status: 'unstarted',
        })
        await admin.from('leave_requests').update({ hive_action_id: created.id }).eq('id', l.id)
        pushed++
      }
      await admin.from('integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integ.id)
      return NextResponse.json({ pushed })
    }

    // pull
    const actions = await hiveListActions(creds, wsId)
    let imported = 0
    for (const a of actions) {
      const status = fromHiveStatus(a.status)
      const { data: existing } = await admin.from('actions').select('id').eq('org_id', profile.org_id).eq('hive_action_id', a.id).maybeSingle()
      if (existing) {
        await admin.from('actions').update({ title: a.title, description: a.description ?? '', status, due_date: a.due_date ?? null, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await admin.from('actions').insert({
          org_id: profile.org_id,
          title: a.title,
          description: a.description ?? '',
          status,
          due_date: a.due_date ?? null,
          hive_action_id: a.id,
        })
        imported++
      }
    }
    await admin.from('integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integ.id)
    return NextResponse.json({ imported, total: actions.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
