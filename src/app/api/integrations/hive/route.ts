import { NextResponse } from 'next/server'
import { requireUser, isAdmin } from '@/lib/auth-helpers'
import { hivePing, hiveListWorkspaces } from '@/lib/hive/client'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  const { data } = await admin.from('integrations').select('*').eq('org_id', profile.org_id).eq('provider', 'hive').maybeSingle()
  return NextResponse.json({ integration: data ?? null })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { api_key, external_id, workspace_id } = await req.json()
  if (!api_key || !external_id) return NextResponse.json({ error: 'api_key and external_id required' }, { status: 400 })

  try {
    const me = await hivePing({ apiKey: api_key, userId: external_id })
    const workspaces = await hiveListWorkspaces({ apiKey: api_key, userId: external_id })
    const chosen = workspace_id || workspaces[0]?.id || null

    const { data, error } = await admin.from('integrations').upsert({
      org_id: profile.org_id,
      provider: 'hive',
      api_key,
      external_id,
      workspace_id: chosen,
      enabled: true,
      config: { user: me, workspaces },
    }, { onConflict: 'org_id,provider' }).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ integration: data, workspaces })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  await admin.from('integrations').delete().eq('org_id', profile.org_id).eq('provider', 'hive')
  return NextResponse.json({ ok: true })
}
