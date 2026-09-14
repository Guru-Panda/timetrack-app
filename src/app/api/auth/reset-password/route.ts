import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = await createClient()

  // The user must already be signed in via verifyOtp before calling this.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Session expired. Please start over.' }, { status: 401 })

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Sign out so the user logs in fresh with the new password.
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
