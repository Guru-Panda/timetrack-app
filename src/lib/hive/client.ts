// Minimal wrapper around the Hive.com public API (v3).
// Docs: https://developers.hive.com/reference — needs `api_key` + `user_id` on every call.

const HIVE_BASE = 'https://app.hive.com/api/v1'

export interface HiveCredentials {
  apiKey: string
  userId: string
  workspaceId?: string
}

export interface HiveWorkspace { id: string; name: string }
export interface HiveProject { id: string; name: string; color?: string }
export interface HiveAction {
  id: string
  title: string
  description?: string
  status?: string
  assignees?: string[]
  due_date?: string | null
  project_id?: string
}

async function hiveFetch<T>(
  path: string,
  creds: HiveCredentials,
  init: RequestInit = {}
): Promise<T> {
  const url = new URL(`${HIVE_BASE}${path}`)
  url.searchParams.set('api_key', creds.apiKey)
  url.searchParams.set('user_id', creds.userId)

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Hive ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

export async function hivePing(creds: HiveCredentials) {
  return hiveFetch<{ id: string; email?: string; full_name?: string }>(
    `/users/${creds.userId}`,
    creds
  )
}

export async function hiveListWorkspaces(creds: HiveCredentials) {
  return hiveFetch<HiveWorkspace[]>(`/users/${creds.userId}/workspaces`, creds)
}

export async function hiveListProjects(creds: HiveCredentials, workspaceId: string) {
  return hiveFetch<HiveProject[]>(`/workspaces/${workspaceId}/projects`, creds)
}

export async function hiveListActions(creds: HiveCredentials, workspaceId: string) {
  return hiveFetch<HiveAction[]>(`/workspaces/${workspaceId}/actions`, creds)
}

export async function hiveCreateAction(
  creds: HiveCredentials,
  workspaceId: string,
  payload: { title: string; description?: string; due_date?: string; assignees?: string[]; project_id?: string; status?: string }
) {
  return hiveFetch<HiveAction>(`/workspaces/${workspaceId}/actions`, creds, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function hiveUpdateAction(
  creds: HiveCredentials,
  actionId: string,
  payload: Partial<{ title: string; description: string; status: string; due_date: string }>
) {
  return hiveFetch<HiveAction>(`/actions/${actionId}`, creds, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// Map TimeTrack action status to Hive's status labels
export function toHiveStatus(status: string) {
  switch (status) {
    case 'in_progress': return 'in progress'
    case 'completed': return 'completed'
    case 'blocked': return 'blocked'
    default: return 'unstarted'
  }
}

export function fromHiveStatus(status?: string): 'unstarted' | 'in_progress' | 'blocked' | 'completed' {
  const s = (status || '').toLowerCase()
  if (s.includes('progress')) return 'in_progress'
  if (s.includes('block')) return 'blocked'
  if (s.includes('complete') || s.includes('done')) return 'completed'
  return 'unstarted'
}
