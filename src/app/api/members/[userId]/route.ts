import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
  return data
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const profile = await getProfile()
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Ensure target user belongs to the same org
  const { data: target } = await admin.from('profiles').select('org_id, role').eq('user_id', userId).single()
  if (!target || target.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only owners can change roles; admins cannot promote to owner or change other admins
  const body = await req.json()
  const allowedFields: Record<string, unknown> = {}
  if ('role' in body) {
    const newRole = body.role
    if (!['owner', 'admin', 'member'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (profile.role !== 'owner' && (newRole === 'owner' || target.role === 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    allowedFields.role = newRole
  }

  const { data: updated, error } = await admin.from('profiles').update(allowedFields).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const profile = await getProfile()
  if (!profile || profile.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Ensure target user belongs to the same org and is not the owner
  const { data: target } = await admin.from('profiles').select('org_id, role').eq('user_id', userId).single()
  if (!target || target.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 })
  if (userId === profile.user_id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 403 })

  await admin.from('profiles').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)
  return NextResponse.json({ success: true })
}
