import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const { verifiedToken, password } = await req.json()

  if (!verifiedToken || !password) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  const payload = verifyToken(verifiedToken) as { userId: string; email: string; expires: number; verified: boolean } | null
  if (!payload || !payload.verified) return NextResponse.json({ error: 'Invalid session. Please start over.' }, { status: 401 })
  if (Date.now() > payload.expires) return NextResponse.json({ error: 'Session expired. Please start over.' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(payload.userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
