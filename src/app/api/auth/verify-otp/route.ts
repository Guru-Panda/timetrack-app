import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { signPayload } from '../forgot-password/route'

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!

function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
    const a = Buffer.from(sig.padEnd(expectedSig.length, '0'))
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null
    return JSON.parse(Buffer.from(data, 'base64url').toString())
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const { email, token: otp, otpToken } = await req.json()
  if (!email || !otp || !otpToken) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  }

  const payload = verifyToken(otpToken) as { email: string; otp: string; userId: string; expires: number } | null
  if (!payload) return NextResponse.json({ error: 'Invalid or tampered token.' }, { status: 400 })
  if (Date.now() > payload.expires) return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 })
  if (payload.email !== email.toLowerCase()) return NextResponse.json({ error: 'Email mismatch.' }, { status: 400 })
  if (payload.otp !== otp.trim()) return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 400 })

  // OTP is valid — issue a short-lived "verified" token (10 min to complete reset)
  const verifiedToken = signPayload({
    userId: payload.userId,
    email: payload.email,
    expires: Date.now() + 10 * 60 * 1000,
    verified: true,
  })

  return NextResponse.json({ ok: true, verifiedToken })
}
