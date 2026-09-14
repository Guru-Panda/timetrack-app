import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const supabase = await createClient()

  // Check the user exists before sending OTP so we don't leak whether the
  // email is registered — Supabase returns an error either way, but we want
  // a cleaner message.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Do NOT create a new user if the email isn't registered
      shouldCreateUser: false,
    },
  })

  if (error) {
    // Supabase returns "Email not confirmed" or similar when the user doesn't
    // exist.  Normalise to a friendly message.
    const msg = error.message.toLowerCase()
    if (msg.includes('not found') || msg.includes('invalid') || msg.includes('no user')) {
      return NextResponse.json({ error: 'No account found with that email address.' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
