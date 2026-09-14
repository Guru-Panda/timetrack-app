import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-helpers'

export async function GET(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  const url = new URL(req.url)
  const projectId = url.searchParams.get('project_id')

  let q = admin.from('actions').select('*').eq('org_id', profile.org_id).order('position').limit(500)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ actions: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { admin, profile } = auth
  const body = await req.json()
  const { title, project_id, status, assignee_id, description, due_date } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const { data, error } = await admin.from('actions').insert({
    org_id: profile.org_id,
    title,
    project_id: project_id ?? null,
    status: status ?? 'unstarted',
    assignee_id: assignee_id ?? null,
    description: description ?? '',
    due_date: due_date ?? null,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: data }, { status: 201 })
}
