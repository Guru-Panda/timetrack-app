import { readFileSync } from 'fs'
import 'dotenv/config'

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!SERVICE_ROLE || !PROJECT_URL) { console.error('Env missing'); process.exit(1) }

const sql = readFileSync('./supabase-migration-hr.sql', 'utf8')

// Split on ";\n" that are OUTSIDE dollar-quoted blocks ($$ ... $$).
function splitSql(text) {
  const parts = []
  let buf = ''
  let inDollar = false
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.trim().startsWith('--')) continue
    // Toggle dollar-quote when a $$ appears
    const dollars = (line.match(/\$\$/g) || []).length
    for (let i = 0; i < dollars; i++) inDollar = !inDollar
    buf += line + '\n'
    if (!inDollar && line.trim().endsWith(';')) {
      parts.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

const statements = splitSql(sql)
console.log(`Running ${statements.length} SQL statements via pg-meta API...`)

let success = 0, failed = 0
for (const stmt of statements) {
  try {
    const res = await fetch(`${PROJECT_URL}/pg-meta/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'x-connection-encrypted': 'true',
      },
      body: JSON.stringify({ query: stmt + (stmt.endsWith(';') ? '' : ';') }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok && data.error) {
      if (data.error.includes('already exists') || data.error.includes('duplicate')) {
        success++
      } else {
        console.log(`⚠ ${stmt.slice(0, 80).replace(/\n/g, ' ')}...\n  → ${data.error}`)
        failed++
      }
    } else {
      success++
    }
  } catch (e) {
    console.error('Fetch error:', e.message)
    failed++
  }
}
console.log(`\n✓ ${success} succeeded, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
