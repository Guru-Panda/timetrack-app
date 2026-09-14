import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, token } = await req.json()
  if (!email || !token) return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })

  const supabase = await createClient()

  // verifyOtp signs the user in and sets the session cookies automatically
  // via the server Supabase client (same pattern as signInWithPassword).
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('expired')) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 })
    }
    if (msg.includes('invalid') || msg.includes('incorrect')) {
      return NextResponse.json({ error: 'Incorrect OTP. Please check and try again.' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, userId: data.user?.id })
}
